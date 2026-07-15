import type { LoanNumbers } from '../../lib/finance/loanMath';
import type { ScamRiskAnalysis } from '../../lib/scams/scamRiskAnalysis';
import type { ArgentinaLegalAnalysis } from '../../lib/legal/argentinaLegalAnalysis';
import type { ExternalVerificationSourceRecord } from '../types/externalVerification';
import type { InvestmentProjectAnalysis } from '../../lib/investments/investmentProjectAnalysis';

export type CustomerDecisionAnswer = {
  kind: 'loan-cost' | 'investment-project' | 'scam-prevention' | 'legal-document' | 'supported-review';
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
  investmentProjectAnalysis?: InvestmentProjectAnalysis | null;
};

const money = (value: number, currency: 'ARS' | 'USD' = 'ARS') => value.toLocaleString('es-AR', { style: 'currency', currency, maximumFractionDigits: 2 });
const percent = (value: number) => `${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

function buildLoanAnswer(financial: LoanNumbers, question: string): CustomerDecisionAnswer {
  const hasFlow = financial.principal !== null && financial.installment !== null && financial.months !== null;
  const hasImplicitRate = financial.impliedTnaPercent !== null && financial.impliedTeaPercent !== null;
  const modeledFromRate = financial.installmentEstimated && financial.tnaPercent !== null;
  const asksInflationComparison = /\b(?:inflaci[oó]n|ipc|indec|rem|bcra|poder\s+adquisitivo|tasa\s+real)\b/i.test(question);
  const hasUpfrontFee = financial.upfrontFeePercent !== null && financial.upfrontFeeAmount !== null;
  const systemExplanation = financial.amortizationSystem === 'german'
    ? `Para el cálculo se aplicó sistema alemán: amortización de capital constante, cuotas mensuales vencidas y decrecientes, desde ${money(financial.firstInstallment || 0, financial.currency)} hasta ${money(financial.lastInstallment || 0, financial.currency)}.`
    : `Para estimar la tasa implícita se usó sistema francés: ${financial.months} cuotas mensuales iguales y vencidas de ${money(financial.installment || 0, financial.currency)}. Esto describe el modelo de cálculo y no acredita que sea el sistema contractual.`;
  const adjustedRateAnswer = modeledFromRate && hasImplicitRate
    ? `La TNA contractual sigue siendo ${percent(financial.tnaPercent || 0)}. ${systemExplanation} ${hasUpfrontFee ? `La comisión inicial de ${percent(financial.upfrontFeePercent || 0)} equivale a ${money(financial.upfrontFeeAmount || 0, financial.currency)} y deja un desembolso neto de ${money(financial.netDisbursement || 0, financial.currency)}. ` : ''}La TNA implícita ajustada por el flujo es ${percent(financial.impliedTnaPercent || 0)} y la TEA implícita es ${percent(financial.impliedTeaPercent || 0)}. No son un CFT oficial.`
    : '';
  const baseDirectAnswer = hasFlow
    ? `${adjustedRateAnswer || `${financial.months} cuotas sumarían ${money(financial.calculatedInstallmentsTotal || 0, financial.currency)}. ${systemExplanation} ${hasImplicitRate ? `La TNA implícita estimada es ${percent(financial.impliedTnaPercent || 0)} y el costo efectivo anual visible es ${percent(financial.impliedTeaPercent || 0)}. ${financial.cftPercent === null ? 'El CFT oficial no puede conocerse sin los cargos e impuestos del contrato.' : `El CFT informado es ${percent(financial.cftPercent)}.`}` : 'Con los datos visibles no alcanza para estimar una tasa implícita.'}`}`
    : `No se puede calcular todavía el costo solicitado porque faltan ${financial.missingFields.join(', ') || 'datos esenciales del flujo'}.`;
  const inflationAnswer = asksInflationComparison && hasFlow
    ? ` No puede afirmarse que sea “igual a la inflación” solamente porque el total nominal se duplique. El costo nominal visible es ${financial.financingCostPercent !== null ? percent(financial.financingCostPercent) : 'calculable con el flujo'} en ${financial.months} meses${hasImplicitRate ? ` y, bajo el supuesto de ${financial.months} cuotas mensuales iguales vencidas, la TEA implícita es ${percent(financial.impliedTeaPercent || 0)}` : ''}. La comparación correcta exige la inflación acumulada esperada para exactamente esos mismos ${financial.months} meses.`
    : '';
  return {
    kind: 'loan-cost',
    status: hasFlow ? 'answerable' : 'partial',
    title: modeledFromRate && hasUpfrontFee ? 'La comisión eleva el costo real del préstamo' : hasFlow ? 'Esto es lo que pagarías con los datos visibles' : 'Faltan datos para calcular lo que pagarías',
    directAnswer: `${baseDirectAnswer}${inflationAnswer}`,
    findings: [
      financial.principal !== null ? `Capital contractual: ${money(financial.principal, financial.currency)}.` : '',
      financial.netDisbursement !== null && hasUpfrontFee ? `Dinero neto disponible después de la comisión: ${money(financial.netDisbursement, financial.currency)}.` : '',
      hasFlow ? `Modelo de cálculo: sistema ${financial.amortizationSystem === 'german' ? 'alemán, con amortización constante y cuotas decrecientes' : 'francés, con cuotas iguales'}; periodicidad mensual; pagos vencidos al final de cada mes.` : '',
      hasFlow && !financial.installmentEstimated ? 'El sistema de amortización es un supuesto necesario para estimar la tasa implícita; debe confirmarse en el contrato.' : '',
      financial.selectedScenarioReason || '',
      financial.installment !== null && financial.months !== null && financial.amortizationSystem === 'french' ? `${financial.months} cuotas ${financial.installmentEstimated ? 'estimadas' : 'informadas'} de ${money(financial.installment, financial.currency)}.` : '',
      financial.installmentEstimated && financial.amortizationSystem === 'german' ? `${financial.months} cuotas decrecientes: primera de ${money(financial.firstInstallment || 0, financial.currency)} y última de ${money(financial.lastInstallment || 0, financial.currency)}.` : '',
      financial.calculatedInstallmentsTotal !== null ? `Suma nominal de cuotas: ${money(financial.calculatedInstallmentsTotal, financial.currency)}.` : '',
      financial.calculatedKnownTotal !== null && hasUpfrontFee ? `Salida nominal total, incluida la comisión inicial: ${money(financial.calculatedKnownTotal, financial.currency)}.` : '',
      financial.financingCost !== null && financial.financingCostPercent !== null ? `Costo nominal por encima del capital, incluida la comisión conocida: ${money(financial.financingCost, financial.currency)} (${percent(financial.financingCostPercent)} del capital).` : '',
      financial.tnaPercent !== null ? `TNA contractual informada: ${percent(financial.tnaPercent)}.` : '',
      financial.impliedTnaPercent !== null ? `TNA implícita ajustada al flujo neto: ${percent(financial.impliedTnaPercent)}.` : '',
      financial.impliedTeaPercent !== null ? `TEA implícita estimada del flujo visible: ${percent(financial.impliedTeaPercent)}.` : '',
      financial.cftPercent !== null ? `CFT declarado por la entidad: ${percent(financial.cftPercent)}.` : '',
      asksInflationComparison ? 'INDEC publica inflación observada mediante el IPC; no es una proyección futura.' : '',
      asksInflationComparison ? 'El REM del BCRA reúne expectativas de analistas privados. No es una proyección propia del BCRA y debe tomarse la mediana del horizonte comparable.' : '',
    ].filter(Boolean),
    nextActions: [
      financial.cftPercent === null ? 'Pedir el CFT con IVA y todos los cargos. La tasa implícita calculada no reemplaza el CFT contractual.' : 'Comparar el CFT declarado con el contrato definitivo y la cotización vigente.',
      'Confirmar si las cuotas son fijas y si incluyen seguro, IVA, comisiones, sellados y gastos administrativos.',
      'Comparar el total final, no solamente el importe de la cuota.',
      asksInflationComparison ? `Contrastar el costo con la mediana vigente del REM para los próximos ${financial.months || 12} meses y luego verificar la inflación efectivamente observada en el IPC de INDEC.` : '',
    ].filter(Boolean),
    limitations: financial.warnings.length ? financial.warnings : ['El cálculo usa exclusivamente los importes visibles y supone cuotas mensuales iguales.'],
  };
}

function buildInvestmentAnswer(analysis: InvestmentProjectAnalysis): CustomerDecisionAnswer {
  const { metrics, inputs } = analysis;
  const hasReturnCalculation = metrics.grossAnnualYieldPercent !== null;
  const findings = [
    `Sector detectado: ${analysis.sectorLabel}.`,
    analysis.location ? `Ubicación detectada: ${analysis.location}.` : '',
    analysis.product ? `Producto detectado: ${analysis.product}.` : '',
    inputs.purchasePrice !== null ? `Precio de compra informado: ${money(inputs.purchasePrice, analysis.currency)}.` : '',
    inputs.squareMeters !== null ? `Superficie informada: ${inputs.squareMeters.toLocaleString('es-AR')} m².` : '',
    metrics.pricePerSquareMeter !== null ? `Precio calculado por m²: ${money(metrics.pricePerSquareMeter, analysis.currency)}.` : '',
    inputs.monthlyRent !== null ? `Alquiler mensual informado: ${money(inputs.monthlyRent, analysis.currency)}.` : '',
    metrics.grossAnnualYieldPercent !== null ? `Rendimiento bruto anual preliminar: ${percent(metrics.grossAnnualYieldPercent)}.` : '',
    metrics.netAnnualYieldPercent !== null ? `Rendimiento neto anual preliminar bajo los supuestos visibles: ${percent(metrics.netAnnualYieldPercent)}.` : '',
    metrics.simplePaybackYears !== null ? `Recupero simple preliminar: ${metrics.simplePaybackYears.toLocaleString('es-AR', { maximumFractionDigits: 1 })} años.` : '',
    inputs.hectares !== null ? `Superficie productiva informada: ${inputs.hectares.toLocaleString('es-AR')} hectáreas.` : '',
    inputs.yieldTonsPerHectare !== null ? `Rinde informado: ${inputs.yieldTonsPerHectare.toLocaleString('es-AR')} toneladas por hectárea.` : '',
    metrics.projectedProductionTons !== null ? `Producción proyectada por cálculo: ${metrics.projectedProductionTons.toLocaleString('es-AR')} toneladas.` : '',
    inputs.projectedAnnualRevenue !== null ? `Ingresos anuales proyectados: ${money(inputs.projectedAnnualRevenue, analysis.currency)}.` : '',
    inputs.projectedAnnualCosts !== null ? `Costos anuales proyectados: ${money(inputs.projectedAnnualCosts, analysis.currency)}.` : '',
    metrics.projectedOperatingMargin !== null ? `Margen operativo proyectado: ${money(metrics.projectedOperatingMargin, analysis.currency)} (${percent(metrics.projectedOperatingMarginPercent || 0)} sobre ingresos).` : '',
    metrics.projectedReturnOnInvestmentPercent !== null ? `Retorno anual preliminar sobre la inversión informada: ${percent(metrics.projectedReturnOnInvestmentPercent)}.` : '',
    ...analysis.scenarios.map((scenario) => `Escenario ${scenario.name === 'adverse' ? 'adverso' : scenario.name === 'base' ? 'base' : 'favorable'}: resultado operativo anual ${money(scenario.operatingResult, analysis.currency)}${scenario.returnOnInvestmentPercent !== null ? ` (${percent(scenario.returnOnInvestmentPercent)} sobre la inversión)` : ''}.`),
    ...analysis.assumptions,
    ...analysis.riskFlags,
  ].filter(Boolean);
  const sourceActions = analysis.sourceRequirements.map((requirement) =>
    `Contrastar ${requirement.purpose.toLowerCase()} con ${requirement.institutions.join(', ')}.`
  );
  return {
    kind: 'investment-project',
    status: analysis.riskFlags.length > 0 ? 'needs-verification' : 'partial',
    title: analysis.riskFlags.length > 0
      ? 'La propuesta necesita verificación reforzada antes de invertir'
      : hasReturnCalculation
        ? 'Este es el rendimiento preliminar con los datos aportados'
        : 'Faltan datos para medir la viabilidad de la inversión',
    directAnswer: `${analysis.conclusion} ${analysis.assessment === 'negative-base-case'
      ? 'El escenario base arroja resultado operativo negativo.'
      : analysis.assessment === 'sensitive-to-adverse-case'
        ? 'El escenario base es positivo, pero pasa a pérdida bajo el escenario adverso y por eso la propuesta es sensible.'
        : analysis.assessment === 'positive-unverified'
          ? 'Los tres escenarios internos son positivos, pero eso no acredita demanda, precios ni costos externos y no equivale a una recomendación.'
          : analysis.assessment === 'high-risk'
            ? 'Las señales de riesgo impiden presentar el proyecto como una oportunidad recomendable.'
            : 'Todavía no existe un flujo suficiente para clasificar su viabilidad.'}`,
    findings,
    nextActions: [
      ...sourceActions,
      'Construir escenarios base, adverso y favorable; no usar una sola proyección de ventas, precio o alquiler.',
      analysis.sector === 'real-estate' ? 'Comparar inmuebles realmente equivalentes por localidad, barrio, tipología, estado, superficie y fecha; medir además oferta, días publicados y vacancia.' : '',
      analysis.sector === 'exports' ? 'Validar demanda por posición arancelaria, destino, volumen, precio, barreras sanitarias, logística, tipo de cambio y concentración de compradores.' : '',
      ['agriculture', 'livestock', 'food-wine'].includes(analysis.sector || '') ? 'Usar campaña y región comparables; incorporar clima, escenario de rinde adverso, mermas, sanidad, logística, impuestos y capital de trabajo.' : '',
    ].filter(Boolean),
    limitations: analysis.missingInputs.map((item) => `Falta informar o verificar: ${item}.`),
  };
}

export function buildCustomerDecisionAnswer(input: DecisionAnswerInput): CustomerDecisionAnswer {
  const question = `${input.userInstruction || ''}\n${input.documentText}`;
  const asksInvestment = /\b(?:inversi[oó]n|invertir|rentabilidad|renta|retorno|viabilidad|proyecto|alquiler|precio\s+por\s+m2|precio\s+por\s+metro|exportaci[oó]n|demanda\s+internacional)\b/i.test(question);
  if (input.investmentProjectAnalysis?.applicable && asksInvestment) {
    return buildInvestmentAnswer(input.investmentProjectAnalysis);
  }
  if (input.financialAnalysis && /(?:cu[aá]nto|total|costo|inter[eé]s|tasa|inflaci[oó]n|tna|tea|cft|cuota|pag(?:ar|ando)|pr[eé]stamo|cr[eé]dito|financi)/i.test(question)) {
    return buildLoanAnswer(input.financialAnalysis, question);
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

export function enrichDecisionAnswerWithEconomicEvidence(
  answer: CustomerDecisionAnswer | undefined,
  financial: LoanNumbers | null | undefined,
  records: ExternalVerificationSourceRecord[]
): CustomerDecisionAnswer | undefined {
  if (!answer) return answer;
  const economicFindings = records
    .filter((record) => ['central-bank-data', 'official-statistics'].includes(record.sourceType) && record.excerpt)
    .map((record) => `${record.title}: ${record.excerpt}`);
  const enriched = economicFindings.length > 0
    ? { ...answer, findings: [...new Set([...answer.findings, ...economicFindings])] }
    : answer;
  if (answer.kind !== 'loan-cost' || financial?.months !== 12) return enriched;

  const remRecord = records.find((record) =>
    record.sourceType === 'central-bank-data'
    && /mediana vigente del REM para los pr[oó]ximos 12 meses es/i.test(record.excerpt || '')
  );
  const valueText = remRecord?.excerpt?.match(/pr[oó]ximos 12 meses es\s+([\d.,]+)%/i)?.[1];
  if (!valueText) return enriched;
  const remPercent = Number(valueText.replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(remPercent)) return enriched;

  const comparisons = [
    financial.financingCostPercent !== null ? `el costo nominal visible de ${percent(financial.financingCostPercent)}` : '',
    financial.impliedTeaPercent !== null ? `la TEA implícita de ${percent(financial.impliedTeaPercent)}` : '',
  ].filter(Boolean).join(' y ');
  if (!comparisons) return enriched;
  return {
    ...enriched,
    directAnswer: `${enriched.directAnswer} La mediana vigente del REM para los próximos 12 meses es ${percent(remPercent)}. Por lo tanto, la afirmación no coincide con la referencia consultada: ${comparisons} son superiores a esa expectativa.`,
  };
}
