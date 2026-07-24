import type { CreditPosition, CreditReport, RejectedCheck } from '../domain/types';
import { CreditProviderError, type CreditProvider } from './creditProvider';

type JsonRecord = Record<string, any>;

const BASE_URL = 'https://api.bcra.gob.ar/CentralDeDeudores/v1.0';

function resultOf(payload: JsonRecord): JsonRecord {
  return (payload?.results || payload?.resultados || payload) as JsonRecord;
}

function positionsFrom(result: JsonRecord, historical = false): CreditPosition[] {
  const periods = historical ? result?.periodos || [] : [result];
  return periods.flatMap((period: JsonRecord) =>
    (period?.entidades || []).map((item: JsonRecord) => ({
      entity: String(item.entidad || item.denominacion || 'Entidad no informada'),
      period: String(period.periodo || item.periodo || ''),
      situation: Number(item.situacion || 0),
      debtAmount: Number(item.monto || 0) * 1000,
      daysPastDue: Number(item.diasAtrasoPago || item.diasAtraso || 0),
      underReview: Boolean(item.enRevision),
      judicialProcess: Boolean(item.procesoJud),
    })),
  );
}

function checksFrom(result: JsonRecord): RejectedCheck[] {
  const groups = result?.causales || result?.entidades || result?.cheques || [];
  return groups.flatMap((group: JsonRecord) =>
    (group?.detalle || group?.cheques || [group]).map((item: JsonRecord) => ({
      bank: String(group.entidad || item.entidad || 'Entidad no informada'),
      rejectionDate: String(item.fechaRechazo || ''),
      amount: Number(item.monto || 0),
      paidDate: item.fechaPago ? String(item.fechaPago) : null,
      finePaidDate: item.fechaPagoMulta ? String(item.fechaPagoMulta) : null,
    })),
  );
}

export class BcraCreditProvider implements CreditProvider {
  readonly id = 'bcra-central-de-deudores';

  constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly baseUrl = BASE_URL,
  ) {}

  private async request(path: string): Promise<JsonRecord | null> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(12_000),
      });
    } catch {
      throw new CreditProviderError('El BCRA no respondió dentro del tiempo esperado.', 'unavailable', true);
    }
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new CreditProviderError(`El BCRA respondió con estado ${response.status}.`, 'unavailable', response.status >= 500);
    }
    try {
      return resultOf(await response.json());
    } catch {
      throw new CreditProviderError('La respuesta del BCRA no tiene un formato válido.', 'bad-response', true);
    }
  }

  async getCreditReport(subjectId: string): Promise<CreditReport> {
    const [current, history, checks] = await Promise.all([
      this.request(`/Deudas/${subjectId}`),
      this.request(`/Deudas/Historicas/${subjectId}`),
      this.request(`/Deudas/ChequesRechazados/${subjectId}`),
    ]);

    if (!current && !history && !checks) {
      throw new CreditProviderError('El BCRA no encontró información para el CUIT/CUIL indicado.', 'not-found');
    }

    return {
      provider: this.id,
      subjectId,
      denomination: String(current?.denominacion || history?.denominacion || checks?.denominacion || '') || null,
      current: current ? positionsFrom(current) : [],
      history: history ? positionsFrom(history, true) : [],
      rejectedChecks: checks ? checksFrom(checks) : [],
      fetchedAt: new Date().toISOString(),
      warnings: [],
    };
  }
}
