import type {
  CreditReport,
  PrequalificationRequest,
  PrequalificationResult,
  PrequalificationStatus,
} from '../domain/types';

export const RISK_MODEL_VERSION = 'ls-prequal-v1.1.0';

export function evaluatePrequalification(
  request: PrequalificationRequest,
  report: CreditReport,
): PrequalificationResult {
  const allPositions = [...report.current, ...report.history];
  const currentMaximum = report.current.length
    ? Math.max(...report.current.map((item) => item.situation))
    : null;
  const maximumSituation = allPositions.length
    ? Math.max(...allPositions.map((item) => item.situation))
    : null;
  const totalDebt = report.current.reduce((sum, item) => sum + item.debtAmount, 0);
  const creditorCount = new Set(report.current.map((item) => item.entity)).size;
  const unpaidChecks = report.rejectedChecks.filter((item) => !item.paidDate);
  const judicial = allPositions.some((item) => item.judicialProcess);
  const underReview = report.current.some((item) => item.underReview);
  const advance = Math.max(0, Math.min(request.advance || 0, request.assetValue));
  const advanceRatio = request.assetValue > 0 ? advance / request.assetValue : 0;
  const requestedExposure = Math.max(0, request.assetValue - advance);
  const reasons: string[] = [];
  const conditions: string[] = [];
  let score = 100;

  const situationPenalty: Record<number, number> = { 1: 0, 2: 18, 3: 42, 4: 68, 5: 88 };
  score -= situationPenalty[currentMaximum || 1] || 0;
  if ((maximumSituation || 0) > (currentMaximum || 0)) {
    score -= Math.min(15, Math.max(0, ((maximumSituation || 0) - 1) * 4));
    reasons.push(`El historial registra situación ${maximumSituation}.`);
  }
  if (unpaidChecks.length) {
    score -= Math.min(45, 24 + unpaidChecks.length * 5);
    reasons.push(`Registra ${unpaidChecks.length} cheque(s) rechazado(s) sin fecha de pago informada.`);
  }
  if (judicial) {
    score -= 35;
    reasons.push('El BCRA informa al menos un registro con proceso judicial.');
  }
  if (underReview) {
    score -= 8;
    reasons.push('Existe información actual marcada en revisión.');
  }
  if (!report.current.length) {
    score -= 20;
    reasons.push('No hay posiciones actuales suficientes para una evaluación automática robusta.');
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  let status: PrequalificationStatus;
  if (judicial || unpaidChecks.length > 1 || (currentMaximum || 0) >= 4) {
    status = 'not-prequalified';
  } else if (underReview || !report.current.length || currentMaximum === 3) {
    status = 'manual-review';
  } else if (currentMaximum === 2 || unpaidChecks.length === 1 || score < 72) {
    status = 'conditional';
  } else {
    status = 'prequalified';
  }

  if (!reasons.length) reasons.push('No se detectaron alertas severas en la información BCRA consultada.');
  if (status === 'prequalified') conditions.push('Validar identidad, destino del bien y política de la entidad antes de aprobar.');
  if (status === 'manual-review') conditions.push('Revisión humana obligatoria antes de solicitar documentación.');

  const historyMap = new Map<string, { maximumSituation: number; totalDebt: number }>();
  for (const item of report.history) {
    const current = historyMap.get(item.period) || { maximumSituation: 0, totalDebt: 0 };
    current.maximumSituation = Math.max(current.maximumSituation, item.situation);
    current.totalDebt += item.debtAmount;
    historyMap.set(item.period, current);
  }

  return {
    status,
    score,
    confidence: report.current.length && report.history.length ? 'alta' : report.current.length ? 'media' : 'baja',
    riskLevel: !allPositions.length ? 'sin datos' : score >= 82 ? 'bajo' : score >= 65 ? 'medio' : score >= 45 ? 'alto' : 'muy alto',
    totalDebt,
    creditorCount,
    maximumSituation,
    currentSituation: currentMaximum,
    rejectedChecks: report.rejectedChecks.length,
    currentPositions: report.current.map((item) => ({
      entity: item.entity,
      period: item.period,
      situation: item.situation,
      debtAmount: item.debtAmount,
      daysPastDue: item.daysPastDue,
      refinancedOrObserved: item.underReview || item.judicialProcess,
    })),
    paymentCapacity: {
      status: 'not-estimable',
      explanation: 'El BCRA informa comportamiento y deuda, pero no ingresos ni flujo disponible. La capacidad de pago real se calculará en la segunda etapa o con un proveedor de ingresos autorizado.',
      requestedExposure,
      advanceRatio,
    },
    conditions,
    reasons,
    history: [...historyMap.entries()]
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([period, value]) => ({ period, ...value })),
    provider: report.provider,
    evaluatedAt: new Date().toISOString(),
    modelVersion: RISK_MODEL_VERSION,
  };
}
