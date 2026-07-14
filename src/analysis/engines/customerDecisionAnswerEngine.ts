import type { LoanNumbers } from '../../lib/finance/loanMath';
import type { ScamRiskAnalysis } from '../../lib/scams/scamRiskAnalysis';
import type { ArgentinaLegalAnalysis } from '../../lib/legal/argentinaLegalAnalysis';

export type CustomerDecisionAnswer = {
  kind: 'loan-cost' | 'scam-prevention' | 'legal-document' | 'supported-review';
  status: 'answerable' | 'partial' | 'needs-verification';
  title: string;
  directAnswer: string;
  findings: string[];
  nextActions: string[];
  limitations: string[];
};

type DecisionAnswerInput = {
  documentText: string;
  userInstruction?: string;
  financialAnalysis: LoanNumbers | null;
  scamRiskAnalysis: ScamRiskAnalysis;
  argentinaLegalAnalysis: ArgentinaLegalAnalysis;
};

const money = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });
const percent = (value: number) => `${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

function buildLoanAnswer(financial: LoanNumbers): CustomerDecisionAnswer {
  const hasFlow = financial.principal !== null && financial.installment !== null && financial.months !== null;
  const hasImplicitRate = financial.impliedTnaPercent !== null && financial.impliedTeaPercent !== null;
  return {
    kind: 'loan-cost',
    status: hasFlow ? 'answerable' : 'partial',
    title: hasFlow ? 'Esto es lo que pagarías con los datos visibles' : 'Faltan datos para calcular lo que pagarías',
    directAnswer: hasFlow
      ? `${financial.months} cuotas sumarían ${money(financial.calculatedInstallmentsTotal || 0)}. ${hasImplicitRate ? `La TNA implícita estimada es ${percent(financial.impliedTnaPercent || 0)} y el costo efectivo anual visible es ${percent(financial.impliedTeaPercent || 0)}. ${financial.cftPercent === null ? 'El CFT oficial no puede conocerse sin los cargos e impuestos del contrato.' : `El CFT informado es ${percent(financial.cftPercent)}.`}` : 'Con los datos visibles no alcanza para estimar una tasa implícita.'}`
      : `No se puede calcular todavía el costo solicitado porque faltan ${financial.missingFields.join(', ') || 'datos esenciales del flujo'}.`,
    findings: [
      financial.principal !== null ? `Capital tomado como base: ${money(financial.principal)}.` : '',
      financial.installment !== null && financial.months !== null ? `${financial.months} cuotas de ${money(financial.installment)}.` : '',
      financial.calculatedInstallmentsTotal !== null ? `Suma nominal de cuotas: ${money(financial.calculatedInstallmentsTotal)}.` : '',
      financial.financingCost !== null && financial.financingCostPercent !== null ? `Diferencia entre cuotas y capital: ${money(financial.financingCost)} (${percent(financial.financingCostPercent)} del capital).` : '',
      financial.impliedTnaPercent !== null ? `TNA implícita estimada: ${percent(financial.impliedTnaPercent)}.` : '',
      financial.impliedTeaPercent !== null ? `TEA implícita estimada del flujo visible: ${percent(financial.impliedTeaPercent)}.` : '',
      financial.cftPercent !== null ? `CFT declarado por la entidad: ${percent(financial.cftPercent)}.` : '',
    ].filter(Boolean),
    nextActions: [
      financial.cftPercent === null ? 'Pedir el CFT con IVA y todos los cargos. La tasa implícita calculada no reemplaza el CFT contractual.' : 'Comparar el CFT declarado con el contrato definitivo y la cotización vigente.',
      'Confirmar si las cuotas son fijas y si incluyen seguro, IVA, comisiones, sellados y gastos administrativos.',
      'Comparar el total final, no solamente el importe de la cuota.',
    ],
    limitations: financial.warnings.length ? financial.warnings : ['El cálculo usa exclusivamente los importes visibles y supone cuotas mensuales iguales.'],
  };
}

export function buildCustomerDecisionAnswer(input: DecisionAnswerInput): CustomerDecisionAnswer {
  const question = `${input.userInstruction || ''}\n${input.documentText}`;
  if (input.financialAnalysis && /(?:cu[aá]nto|total|costo|inter[eé]s|tna|tea|cft|cuota|pagar|pr[eé]stamo|cr[eé]dito|financi)/i.test(question)) {
    return buildLoanAnswer(input.financialAnalysis);
  }
  if (input.scamRiskAnalysis.applicable) {
    const hasSignals = input.scamRiskAnalysis.signals.length > 0;
    return {
      kind: 'scam-prevention', status: hasSignals ? 'needs-verification' : 'partial',
      title: hasSignals ? 'Hay señales que conviene verificar antes de pagar' : 'No alcanza para confirmar que la operación sea segura',
      directAnswer: input.scamRiskAnalysis.conclusion,
      findings: input.scamRiskAnalysis.signals.map((signal) => `${signal.label}: “${signal.evidence}”.`),
      nextActions: input.scamRiskAnalysis.checks,
      limitations: ['La ausencia de patrones conocidos no acredita la identidad, legitimidad o solvencia de la contraparte.'],
    };
  }
  if (input.argentinaLegalAnalysis.applicable) {
    return {
      kind: 'legal-document', status: input.argentinaLegalAnalysis.jurisdiction === 'argentina' ? 'partial' : 'needs-verification',
      title: `Qué implica esta consulta de ${input.argentinaLegalAnalysis.areaLabel.toLowerCase()}`,
      directAnswer: input.argentinaLegalAnalysis.conclusion,
      findings: input.argentinaLegalAnalysis.issues.map((issue) => `${issue.label}: ${issue.explanation}`),
      nextActions: [...input.argentinaLegalAnalysis.sourceTargets.map((source) => `Contrastar con ${source}.`), 'Revisar el documento y los hechos completos antes de tomar una decisión o enviar una intimación.'],
      limitations: input.argentinaLegalAnalysis.factsNeeded.map((fact) => `Falta precisar: ${fact}.`),
    };
  }
  return {
    kind: 'supported-review', status: 'needs-verification', title: 'Qué puede concluirse con la información aportada',
    directAnswer: 'La información disponible no permite todavía una respuesta accionable y suficientemente respaldada.', findings: [],
    nextActions: ['Aportar el documento, oferta o comunicación completa y formular una pregunta concreta.'],
    limitations: ['No se infiere una conclusión por la sola ausencia de información.'],
  };
}
