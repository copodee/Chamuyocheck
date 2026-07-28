import type { CreditPosition, CreditReport, RejectedCheck } from '../domain/types';
import { CreditProviderError, type CreditProvider } from './creditProvider';

type JsonRecord = Record<string, any>;

const BASE_URL = 'https://api.bcra.gob.ar/CentralDeDeudores/v1.0';
const DEFAULT_RETRY_DELAYS_MS = [250, 750] as const;

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function resultOf(payload: JsonRecord): JsonRecord {
  return (payload?.results || payload?.resultados || payload) as JsonRecord;
}

function positionsFrom(result: JsonRecord, historical = false): CreditPosition[] {
  // Both the current and historical BCRA endpoints return a `periodos`
  // collection. Older examples exposed current entities at the root, so keep
  // that format as a backwards-compatible fallback.
  const periods = Array.isArray(result?.periodos) && result.periodos.length
    ? historical
      ? result.periodos
      : [result.periodos[0]]
    : [result];
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
    private readonly retryDelaysMs: readonly number[] = DEFAULT_RETRY_DELAYS_MS,
  ) {}

  private async request(path: string): Promise<JsonRecord | null> {
    const attempts = this.retryDelaysMs.length + 1;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetcher(`${this.baseUrl}${path}`, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(12_000),
        });
      } catch {
        if (attempt < this.retryDelaysMs.length) {
          await wait(this.retryDelaysMs[attempt]);
          continue;
        }
        throw new CreditProviderError(
          'El servicio del BCRA está temporalmente ocupado. Intentá nuevamente en unos segundos.',
          'unavailable',
          true,
        );
      }

      if (response.status === 404) return null;

      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < this.retryDelaysMs.length) {
          await wait(this.retryDelaysMs[attempt]);
          continue;
        }
        throw new CreditProviderError(
          retryable
            ? 'El servicio del BCRA está temporalmente ocupado. Intentá nuevamente en unos segundos.'
            : `El BCRA respondió con estado ${response.status}.`,
          'unavailable',
          retryable,
        );
      }

      try {
        return resultOf(await response.json());
      } catch {
        throw new CreditProviderError('La respuesta del BCRA no tiene un formato válido.', 'bad-response', true);
      }
    }

    throw new CreditProviderError(
      'El servicio del BCRA está temporalmente ocupado. Intentá nuevamente en unos segundos.',
      'unavailable',
      true,
    );
  }

  private async optionalRequest(path: string, warning: string): Promise<{
    data: JsonRecord | null;
    warning: string | null;
  }> {
    try {
      return { data: await this.request(path), warning: null };
    } catch (error) {
      if (error instanceof CreditProviderError && error.retryable) {
        return { data: null, warning };
      }
      throw error;
    }
  }

  async getCreditReport(subjectId: string): Promise<CreditReport> {
    // The current position is the primary source. Secondary endpoints are
    // requested afterwards so a temporary failure in history or rejected
    // checks does not invalidate an otherwise useful prequalification.
    const current = await this.request(`/Deudas/${subjectId}`);
    const historyResult = await this.optionalRequest(
      `/Deudas/Historicas/${subjectId}`,
      'El historial del BCRA no estuvo disponible temporalmente y deberá reintentarse.',
    );
    const checksResult = await this.optionalRequest(
      `/Deudas/ChequesRechazados/${subjectId}`,
      'La consulta de cheques rechazados no estuvo disponible temporalmente y deberá reintentarse.',
    );
    const history = historyResult.data;
    const checks = checksResult.data;

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
      warnings: [historyResult.warning, checksResult.warning].filter((item): item is string => Boolean(item)),
    };
  }
}
