import type { LoanNumbers } from '../../lib/finance/loanMath';
import type { ScamRiskAnalysis } from '../../lib/scams/scamRiskAnalysis';
import type { ArgentinaLegalAnalysis } from '../../lib/legal/argentinaLegalAnalysis';
import type { ExternalVerificationSourceRecord } from '../types/externalVerification';
import type { InvestmentProjectAnalysis } from '../../lib/investments/investmentProjectAnalysis';
import { leasingKnowledge } from '../../lib/leasing/argentinaLeasingKnowledge';
import { buildInternationalLeasingFindings } from '../../lib/leasing/internationalLeasingComparison';
import { LEASING_TAXPAYER_PROFILES, PROVINCIAL_LEASING_STAMP_MATRIX } from '../../lib/leasing/argentinaLeasingTaxMatrix';
import { calculateFinancialLeasing } from '../../lib/leasing/leasingFinanceMath';
import { extractLeasingQuoteData } from '../../lib/leasing/leasingQuoteExtraction';

export type CustomerDecisionAnswer = {
  kind: 'loan-cost' | 'financial-product-comparison' | 'investment-project' | 'scam-prevention' | 'legal-document' | 'leasing-specialist' | 'supported-review';
  status: 'answerable' | 'partial' | 'needs-verification';
  title: string;
  directAnswer: string;
  categoryWarning?: string;
  findings: string[];
  sections?: Array<{ title: string; items: string[] }>;
  comparisonTable?: {
    columns: string[];
    rows: Array<{ label: string; values: string[] }>;
  };
  nextActions: string[];
  limitations: string[];
};

function withLegalCategoryWarning(answer: CustomerDecisionAnswer, analysis: ArgentinaLegalAnalysis): CustomerDecisionAnswer {
  return analysis.branchSelectionWarning ? { ...answer, categoryWarning: analysis.branchSelectionWarning } : answer;
}

type DecisionAnswerInput = {
  documentText: string;
  userInstruction?: string;
  selectedCategory?: string;
  financialAnalysis: LoanNumbers | null;
  scamRiskAnalysis: ScamRiskAnalysis;
  argentinaLegalAnalysis: ArgentinaLegalAnalysis;
  investmentProjectAnalysis?: InvestmentProjectAnalysis | null;
};

const money = (value: number, currency: 'ARS' | 'USD' = 'ARS') => value.toLocaleString('es-AR', { style: 'currency', currency, maximumFractionDigits: 2 });
const percent = (value: number) => `${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

function isFinancialProductComparison(text: string): boolean {
  return /cuenta\s+remunerada|billetera\s+(?:virtual|digital)|money\s*market|fondo\s+com[uú]n|\bFCI\b|plazo\s+fijo|cauci[oó]n|dep[oó]sito\s+bancario|le\s+gana\s+.*plazo\s+fijo/i.test(text);
}

function buildFinancialProductComparisonAnswer(text: string): CustomerDecisionAnswer {
  const compact = text.replace(/\s+/g, ' ');
  const tnas = [...compact.matchAll(/(?:TNA|tasa\s+nominal\s+anual)\s*(?:del?|:|=)?\s*([\d.,]+)\s*%/gi)]
    .map((match) => `TNA publicada: ${match[1]}%.`)
    .slice(0, 4);
  const gains = [...compact.matchAll(/(?:ganancia|rendimiento|inter[eé]s)\s*(?:estimad[oa])?\s*(?:de|:|=)?\s*\$\s*([\d.]+)/gi)]
    .map((match) => `Ganancia nominal publicada: $${match[1]}.`)
    .slice(0, 4);
  const caps = [...compact.matchAll(/(?:tope|m[aá]ximo|l[ií]mite)\s*(?:de|:|=)?\s*\$\s*([\d.]+)/gi)]
    .map((match) => `Tope remunerado publicado: $${match[1]}.`)
    .slice(0, 3);
  return {
    kind: 'financial-product-comparison',
    status: 'needs-verification',
    title: 'La nota compara alternativas de ahorro; no describe un crédito ni un proyecto productivo',
    directAnswer: 'La propuesta puede superar a ciertos plazos fijos solamente bajo las tasas, topes, requisitos y fecha indicados. La comparación debe hacerse con el mismo capital y período, y distinguir una tasa promocional o variable de una tasa garantizada. El título de la nota, por sí solo, no demuestra que sea la mejor opción.',
    findings: [
      'Producto detectado: alternativas financieras de corto plazo, como cuentas remuneradas, billeteras, fondos money market o plazo fijo.',
      ...tnas,
      ...gains,
      ...caps,
      /requisit|operaciones|consumo|compras/i.test(compact) ? 'La tasa puede depender de requisitos de uso, consumo u operaciones que deben cumplirse.' : '',
      /variable|indicativ|puede\s+cambiar|no\s+garantiz/i.test(compact) ? 'El rendimiento informado puede variar y no necesariamente está garantizado durante todo el período.' : '',
    ].filter(Boolean),
    nextActions: [
      'Verificar la tasa vigente y la fecha directamente en el sitio o la aplicación oficial de cada entidad.',
      'Comparar el rendimiento neto para el mismo monto y la misma cantidad de días.',
      'Revisar el tope remunerado, los requisitos para acceder a la tasa, la liquidez y las eventuales comisiones o impuestos.',
      'Confirmar si el rendimiento es fijo, promocional o variable y qué protección regulatoria corresponde al producto.',
    ],
    limitations: ['Las tasas y condiciones pueden cambiar después de la publicación. Una nota periodística es una fuente secundaria y no reemplaza los términos vigentes de cada entidad.'],
  };
}

function buildLoanAnswer(financial: LoanNumbers, question: string): CustomerDecisionAnswer {
  const hasFlow = financial.principal !== null && financial.installment !== null && financial.months !== null;
  const hasImplicitRate = financial.impliedTnaPercent !== null && financial.impliedTeaPercent !== null;
  const modeledFromRate = financial.installmentEstimated && (
    financial.tnaPercent !== null
    || financial.teaPercent !== null
    || financial.cftPercent !== null
  );
  const asksInflationComparison = /\b(?:inflaci[oó]n|ipc|indec|rem|bcra|poder\s+adquisitivo|tasa\s+real)\b/i.test(question);
  const hasUpfrontFee = financial.upfrontFeeAmount !== null;
  const systemExplanation = financial.amortizationSystem === 'german'
    ? 'El cálculo usa sistema alemán: cuotas mensuales vencidas y decrecientes, con amortización de capital constante.'
    : 'El cálculo usa sistema francés: cuotas mensuales iguales y vencidas, pagadas al final de cada mes.';
  const paymentSummary = hasFlow
    ? financial.variablePaymentStages.length > 0
      ? `El plan escalonado tiene ${financial.months} cuotas distribuidas en ${financial.variablePaymentStages.length} tramos y suma ${money(financial.calculatedInstallmentsTotal || 0, financial.currency)}.`
      : financial.amortizationSystem === 'german'
      ? `Las ${financial.months} cuotas irían desde ${money(financial.firstInstallment || 0, financial.currency)} hasta ${money(financial.lastInstallment || 0, financial.currency)} y sumarían ${money(financial.calculatedInstallmentsTotal || 0, financial.currency)}.`
      : `La cuota mensual ${financial.installmentEstimated ? 'estimada' : 'informada'} es ${money(financial.installment || 0, financial.currency)} y ${financial.months} cuotas sumarían un total estimado de ${money(financial.calculatedInstallmentsTotal || 0, financial.currency)}.`
    : '';
  const adjustedRateAnswer = modeledFromRate && financial.tnaPercent !== null && hasImplicitRate
    ? `La TNA contractual sigue siendo ${percent(financial.tnaPercent || 0)}. ${hasUpfrontFee ? `La comisión inicial${financial.upfrontFeePercent !== null ? ` de ${percent(financial.upfrontFeePercent)}` : ''} equivale a ${money(financial.upfrontFeeAmount || 0, financial.currency)} y deja un desembolso neto de ${money(financial.netDisbursement || 0, financial.currency)}. ` : ''}La TNA implícita ajustada por el flujo es ${percent(financial.impliedTnaPercent || 0)} y la TEA implícita es ${percent(financial.impliedTeaPercent || 0)}. No son un CFT oficial.`
    : '';
  const baseDirectAnswer = hasFlow
    ? `${paymentSummary} ${systemExplanation} ${adjustedRateAnswer || `${hasImplicitRate ? `La TNA implícita estimada es ${percent(financial.impliedTnaPercent || 0)} y el costo efectivo anual visible es ${percent(financial.impliedTeaPercent || 0)}. ${financial.cftPercent === null ? 'El CFT oficial no puede conocerse sin los cargos e impuestos del contrato.' : `El CFT informado es ${percent(financial.cftPercent)}.`}` : 'Con los datos visibles no alcanza para estimar una tasa implícita.'}`}`
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
      hasFlow ? `Modelo de cálculo: sistema ${financial.amortizationSystem === 'german' ? 'alemán, con amortización constante y cuotas decrecientes' : 'francés, con cuotas iguales'}; periodicidad mensual; pagos ${financial.paymentTiming === 'advance' ? 'adelantados al comienzo de cada período' : 'vencidos al final de cada período'}${financial.graceMonths > 0 ? `, luego de ${financial.graceMonths} meses de gracia` : ''}.` : '',
      hasFlow && !financial.installmentEstimated ? 'El sistema de amortización es un supuesto necesario para estimar la tasa implícita; debe confirmarse en el contrato.' : '',
      financial.selectedScenarioReason || '',
      financial.variablePaymentStages.length > 0 ? `Plan escalonado: ${financial.variablePaymentStages.map((stage) => `${stage.months} cuotas de ${money(stage.installment, financial.currency)}`).join('; ')}.` : financial.installment !== null && financial.months !== null && financial.amortizationSystem === 'french' ? `${financial.months} cuotas ${financial.installmentEstimated ? 'estimadas' : 'informadas'} de ${money(financial.installment, financial.currency)}.` : '',
      financial.monthlyAdditionalCost !== null ? `Seguro o cargo periódico adicional: ${money(financial.monthlyAdditionalCost, financial.currency)} por mes.` : '',
      financial.finalPayment !== null ? `Pago final o extraordinario adicional informado: ${money(financial.finalPayment, financial.currency)}.` : '',
      financial.installmentEstimated && financial.amortizationSystem === 'german' ? `${financial.months} cuotas decrecientes: primera de ${money(financial.firstInstallment || 0, financial.currency)} y última de ${money(financial.lastInstallment || 0, financial.currency)}.` : '',
      financial.calculatedInstallmentsTotal !== null ? `Suma nominal de cuotas: ${money(financial.calculatedInstallmentsTotal, financial.currency)}.` : '',
      financial.calculatedKnownTotal !== null && hasUpfrontFee ? `Salida nominal total, incluida la comisión inicial: ${money(financial.calculatedKnownTotal, financial.currency)}.` : '',
      financial.financingCost !== null && financial.financingCostPercent !== null ? `Costo nominal por encima del capital, incluida la comisión conocida: ${money(financial.financingCost, financial.currency)} (${percent(financial.financingCostPercent)} del capital).` : '',
      financial.tnaPercent !== null ? `TNA contractual informada: ${percent(financial.tnaPercent)}.` : '',
      financial.teaPercent !== null ? `TEA contractual informada: ${percent(financial.teaPercent)}.` : '',
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
      analysis.sector === 'mining' ? 'Verificar título o concesión, informe competente de recursos y reservas, permisos ambientales, CAPEX, OPEX, regalías, logística, precio del mineral y costos de cierre.' : '',
      analysis.sector === 'oil-gas' ? 'Verificar concesión, reservas, producción por pozo y formación, curva de declino, CAPEX, OPEX, regalías, capacidad de transporte, permisos y abandono.' : '',
      analysis.secondarySectors.includes('real-estate') ? 'Para tierras, viviendas o alquileres cercanos, reunir comparables fechados de la misma localidad y tipología; la actividad sectorial no demuestra el valor inmobiliario.' : '',
      ['agriculture', 'livestock', 'food-wine'].includes(analysis.sector || '') ? 'Usar campaña y región comparables; incorporar clima, escenario de rinde adverso, mermas, sanidad, logística, impuestos y capital de trabajo.' : '',
    ].filter(Boolean),
    limitations: analysis.missingInputs.map((item) => `Falta informar o verificar: ${item}.`),
  };
}

function buildSexualOffenseAnswer(analysis: ArgentinaLegalAnalysis): CustomerDecisionAnswer {
  return {
    kind: 'legal-document',
    status: analysis.jurisdiction === 'argentina' ? 'partial' : 'needs-verification',
    title: 'La pena depende de la conducta y de las circunstancias del caso',
    directAnswer: analysis.jurisdiction === 'argentina'
      ? 'En Argentina no existe una única pena para lo que coloquialmente se llama “violación”. El artículo 119 del Código Penal prevé distintas escalas: de 6 meses a 4 años para el abuso sexual básico; de 4 a 10 años si es gravemente ultrajante; de 6 a 15 años cuando existe acceso carnal u otros actos análogos; y de 8 a 20 años para determinados supuestos agravados. Si como resultado ocurre la muerte de la víctima, el artículo 124 prevé prisión perpetua. La escala aplicable no puede determinarse sin los hechos y la calificación jurídica concreta.'
      : 'No puede indicarse una pena sin conocer el país o jurisdicción. Las escalas cambian según la ley aplicable y las circunstancias concretas.',
    findings: analysis.jurisdiction === 'argentina'
      ? ['Marco normativo a contrastar: artículos 119, 120 y 124 del Código Penal de la Nación, texto actualizado.', '“Violador” es una expresión coloquial; la calificación legal exige identificar la conducta prevista por la norma.']
      : [],
    nextActions: [
      'Precisar jurisdicción, edad de la víctima, modalidad de la conducta, agravantes, daños y resultado.',
      ...analysis.sourceTargets.map((source) => `Contrastar con ${source}.`),
      'Consultar a una persona profesional del derecho penal antes de aplicar una escala a un caso concreto.',
    ],
    limitations: analysis.factsNeeded.map((fact) => `Falta precisar: ${fact}.`),
  };
}

function buildChildSupportAnswer(analysis: ArgentinaLegalAnalysis): CustomerDecisionAnswer {
  return {
    kind: 'legal-document',
    status: analysis.jurisdiction === 'argentina' ? 'partial' : 'needs-verification',
    title: 'La obligación alimentaria no termina con el divorcio',
    directAnswer: analysis.jurisdiction === 'argentina'
      ? 'En Argentina, ambos progenitores deben sostener a su hijo. La obligación alimentaria se extiende, como regla, hasta los 21 años. Puede continuar hasta los 25 años si el hijo estudia o se capacita y eso le impide mantenerse por sus propios medios. En tu caso, como tu hijo tiene 8 años, la obligación continúa; el monto no surge solamente de la edad, sino de sus necesidades, las posibilidades económicas de ambos progenitores y el valor económico de las tareas de cuidado.'
      : 'La edad hasta la cual corresponde la cuota alimentaria depende de la jurisdicción. Hace falta indicar el país antes de aplicar una regla concreta.',
    findings: analysis.jurisdiction === 'argentina'
      ? ['Regla general: artículo 658 del Código Civil y Comercial de la Nación.', 'Extensión por estudios o capacitación: artículo 663.', 'La cuota comprende, entre otros rubros, manutención, educación, vivienda, salud, vestimenta y esparcimiento; las tareas de cuidado también tienen valor económico.']
      : [],
    nextActions: [
      'Reunir comprobantes de los gastos actuales del hijo y datos de ingresos de ambos progenitores.',
      ...analysis.sourceTargets.map((source) => `Contrastar con ${source}.`),
      'Si no hay acuerdo, consultar asistencia jurídica para fijar o reclamar judicialmente la cuota.',
    ],
    limitations: ['La edad define la duración general de la obligación, pero no determina por sí sola el monto de la cuota.'],
  };
}

function buildGeneralLegalAnswer(analysis: ArgentinaLegalAnalysis): CustomerDecisionAnswer {
  return {
    kind: 'legal-document', status: analysis.jurisdiction === 'argentina' ? 'partial' : 'needs-verification',
    title: `Qué implica esta consulta de ${analysis.areaLabel.toLowerCase()}`,
    directAnswer: analysis.conclusion,
    findings: analysis.issues.map((issue) => `${issue.label}: ${issue.explanation}`),
    nextActions: [...analysis.sourceTargets.map((source) => `Contrastar con ${source}.`), 'Revisar el documento y los hechos completos antes de tomar una decisión o enviar una intimación.'],
    limitations: analysis.factsNeeded.map((fact) => `Falta precisar: ${fact}.`),
  };
}

function asksEntityOrOfferVerification(text: string): boolean {
  return /\b(?:es|son|parece|parecen|existe|existen|opera|operan|funciona|funcionan|ser[ií]a|ser[ií]an)\b.{0,100}\b(?:real(?:es)?|leg[ií]tim[oa]s?|confiable(?:s)?|segur[oa]s?|posible(?:s)?|viable(?:s)?|estafa(?:s)?|fraude(?:s)?)\b|\b(?:es|son)\s+(?:una?\s+)?(?:posible\s+)?(?:estafa|fraude)|\b(?:validar|verificar|comprobar|confirmar)\b.{0,100}\b(?:empresa|entidad|fintech|plataforma|sitio|dominio|oferta|inversi[oó]n)\b/i.test(text);
}

function extractNamedOperators(text: string): string[] {
  const candidates = [...text.matchAll(/\b([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9.-]{2,40})\b(?=\s+(?:es|opera|ofrece|permite|usa|trabaja|se\s+presenta|aunque)\s+(?:una?\s+)?(?:startup|plataforma|fintech|proptech|empresa|exchange|broker)?)/g)]
    .map((match) => match[1])
    .filter((name) => !/^(?:Argentina|Enlace|Título|Página|Esta|Aunque)$/i.test(name));
  return [...new Set(candidates)].slice(0, 8);
}

function buildEntityVerificationAnswer(input: DecisionAnswerInput, question: string): CustomerDecisionAnswer {
  const operators = extractNamedOperators(input.documentText);
  const sourceIsArticle = /\b(?:nota|artículo|blog|redacción|actualizado)\b/i.test(input.documentText);
  return {
    kind: 'scam-prevention',
    status: 'needs-verification',
    title: operators.length
      ? 'La página menciona entidades reales como nombres, pero eso no valida cada operación'
      : 'La existencia o legitimidad de la entidad todavía debe comprobarse',
    directAnswer: `${sourceIsArticle ? 'La página aportada es una fuente secundaria: permite identificar qué entidades u ofertas menciona, pero no demuestra por sí sola que estén actualmente activas, autorizadas ni que una propuesta concreta sea segura. ' : ''}La pregunta requiere comprobar por separado identidad legal, dominio oficial, autorización aplicable, contrato, custodio de fondos y posibilidad real de retiro o cumplimiento. No corresponde responder con una plantilla de rentabilidad ni afirmar estafa solamente por falta de datos.`,
    findings: [
      operators.length ? `Entidades o plataformas mencionadas en el contenido: ${operators.join(', ')}.` : '',
      'Que una marca aparezca en una nota, publicidad o buscador demuestra únicamente que fue mencionada; no acredita CUIT, razón social, regulación, solvencia ni vigencia.',
      /tokeniz|crowdfunding|fideicomiso|cripto|inmobili/i.test(`${question} ${input.documentText}`)
        ? 'La factibilidad de una inversión tokenizada, colectiva o inmobiliaria depende además de la estructura jurídica, titularidad del activo, vehículo contractual, custodia y derechos de salida.'
        : '',
    ].filter(Boolean),
    nextActions: [
      'Identificar para cada marca la razón social, CUIT, domicilio, responsables y dominio oficial exacto.',
      'Comprobar en CNV, BCRA u otro regulador competente qué actividad declara y si requiere autorización; una ausencia en un registro no prueba por sí sola fraude.',
      'Revisar quién recibe y custodia el dinero, qué derecho adquiere el usuario, cómo puede retirarlo o venderlo y qué contrato respalda la operación.',
      'Contrastar la información de la nota con el sitio oficial y documentación vigente de cada entidad, sin depositar a partir de un enlace publicitario.',
    ],
    limitations: ['La lectura de una página permite auditar lo que afirma esa fuente, pero la existencia de las entidades y la vigencia de sus autorizaciones requieren fuentes independientes y actuales.'],
  };
}

function buildLegalSubtopicAnswer(analysis: ArgentinaLegalAnalysis): CustomerDecisionAnswer | null {
  const content: Partial<Record<ArgentinaLegalAnalysis['subtopic'], { title: string; answer: string; findings: string[]; actions: string[] }>> = {
    'contract-review': {
      title: 'El contrato debe leerse como un sistema de obligaciones, condiciones, riesgos y remedios',
      answer: 'Para determinar si un contrato es exigible y qué puede reclamarse hay que identificar partes y representación, objeto, precio, plazos, condiciones, obligaciones recíprocas, garantías, incumplimientos, intimaciones y mecanismos de terminación. El pago fortalece el reclamo de la prestación correspondiente, pero no reemplaza la revisión de condiciones pendientes, excepciones ni solvencia. Según el caso puede corresponder exigir cumplimiento, resolver, obtener restitución, reclamar daños o pedir una medida cautelar.',
      findings: ['Una cláusula aislada no debe interpretarse sin el resto del contrato y sus anexos.', 'Penalidades, intereses, limitaciones y jurisdicción necesitan control de validez y reciprocidad.'],
      actions: ['Ordenar contrato, anexos, poderes, facturas, pagos, entregas, intimaciones y comunicaciones.', 'Construir una tabla con obligación, responsable, vencimiento, condición, prueba e incumplimiento.'],
    },
    'family-divorce': {
      title: 'El divorcio y sus efectos personales y patrimoniales deben analizarse por separado',
      answer: 'En Argentina cualquiera de los cónyuges puede pedir el divorcio sin expresar una causa. La sentencia de divorcio no resuelve automáticamente cuidado, alimentos, vivienda, distribución de bienes ni compensación económica: esos efectos requieren una propuesta reguladora, acuerdo o decisión específica. Las fechas importan especialmente para bienes, deudas y una eventual compensación.',
      findings: ['Separar hijos, vivienda y medidas urgentes de la liquidación patrimonial.', 'Verificar si existe desequilibrio económico y el plazo legal para reclamar compensación.'],
      actions: ['Reunir partidas, fecha de separación, propuesta reguladora, títulos, saldos, deudas e ingresos.', 'Identificar bienes propios y gananciales antes de proponer una distribución.'],
    },
    'family-parental': {
      title: 'El interés del niño, su centro de vida y los cuidados reales ordenan el análisis',
      answer: 'Cuidado personal, comunicación, responsabilidad parental y filiación no se resuelven sólo por lo que desea uno de los adultos. Deben examinarse el centro de vida, la organización efectiva de cuidados, la edad y necesidades del niño, los acuerdos y resoluciones vigentes y cualquier situación de riesgo. Una modificación estable o un traslado pueden requerir acuerdo o intervención judicial.',
      findings: ['Las tareas de cuidado y la continuidad cotidiana son hechos jurídicamente relevantes.', 'Una urgencia o riesgo exige medidas distintas del planteo definitivo.'],
      actions: ['Preparar cronología de cuidados, domicilios, escolaridad, salud, comunicaciones y acuerdos.', 'Identificar toda resolución, audiencia, denuncia o restricción vigente.'],
    },
    'family-violence': {
      title: 'La prioridad es proteger a las personas en riesgo y preservar la evidencia',
      answer: 'Una consulta por violencia familiar o doméstica requiere identificar peligro actual, convivencia, lesiones, amenazas, armas, niñas o niños involucrados y medidas ya vigentes. No debe quedar absorbida por el trámite de divorcio, alimentos o bienes. Según los hechos pueden corresponder medidas urgentes de protección y, por separado, actuaciones de familia, civiles o penales.',
      findings: ['La urgencia se evalúa por hechos actuales y riesgo, no sólo por la existencia de una denuncia previa.', 'Una medida protectoria no resuelve automáticamente el conflicto familiar o patrimonial definitivo.'],
      actions: ['Si existe peligro inmediato, acudir a emergencias o a la autoridad local sin esperar este análisis.', 'Conservar mensajes, fotografías, certificados, testigos, denuncias y resoluciones; identificar personas protegidas y medidas vigentes.'],
    },
    'criminal-property': {
      title: 'El delito contra la propiedad depende de cómo ocurrió el apoderamiento o la afectación del bien',
      answer: 'Robo, hurto, usurpación y daño no son equivalentes. Deben precisarse la conducta, violencia o fuerza, titularidad o tenencia, lugar, momento, participación, recuperación del bien y evidencia disponible. La denominación usada por quien consulta no sustituye la calificación jurídica ni permite anticipar una pena.',
      findings: ['Violencia sobre personas, fuerza sobre cosas y ausencia de ambas pueden modificar el encuadre.', 'Un conflicto por posesión, entrega o contrato puede ser civil aunque también deba preservarse evidencia de una conducta penal.'],
      actions: ['Preparar cronología, inventario, títulos o comprobantes, fotografías, cámaras, testigos y comunicaciones.', 'Identificar bien, valor, tenencia, modo de acceso, daños, amenazas y personas intervinientes.'],
    },
    'criminal-economic': {
      title: 'El delito económico exige probar el mecanismo, el engaño o abuso y el perjuicio',
      answer: 'La falta de pago o el incumplimiento de un negocio no constituyen por sí solos estafa, defraudación, administración fraudulenta, lavado o corrupción. Debe reconstruirse qué se afirmó u ocultó, cuándo existió el propósito atribuido, qué disposición patrimonial produjo, quién se benefició y qué documentación respalda cada paso. El análisis penal debe convivir con las posibles acciones civiles o comerciales sin confundirlas.',
      findings: ['El momento del engaño o abuso y la relación con la entrega de dinero o bienes son datos centrales.', 'Contabilidad, flujos, beneficiarios, poderes y comunicaciones pueden ser más relevantes que la etiqueta usada.'],
      actions: ['Preservar contratos, transferencias, facturas, contabilidad, mensajes, identidades, cuentas y trazabilidad de fondos.', 'Separar incumplimiento posterior de maniobras previas o concomitantes y cuantificar el perjuicio documentado.'],
    },
    consumer: {
      title: 'La relación de consumo debe contrastar la oferta, lo entregado y la respuesta del proveedor',
      answer: 'Para establecer si corresponde reparación, cambio, devolución, cumplimiento o daños hay que comprobar quién ofreció el producto o servicio, qué prometió, qué se contrató, cuál fue la falla y cómo respondió. La publicidad, la oferta, la garantía y el trato recibido pueden integrar el análisis; no alcanza con que el proveedor invoque sus términos internos.',
      findings: ['Debe verificarse si la persona actuó como destinataria final y quién integra la cadena de proveedores.', 'Los plazos y remedios varían según incumplimiento, garantía, contratación a distancia y daño.'],
      actions: ['Guardar publicidad, presupuesto, factura, garantía, reclamos, respuestas y evidencia de la falla.', 'Precisar qué solución se pidió y cuándo fue rechazada o incumplida.'],
    },
    insurance: {
      title: 'La cobertura depende de la póliza, el riesgo, el siniestro y las comunicaciones',
      answer: 'No puede validarse un rechazo o calcular una indemnización sin leer la póliza completa, anexos, vigencia, suma asegurada, franquicia, exclusiones y denuncia del siniestro. También deben controlarse las razones y fechas comunicadas por la aseguradora y si la cobertura fue contratada como relación de consumo.',
      findings: ['Una exclusión debe analizarse dentro de la póliza completa y frente al hecho concreto.', 'Las fechas de denuncia, requerimientos y rechazo pueden afectar las vías disponibles.'],
      actions: ['Reunir póliza, anexos, recibos, denuncia, peritajes, presupuestos y carta de rechazo.', 'Separar daño, suma asegurada, franquicia, límites y gastos reclamados.'],
    },
    'civil-damages': {
      title: 'Un reclamo de daños necesita hecho, perjuicio, causalidad y responsable identificados',
      answer: 'La sola existencia de un accidente o incumplimiento no determina automáticamente responsabilidad ni monto. Deben probarse el hecho, el daño concreto, su relación causal, quién debe responder y las defensas aplicables. Cada rubro reclamado necesita fundamento y evidencia propios, y deben revisarse seguros, prescripción y posibles responsabilidades concurrentes.',
      findings: ['Daño material, lucro cesante, incapacidad y consecuencias no patrimoniales no se calculan del mismo modo.', 'Debe evitarse duplicar rubros o atribuir al hecho consecuencias sin respaldo.'],
      actions: ['Conservar documentación, fotografías, historia clínica, facturas, peritajes, testigos y comunicaciones.', 'Construir una cronología y una liquidación separada por rubro.'],
    },
    leases: {
      title: 'La locación debe separar canon, depósito, conservación, restitución y garantías',
      answer: 'Para responder sobre alquileres hay que revisar el contrato vigente, destino del inmueble, plazo, actualización, depósito, garantías, expensas, servicios, reparaciones, mora, rescisión y estado de entrega. Locador e inquilino tienen obligaciones diferentes y no todo gasto puede trasladarse sólo porque figure en una liquidación. El desalojo, cobro, reparación o devolución del depósito requieren hechos y documentación específicos.',
      findings: ['Debe diferenciarse reparación necesaria, mantenimiento ordinario, mejora y daño imputable.', 'La normativa aplicable depende de la fecha del contrato, su destino y la jurisdicción procesal.'],
      actions: ['Reunir contrato, inventario, fotografías, recibos, expensas, presupuestos y comunicaciones.', 'Precisar fechas de ocupación, mora, intimación, restitución y estado actual del inmueble.'],
    },
    'property-rights': {
      title: 'Propiedad, posesión y registración son situaciones distintas y deben probarse',
      answer: 'Tener la posesión, figurar en un boleto, pagar impuestos o aparecer en un registro no produce siempre el mismo derecho. El análisis debe identificar el inmueble o bien, título, registración, tradición, ocupación, planos, límites, gravámenes y actos realizados por cada parte. Condominio, usufructo, servidumbre, propiedad horizontal y prescripción adquisitiva tienen requisitos y remedios diferentes.',
      findings: ['La publicidad registral y la situación posesoria deben verificarse por separado.', 'Fechas, continuidad de la posesión y buena o mala fe pueden modificar el análisis.'],
      actions: ['Obtener título, informe de dominio e inhibiciones, catastro, plano, mensura y antecedentes posesorios.', 'Identificar ocupantes, actos de posesión, pagos, oposición, gravámenes y procesos existentes.'],
    },
    corporate: {
      title: 'El conflicto societario depende del tipo social, el estatuto, las mayorías y las actas',
      answer: 'Para analizar derechos de socios, decisiones del directorio, administración o responsabilidad hay que identificar el tipo societario, estatuto, composición del capital, convocatoria, quórum, mayorías, actas y registraciones. La deuda de la sociedad no se traslada automáticamente a socios o administradores, pero pueden existir garantías o responsabilidades específicas.',
      findings: ['Sociedad, socios, administradores y garantes son sujetos distintos.', 'Una decisión puede requerir impugnación dentro de plazos y con legitimación concreta.'],
      actions: ['Reunir estatuto, reformas, libros, actas, convocatorias, poderes, estados contables y registraciones.', 'Precisar decisión cuestionada, fecha, voto, perjuicio y medida pretendida.'],
    },
    insolvency: {
      title: 'La cesación de pagos cambia las reglas de cobro y exige revisar el proceso concursal',
      answer: 'Si existe concurso preventivo o quiebra, un acreedor no debe tratar el caso como un cobro comercial ordinario. Hay que verificar apertura, juzgado, publicaciones, fecha de presentación, período de verificación, causa, monto, privilegio y garantías del crédito. La estrategia cambia según el crédito sea anterior o posterior y tenga o no garantía.',
      findings: ['La existencia de mora aislada no prueba por sí sola cesación de pagos.', 'Privilegio, garantía y fecha de origen afectan el tratamiento del crédito.'],
      actions: ['Obtener expediente, edictos, síndico, fechas, título, comprobantes y garantías.', 'Preparar capital, causa, privilegio, intereses y documentación para la vía correspondiente.'],
    },
    'negotiable-instruments': {
      title: 'Cheque, pagaré y letra tienen requisitos y defensas propios',
      answer: 'Antes de ejecutar un título debe verificarse qué instrumento es, sus requisitos formales, firmas, representación, vencimiento, presentación, rechazo, cadena de endosos y prescripción. La vía ejecutiva puede limitar las defensas iniciales, pero un documento incompleto o una relación de consumo pueden exigir controles adicionales.',
      findings: ['Factura, cheque y pagaré no son equivalentes ni acreditan lo mismo.', 'La causa del negocio y la protección del consumidor pueden ser relevantes según el caso.'],
      actions: ['Conservar el original y reunir constancias de presentación, rechazo, endosos, avales e intimaciones.', 'Controlar vencimiento, jurisdicción, legitimación y plazo antes de iniciar la ejecución.'],
    },
    'public-procurement': {
      title: 'La contratación pública depende del expediente, el pliego y la etapa del procedimiento',
      answer: 'Una licitación, adjudicación, sanción o ejecución contractual pública debe analizarse desde el régimen aplicable y el expediente completo. El pliego, la oferta, los dictámenes, la competencia del organismo, la igualdad entre oferentes, la motivación y la notificación determinan qué observación, impugnación, recurso o medida puede corresponder.',
      findings: ['El régimen nacional no se aplica automáticamente a provincias, municipios o empresas públicas.', 'La etapa del trámite y la fecha de notificación condicionan la vía disponible.'],
      actions: ['Obtener expediente, pliego, circulares, oferta, actas, dictámenes, acto y constancia de notificación.', 'Precisar organismo, jurisdicción, etapa, agravio y plazo vigente.'],
    },
    'administrative-sanctions': {
      title: 'La sanción administrativa debe respetar competencia, procedimiento, defensa y proporcionalidad',
      answer: 'Para revisar una multa, clausura, inhabilitación o sanción disciplinaria hay que identificar la norma imputada, autoridad competente, acta, prueba, descargo, motivación, graduación, reincidencia y notificación. No toda irregularidad invalida automáticamente la sanción, pero la falta de defensa, prueba, competencia o fundamento puede ser relevante. La vía y el plazo dependen del organismo y jurisdicción.',
      findings: ['Acta de constatación, imputación y acto sancionatorio cumplen funciones diferentes.', 'Debe revisarse si el recurso suspende la ejecución o si hace falta pedir una medida específica.'],
      actions: ['Obtener expediente completo, acta, imputación, descargo, prueba, dictamen, resolución y notificación.', 'Controlar norma, competencia, antecedentes, graduación, recurso, efecto y vencimiento.'],
    },
  };
  const selected = content[analysis.subtopic];
  if (!selected) return null;
  return {
    kind: 'legal-document', status: 'partial', title: selected.title, directAnswer: selected.answer,
    findings: [...selected.findings, ...analysis.issues.map((issue) => `${issue.label}: ${issue.explanation}`)],
    nextActions: [...selected.actions, ...analysis.sourceTargets.map((source) => `Contrastar con ${source}.`)],
    limitations: analysis.factsNeeded.map((fact) => `Falta precisar: ${fact}.`),
  };
}

function buildPledgeFinanceAnswer(financial: LoanNumbers, text: string): CustomerDecisionAnswer {
  const hasFlow = financial.principal !== null && financial.installment !== null && financial.months !== null;
  const flowAnswer = hasFlow
    ? buildLoanAnswer(financial, text)
    : null;
  return {
    kind: 'financial-product-comparison',
    status: hasFlow ? 'answerable' : 'partial',
    title: hasFlow ? 'Costo del crédito prendario con los datos aportados' : 'Qué cuesta y qué debe informar un crédito prendario',
    directAnswer: flowAnswer?.directAnswer
      || 'La prenda es la garantía registral del crédito; no es por sí sola la tasa ni el costo total. Para conocer cuánto pagarías deben sumarse anticipo, cuotas, CFT, seguro, impuestos, comisión, inscripción, informes, certificaciones, gestoría y cancelación. Si falta el flujo, el sistema debe explicar qué datos faltan sin abandonar la categoría financiera.',
    findings: [
      ...(flowAnswer?.findings || []),
      'Monto y porcentaje financiado: comparar el precio de contado con el capital efectivamente prestado y el anticipo exigido.',
      'Costo financiero: pedir TNA, TEA y CFT con IVA, además del sistema de amortización, cantidad, periodicidad y variabilidad de las cuotas.',
      'Garantía: identificar el bien prendado, su valuación, grado de la prenda, acreedor, plazo, condiciones de ejecución y restricciones para disponer del bien.',
      'Costos iniciales y registrales: revisar comisión de otorgamiento, Sellos según jurisdicción, informes, certificaciones, inscripción registral y gestoría.',
      'Costos durante el crédito: verificar seguro exigido, cobertura, beneficiario, impuestos, mantenimiento de la garantía y cargos por mora.',
      'Finalización: confirmar quién tramita y paga la cancelación registral, en qué plazo y qué comprobante acredita que el bien quedó liberado.',
    ],
    nextActions: [
      'Pedir una cotización que separe precio de contado, anticipo, capital financiado, cuotas, TNA, TEA, CFT con IVA y todos los gastos.',
      'Solicitar el detalle de inscripción, seguro, Sellos, gestoría y cancelación; no asumir que están incluidos en la cuota.',
      'Comparar contra un préstamo sin garantía y contra leasing usando el mismo bien, anticipo y plazo, computando el flujo total.',
    ],
    limitations: [
      'Los importes y alícuotas registrales o tributarias dependen del bien, la jurisdicción, la fecha y la operación concreta.',
      ...(flowAnswer?.limitations || ['Sin capital, anticipo, cuotas, plazo y cargos no puede calcularse una tasa ni un costo total.']),
    ],
  };
}

function buildCommercialContractAnswer(analysis: ArgentinaLegalAnalysis): CustomerDecisionAnswer {
  return {
    kind: 'legal-document',
    status: 'partial',
    title: 'El acuerdo comercial debe revisarse como un contrato exigible, no como una causa penal',
    directAnswer: 'El pago total no garantiza materialmente que la otra parte entregue los bienes, pero puede fortalecer un reclamo contractual si la obligación de entrega ya venció y no estaba sujeta a otra condición. Para determinar si corresponde exigir cumplimiento, resolver el acuerdo, reclamar daños o pedir una medida cautelar hay que verificar el texto completo, los anexos, los comprobantes de pago, el plazo de entrega, las condiciones precedentes, las garantías y el mecanismo pactado para intimar o demandar.',
    findings: [
      ...analysis.issues.map((issue) => `${issue.label}: ${issue.explanation}`),
      'Una penalidad incluida en un acuerdo sigue siendo una cláusula contractual; por sí sola no convierte el conflicto en derecho penal.',
      'La respuesta debe distinguir entre exigir la entrega, resolver el contrato y reclamar daños, porque cada remedio requiere hechos y prueba diferentes.',
    ],
    nextActions: [
      'Ordenar el acuerdo completo, anexos, facturas, recibos, transferencias y comunicaciones sobre el pago y la entrega.',
      'Identificar quién asumió la obligación de entregar, cuándo vencía y qué condiciones debían cumplirse antes.',
      ...analysis.sourceTargets.map((source) => `Contrastar con ${source}.`),
      'Antes de iniciar una demanda, revisar jurisdicción, procedimiento de intimación, medidas cautelares y solvencia de la contraparte.',
    ],
    limitations: analysis.factsNeeded.map((fact) => `Falta precisar: ${fact}.`),
  };
}

function buildLaborAnswer(analysis: ArgentinaLegalAnalysis): CustomerDecisionAnswer {
  return {
    kind: 'legal-document',
    status: 'partial',
    title: 'La respuesta laboral depende del vínculo real, la registración y la forma de extinción',
    directAnswer: 'Para determinar qué corresponde reclamar no alcanza con el nombre del contrato. Hay que revisar cómo se prestaron realmente las tareas, quién daba instrucciones, horarios, pagos, registración, antigüedad, categoría, convenio colectivo y las comunicaciones intercambiadas. Si hubo despido o ruptura, también importan la causa invocada, la fecha y la forma de notificación. Con esos datos puede evaluarse si existen diferencias salariales, créditos indemnizatorios, multas, prestaciones de seguridad social o reclamos por accidente, sin mezclar el caso con una deuda civil o un conflicto comercial.',
    findings: [
      ...analysis.issues.map((issue) => `${issue.label}: ${issue.explanation}`),
      'La denominación “contratista”, “monotributista” o “prestador” no resuelve por sí sola si existió una relación laboral.',
      'Los plazos, rubros y procedimiento dependen de la jurisdicción, el régimen aplicable y las fechas concretas.',
    ],
    nextActions: [
      'Reunir recibos, transferencias, alta o baja registral, mensajes, horarios, instrucciones, tareas, categoría y convenio colectivo.',
      'Conservar telegramas, cartas documento y cualquier comunicación de despido, renuncia, intimación o sanción.',
      ...analysis.sourceTargets.map((source) => `Contrastar con ${source}.`),
      'Verificar de inmediato los plazos de la jurisdicción antes de enviar una intimación o aceptar una liquidación final.',
    ],
    limitations: analysis.factsNeeded.map((fact) => `Falta precisar: ${fact}.`),
  };
}

function buildTaxAnswer(analysis: ArgentinaLegalAnalysis): CustomerDecisionAnswer {
  return {
    kind: 'legal-document',
    status: 'needs-verification',
    title: 'El reclamo tributario debe revisarse por impuesto, período, jurisdicción y etapa procesal',
    directAnswer: 'No puede confirmarse una deuda fiscal ni recomendar un recurso sin identificar el tributo, el período, el organismo, el acto recibido y su fecha de notificación. Primero debe distinguirse si se trata de una fiscalización, determinación de oficio, multa, intimación, ejecución o simple comunicación. Después corresponde controlar base imponible, alícuota, pagos, retenciones, intereses, competencia del organismo y plazo disponible para responder. Una cifra o la palabra “deuda” no deben convertir este análisis en una financiación.',
    findings: [
      ...analysis.issues.map((issue) => `${issue.label}: ${issue.explanation}`),
      'La normativa aplicable puede cambiar según sea un tributo nacional, provincial o municipal y según el período fiscal involucrado.',
      'La fecha de notificación es crítica porque determina qué vía y qué plazo pueden seguir disponibles.',
    ],
    nextActions: [
      'Guardar el acto completo, constancia de notificación, declaraciones juradas, papeles de trabajo, pagos, retenciones y presentaciones previas.',
      'Separar capital, intereses, multa y costas, y verificar cómo fue calculado cada concepto.',
      ...analysis.sourceTargets.map((source) => `Contrastar con ${source}.`),
      'Antes de consentir, pagar o recurrir, confirmar la vía y el plazo aplicables al organismo y jurisdicción concretos.',
    ],
    limitations: analysis.factsNeeded.map((fact) => `Falta precisar: ${fact}.`),
  };
}

function buildCivilAnswer(analysis: ArgentinaLegalAnalysis): CustomerDecisionAnswer {
  return {
    kind: 'legal-document',
    status: 'partial',
    title: 'El reclamo civil debe separar el derecho invocado, el incumplimiento y la prueba del perjuicio',
    directAnswer: 'Para evaluar un reclamo civil hay que identificar primero qué obligación, derecho o deber se considera incumplido. Después corresponde precisar quién debía cumplir, cuándo, de qué manera y qué prueba existe. Si además se reclaman daños, deben analizarse por separado el perjuicio concreto, su cuantificación, la relación causal y las defensas posibles. Según el caso, la solución puede ser exigir cumplimiento, resolver el contrato, obtener restitución, pedir reparación o cuestionar una ejecución; no todos esos remedios son acumulables ni requieren la misma prueba.',
    findings: [
      ...analysis.issues.map((issue) => `${issue.label}: ${issue.explanation}`),
      'La existencia de una deuda, un contrato o un daño alegado no demuestra por sí sola que el reclamo sea exigible ni cuál sea su monto.',
      'Consumo, seguros, sucesiones y locaciones pueden tener normas especiales además del Código Civil y Comercial.',
    ],
    nextActions: [
      'Reunir contrato, anexos, comprobantes, comunicaciones, intimaciones y evidencia del cumplimiento propio y del incumplimiento ajeno.',
      'Separar capital, intereses, penalidades, daños y gastos, explicando el fundamento y la prueba de cada concepto.',
      ...analysis.sourceTargets.map((source) => `Contrastar con ${source}.`),
      'Verificar jurisdicción, competencia, prescripción, mediación previa y medidas cautelares antes de iniciar el reclamo.',
    ],
    limitations: analysis.factsNeeded.map((fact) => `Falta precisar: ${fact}.`),
  };
}

function buildAdministrativeAnswer(analysis: ArgentinaLegalAnalysis): CustomerDecisionAnswer {
  return {
    kind: 'legal-document',
    status: 'needs-verification',
    title: 'El caso administrativo depende del acto, la notificación, el expediente y la vía disponible',
    directAnswer: 'Antes de afirmar que una decisión estatal es válida o impugnarla hay que identificar el organismo, el acto completo, su fundamento, la competencia de quien lo dictó y la fecha y forma de notificación. También debe revisarse el expediente, la prueba ofrecida, si se dio posibilidad de defensa y qué recurso administrativo o vía judicial corresponde. La palabra “multa”, “resolución” o “rechazo” no alcanza para elegir el procedimiento ni calcular el plazo.',
    findings: [
      ...analysis.issues.map((issue) => `${issue.label}: ${issue.explanation}`),
      'El régimen nacional no debe aplicarse automáticamente a una provincia o municipio: cada jurisdicción puede tener su propia ley de procedimiento y plazos.',
      'La presentación equivocada o tardía puede afectar la revisión, por lo que la constancia de notificación es un dato central.',
    ],
    nextActions: [
      'Obtener copia íntegra del acto, expediente, dictámenes, informes, prueba y constancia de notificación.',
      'Identificar autoridad que dictó el acto, superior jerárquico, recurso previsto, efecto del recurso y plazo aplicable.',
      ...analysis.sourceTargets.map((source) => `Contrastar con ${source}.`),
      'Evaluar si corresponde pedir vista, suspensión, medida cautelar o pronto despacho antes de avanzar por otra vía.',
    ],
    limitations: analysis.factsNeeded.map((fact) => `Falta precisar: ${fact}.`),
  };
}

function buildFamilyAnswer(analysis: ArgentinaLegalAnalysis): CustomerDecisionAnswer {
  return {
    kind: 'legal-document',
    status: 'partial',
    title: 'El caso de familia debe organizarse según vínculos, centro de vida, acuerdos y medidas vigentes',
    directAnswer: 'La respuesta depende del tema concreto: divorcio, cuidado personal, comunicación, filiación, vivienda, bienes, compensación económica o protección urgente. Cuando hay niñas, niños o adolescentes, deben identificarse su centro de vida, necesidades, modalidad actual de cuidados y cualquier acuerdo o medida vigente. También corresponde separar los asuntos personales de los patrimoniales, porque no tienen necesariamente el mismo trámite, prueba ni urgencia.',
    findings: [
      ...analysis.issues.map((issue) => `${issue.label}: ${issue.explanation}`),
      'Un acuerdo informal puede ser evidencia relevante, pero su alcance y exigibilidad dependen del contenido, la materia y su eventual homologación.',
      'La existencia de violencia, riesgo, traslado, ocultamiento de bienes o incumplimiento de una medida puede requerir una respuesta urgente y distinta del trámite principal.',
    ],
    nextActions: [
      'Reunir partidas, acuerdos, resoluciones, denuncias, comunicaciones, comprobantes de gastos y documentación de bienes y deudas.',
      'Precisar domicilio, centro de vida, modalidad de cuidados, régimen vigente y toda audiencia o plazo próximo.',
      ...analysis.sourceTargets.map((source) => `Contrastar con ${source}.`),
      'Separar las medidas urgentes de las pretensiones definitivas y verificar el procedimiento de familia de la jurisdicción.',
    ],
    limitations: analysis.factsNeeded.map((fact) => `Falta precisar: ${fact}.`),
  };
}

function buildSuccessionAnswer(analysis: ArgentinaLegalAnalysis): CustomerDecisionAnswer {
  return {
    kind: 'legal-document',
    status: 'partial',
    title: 'La herencia depende de quiénes sobreviven, qué bienes existen y si hay testamento',
    directAnswer: 'La distribución no puede calcularse sólo por el parentesco mencionado. Primero hay que identificar descendientes, ascendientes, cónyuge y, si faltan herederos de órdenes preferentes, otros parientes; después deben revisarse testamento, legítimas, donaciones, deudas y el carácter propio o ganancial de cada bien. Si una persona casada muere sin testamento y deja cónyuge e hijos, primero se liquidan los gananciales: el cónyuge conserva su mitad y la mitad del fallecido se transmite a los hijos. Sobre los bienes propios, el cónyuge hereda la misma porción que cada hijo. Ejemplo: con viuda y dos hijos, un bien propio se divide en tercios; en un bien ganancial, la viuda conserva 50% y cada hijo recibe 25%.',
    findings: [
      'Artículo 2426: los hijos heredan por derecho propio y por partes iguales, salvo representación de descendientes.',
      'Artículo 2433: cuando concurre con descendientes, el cónyuge recibe en los bienes propios una parte igual a la de un hijo.',
      'El mismo artículo 2433 excluye al cónyuge de la división de los gananciales que correspondían al causante; antes debe separarse la mitad propia del cónyuge por la liquidación del régimen matrimonial.',
      'Las deudas y cargas de la sucesión se determinan antes de conocer el valor neto que finalmente se parte.',
      'Un testamento no permite desconocer sin más las porciones legítimas protegidas; debe revisarse junto con donaciones y actos anteriores.',
      'Si no hay descendientes, cambia el orden y la concurrencia de ascendientes, cónyuge y colaterales; no debe reutilizarse el ejemplo de viuda e hijos.',
      ...analysis.issues.map((issue) => `${issue.label}: ${issue.explanation}`),
    ],
    nextActions: [
      'Clasificar cada bien como propio o ganancial y reunir títulos, fechas de adquisición y origen de los fondos.',
      'Confirmar cantidad y vínculo de todos los descendientes, estado matrimonial al fallecimiento y si existía separación de hecho.',
      'Verificar testamento, donaciones, deudas, cargas y último domicilio del causante antes de calcular porcentajes definitivos.',
      ...analysis.sourceTargets.map((source) => `Contrastar con ${source}.`),
      'Iniciar o revisar el proceso sucesorio en la jurisdicción del último domicilio del causante.',
    ],
    limitations: analysis.factsNeeded.map((fact) => `Falta precisar: ${fact}.`),
  };
}

function buildCriminalAnswer(analysis: ArgentinaLegalAnalysis): CustomerDecisionAnswer {
  return {
    kind: 'legal-document',
    status: 'needs-verification',
    title: 'La calificación penal depende de una conducta concreta, evidencia y circunstancias legalmente relevantes',
    directAnswer: 'No puede afirmarse que existió un delito ni indicar una pena solamente por una descripción breve o por palabras como “estafa”, “amenaza” o “robo”. Hay que reconstruir qué ocurrió, quién intervino, con qué intención, qué evidencia existe, cuándo y dónde sucedió y si concurren agravantes, tentativa, participación u otras circunstancias. También debe distinguirse una denuncia penal de un incumplimiento civil o comercial: que una parte no cumpla un contrato no convierte automáticamente el conflicto en delito.',
    findings: [
      ...analysis.issues.map((issue) => `${issue.label}: ${issue.explanation}`),
      'La calificación jurídica y la escala penal dependen de hechos probados, no del nombre coloquial usado por quien consulta.',
      'La preservación de evidencia y los riesgos actuales para personas o bienes pueden ser más urgentes que definir inicialmente el artículo aplicable.',
    ],
    nextActions: [
      'Ordenar una cronología y conservar mensajes, documentos, comprobantes, archivos originales, testigos y datos de identificación.',
      'Precisar conducta, intención atribuida, resultado, lugar, fecha, personas afectadas, agravantes y medidas ya adoptadas.',
      ...analysis.sourceTargets.map((source) => `Contrastar con ${source}.`),
      'Si existe peligro actual o riesgo de pérdida de evidencia, acudir de inmediato a la autoridad o asistencia profesional competente.',
    ],
    limitations: analysis.factsNeeded.map((fact) => `Falta precisar: ${fact}.`),
  };
}

function buildCommercialAnswer(analysis: ArgentinaLegalAnalysis): CustomerDecisionAnswer {
  return {
    kind: 'legal-document',
    status: 'partial',
    title: 'El análisis comercial depende del vehículo jurídico, las partes, la documentación y la situación patrimonial',
    directAnswer: 'Primero debe identificarse si el conflicto corresponde a una sociedad, un acuerdo entre empresas, un título de crédito, una garantía, una operación comercial o una situación concursal. Después hay que revisar quién asumió cada obligación, la representación y facultades de quienes firmaron, vencimientos, registraciones, garantías, contabilidad y comunicaciones. Si existe insolvencia o cesación de pagos, el análisis cambia porque el cobro individual puede quedar condicionado por el proceso concursal.',
    findings: [
      ...analysis.issues.map((issue) => `${issue.label}: ${issue.explanation}`),
      'La personalidad jurídica de la sociedad y la responsabilidad de administradores, socios o garantes no deben confundirse.',
      'Una factura, cheque, pagaré, acta o contrato produce efectos distintos y exige controles propios antes de reclamar.',
    ],
    nextActions: [
      'Reunir contratos, anexos, facturas, títulos, garantías, actas, poderes, registraciones y comunicaciones relevantes.',
      'Verificar representación, vencimiento, mora, jurisdicción, solvencia, procesos concursales y medidas cautelares posibles.',
      ...analysis.sourceTargets.map((source) => `Contrastar con ${source}.`),
      'Definir si se busca cumplimiento, cobro ejecutivo, responsabilidad societaria, impugnación de una decisión o verificación de crédito.',
    ],
    limitations: analysis.factsNeeded.map((fact) => `Falta precisar: ${fact}.`),
  };
}

function buildLegalDebtEnforcementAnswer(analysis: ArgentinaLegalAnalysis): CustomerDecisionAnswer {
  return {
    kind: 'legal-document',
    status: 'partial',
    title: 'El embargo y los intereses pueden corresponder, pero deben surgir de una ejecución válida',
    directAnswer: 'Puede estar bien, pero no se puede confirmar solamente con esos datos. Si los honorarios fueron regulados judicialmente y la regulación quedó firme, o si existe un convenio exigible, la falta de pago puede generar intereses y dar lugar a una ejecución judicial. El embargo de una cuenta bancaria debe provenir de una orden judicial y limitarse al crédito reclamado, sus intereses y costas. Para saber si en tu caso es correcto hay que revisar el expediente, la regulación o convenio, la notificación, la liquidación de capital e intereses y el monto efectivamente embargado.',
    findings: [
      'En la justicia nacional y federal, los honorarios regulados judicialmente deben pagarse dentro de los diez días de quedar firme la resolución regulatoria; su cobro tramita por ejecución de sentencia.',
      'La mora puede generar intereses, pero la tasa y el período deben surgir de la regulación, la ley aplicable o la decisión judicial y deben poder controlarse.',
      'Un embargo no prueba por sí mismo que toda la liquidación sea correcta ni impide cuestionar un exceso, un cálculo erróneo o fondos legalmente protegidos.',
    ],
    nextActions: [
      'Pedir copia de la resolución que reguló los honorarios, la constancia de que quedó firme, la intimación de pago y la orden de embargo.',
      'Solicitar una liquidación separada de capital, tasa aplicada, fecha inicial, intereses y costas, y compararla con el monto inmovilizado.',
      'Verificar qué tribunal y jurisdicción intervienen, porque la Ley 27.423 rige para asuntos nacionales y federales y las provincias tienen normas propias.',
      'Consultar de inmediato a otro profesional si el plazo para impugnar la liquidación o pedir reducción/sustitución del embargo sigue corriendo.',
    ],
    limitations: [
      'Falta conocer la jurisdicción, el expediente, el origen de los honorarios, la firmeza de la regulación, las notificaciones y la liquidación practicada.',
      ...analysis.factsNeeded.map((fact) => `Falta precisar: ${fact}.`),
    ],
  };
}

function buildLeasingAnswer(selectedCategory: string | undefined, question: string): CustomerDecisionAnswer {
  const kind: CustomerDecisionAnswer['kind'] = selectedCategory === 'finance-credit'
    ? 'financial-product-comparison'
    : selectedCategory === 'investment-project'
      ? 'investment-project'
      : selectedCategory === 'scam-risk'
        ? 'scam-prevention'
        : selectedCategory === 'leasing-specialist'
          ? 'leasing-specialist'
          : 'legal-document';
  const focus = selectedCategory === 'finance-credit'
    ? 'Para compararlo con un préstamo hay que llevar ambos a un mismo flujo después de impuestos: anticipo, cánones, IVA, comisiones, seguros, mantenimiento, opción de compra, costo del crédito alternativo y valor residual.'
    : selectedCategory === 'investment-project'
      ? 'Para decidir una inversión hay que medir el costo de uso del activo, ahorro fiscal efectivo, productividad, mantenimiento, obsolescencia, opción de compra y valor residual frente a comprar con capital o deuda.'
      : selectedCategory === 'scam-risk'
        ? 'La existencia de un leasing no acredita que la oferta sea legítima: deben verificarse el dador, la titularidad del bien, el contrato, la inscripción, los pagos y las condiciones de recuperación y compra.'
        : 'Jurídicamente deben revisarse el bien, canon, opción de compra, responsabilidades, inscripción, seguros, mantenimiento, mora, restitución y jurisdicción; la conveniencia económica e impositiva se informa por separado.';
  const currentTaxRule = leasingKnowledge('tax')[0].statement;
  const publicSectorRules = leasingKnowledge('public-sector').map((item) => item.statement);
  const internationalFindings = buildInternationalLeasingFindings(question);
  const normalizedQuestion = question.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const isLeaseBack = /lease[ -]?back|retro(?:leasing|arrendamiento)|venta\s+(?:y|con)\s+(?:posterior\s+)?leasing/i.test(question);
  const numericField = (label: string) => {
    const match = question.match(new RegExp(`${label}:\\s*([\\d.,]+)`, 'i'));
    if (!match) return null;
    const normalized = match[1].replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
  };
  const assetValue = numericField('Valor del bien sin IVA') ?? numericField('Valor del bien');
  const financedPercent = numericField('Porcentaje financiado');
  const months = numericField('Plazo');
  const tna = numericField('TNA');
  const optionPercentField = numericField('Opción de compra porcentual');
  const optionAmountField = numericField('Opción de compra importe fijo');
  const optionPercent = optionPercentField !== null
    ? optionPercentField
    : assetValue && optionAmountField !== null
      ? optionAmountField / assetValue * 100
      : null;
  const guaranteeCanons = numericField('Cánones de garantía recibidos al inicio y aplicados a las últimas cuotas');
  const structuringFeePercent = numericField('Gasto de estructuración');
  const quoteData = extractLeasingQuoteData(question);
  const financeResult = assetValue && financedPercent && months && tna !== null && optionPercent !== null && guaranteeCanons !== null && structuringFeePercent !== null
    ? calculateFinancialLeasing({ assetValue, financedPercent, months, annualNominalRatePercent: tna, optionPercent, guaranteeCanons, structuringFeePercent })
    : null;
  const amount = (value: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value);
  const decimal = (value: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 4 }).format(value);
  const quoteFindings = quoteData ? [
    `Cotización detectada${quoteData.assetDescription ? ` para ${quoteData.assetDescription}` : ''}: los datos económicos se tomaron del archivo y prevalecen sobre los valores iniciales del formulario.`,
    quoteData.assetValueNet !== undefined ? `Valor del bien sin IVA: ${amount(quoteData.assetValueNet)}.${quoteData.vatAmount !== undefined ? ` IVA informado por separado: ${amount(quoteData.vatAmount)}.` : ''}${quoteData.assetValueVatIncluded !== undefined ? ` Total con IVA: ${amount(quoteData.assetValueVatIncluded)}.` : ''}` : '',
    quoteData.regularCanonCount !== undefined && quoteData.regularCanonAmount !== undefined ? `Flujo cotizado: ${quoteData.regularCanonCount} cánones de ${amount(quoteData.regularCanonAmount)}${quoteData.months ? ` dentro de un plazo contractual de ${quoteData.months} meses` : ''}.` : '',
    quoteData.optionAmount !== undefined ? `Opción de compra cotizada: ${amount(quoteData.optionAmount)} al final del contrato.` : '',
    quoteData.maxiCanonAmount !== undefined ? `Maxi canon o adelanto informado: ${amount(quoteData.maxiCanonAmount)}.` : '',
    quoteData.guaranteeCanons !== undefined ? `Cánones de garantía: ${quoteData.guaranteeCanons}${quoteData.guaranteeAmount !== undefined ? `, por un depósito total informado de ${amount(quoteData.guaranteeAmount)}` : ''}. Si se aplican a los últimos cánones, no deben contarse dos veces en el flujo.` : '',
    quoteData.structuringFeePercent !== undefined ? `Comisión de estructuración: ${decimal(quoteData.structuringFeePercent)}% más los impuestos que correspondan. Debe confirmarse la base exacta antes de convertirla en un monto.` : '',
    `Seguro: se modela por defecto como contratado y pagado por el dador, que lo refactura mensualmente al tomador como concepto separado del canon financiero.${quoteData.insuranceText ? ` La cotización indica: “${quoteData.insuranceText}”.` : ''} Si el contrato establece otra mecánica, prevalece el contrato.`,
    'La cotización permite omitir el formulario económico. Sólo deben completarse los datos que el archivo no informe, especialmente perfil fiscal del tomador, uso del bien, jurisdicciones y condiciones especiales.',
  ].filter(Boolean) : [];
  const financialCaseFindings = quoteData ? quoteFindings : financeResult ? [
    'Caso práctico: leasing financiero calculado con sistema francés (canon periódico constante antes de impuestos y servicios), descontando del capital el valor presente de la opción.',
    `Valor neto sin IVA financiado: ${amount(financeResult.financedAmount)} (${financedPercent}% del bien). Aporte inicial neto no financiado: ${amount(financeResult.initialContribution)}. El IVA se analiza por separado y no está duplicado en este capital.`,
    `Canon financiero mensual estimado: ${amount(financeResult.monthlyCanon)} durante ${months} meses. Opción pactada usada en el cálculo: ${amount(financeResult.optionAmount)}${optionAmountField !== null ? ' como importe fijo' : ` (${optionPercentField}% del bien)`}.`,
    `Cánones de garantía al inicio: ${guaranteeCanons}; depósito estimado: ${amount(financeResult.guaranteeDeposit)}. Se aplica contra las últimas cuotas y no se cuenta otra vez como cobro; la facturación y los impuestos se reconocen al momento contractual aplicable.`,
    `Gasto de estructuración: ${decimal(structuringFeePercent)}% del valor financiado, equivalente a ${amount(financeResult.structuringFee)}. Debe confirmarse si se paga aparte, se financia o lleva IVA.`,
    financeResult.lessorEffectiveAnnualIrrPercent === null ? 'No pudo determinarse una TIR única del dador con este flujo.' : `TIR estimada del dador incorporando garantía y gasto inicial: ${financeResult.lessorMonthlyIrrPercent?.toFixed(3)}% mensual; ${(financeResult.lessorEffectiveAnnualIrrPercent).toFixed(3)}% efectiva anual. No incluye IVA ni impuestos no cuantificados.`,
  ] : [
    'Para calcular el caso práctico faltan uno o más datos: valor del bien, porcentaje financiado, plazo, TNA, opción, cánones de garantía o gasto de estructuración. El sistema usa leasing financiero y sistema francés sólo cuando esos campos están completos.',
  ];
  const profilesToReport = PROVINCIAL_LEASING_STAMP_MATRIX.filter((item) =>
    item.jurisdiction === 'Buenos Aires'
      ? normalizedQuestion.replaceAll('ciudad autonoma de buenos aires', '').includes('buenos aires')
      : normalizedQuestion.includes(item.jurisdiction.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())
  );
  const assetKind = /auto|veh[ií]cul|camion|pickup|utilitario/i.test(question)
    ? 'automotor'
    : /maquinaria|equipo|industrial|agr[ií]col/i.test(question)
      ? 'maquinaria o equipo'
      : /inmueble|galp[oó]n|oficina|local|campo/i.test(question)
        ? 'inmueble'
        : /barco|buque|embarcaci[oó]n|naval/i.test(question)
          ? 'embarcación'
          : /avi[oó]n|aeronave/i.test(question)
            ? 'aeronave'
            : 'bien no informado';
  const expenseMap = [
    'Precio financiero: maxi canon o anticipo, cánones, tasa o margen, comisiones y valor de la opción de compra. Deben mostrarse por separado y también como flujo total.',
    'IVA: revisar su incidencia en maxi canon, cánones, servicios y opción; el crédito fiscal sólo existe si el tomador está inscripto, el bien se afecta a actividad gravada y existe documentación válida.',
    ...profilesToReport.flatMap((item) => {
      const jurisdictionLines = [
        `${item.jurisdiction} — Sellos: ${item.stampRatePercent === undefined ? 'porcentaje pendiente de verificación' : `${item.stampRatePercent}%`}${item.stampRateCondition ? ` (${item.stampRateCondition})` : ''}.`,
        `${item.jurisdiction} — Ingresos Brutos del dador: ${item.grossIncomeRatePercent === undefined ? 'incidencia no cuantificada' : `${item.grossIncomeRatePercent}% para la actividad 649100`}. Salvo cláusula expresa de reintegro o facturación separada, se considera incluido en la tasa, margen, cánones u otros gastos y no se suma otra vez.`,
      ];
      if (item.exemptions.length) jurisdictionLines.push(`${item.jurisdiction} — Beneficios o exenciones verificadas/condicionadas: ${item.exemptions.join(' ')}`);
      else jurisdictionLines.push(`${item.jurisdiction} — Exenciones: no hay una exención confirmada para aplicar automáticamente al caso.`);
      return jurisdictionLines;
    }),
    `Registración de ${assetKind}: arancel registral, certificaciones, informes, alta o radicación y gestoría. Para automotores corresponde DNRPA; embarcaciones, Prefectura Naval; aeronaves, Registro Nacional de Aeronaves.`,
    'Uso durante el contrato: patente o tributo de radicación, seguro, mantenimiento, reparaciones, inspecciones, guarda, multas y tasas locales según el bien y la cláusula contractual.',
    'Finalización: gastos de cancelación o inscripción, ejercicio de la opción, transferencia de dominio y tributos propios de esa transferencia. El impuesto pagado sobre cánones sólo se toma a cuenta cuando la norma provincial lo permite.',
  ];
  const assetTaxBenefits = assetKind === 'maquinaria o equipo'
    ? [
        'Beneficio fiscal potencial del bien: si se afecta a una actividad gravada, los cánones pueden tener incidencia en Ganancias conforme el encuadre del contrato y el IVA facturado puede generar crédito fiscal para un responsable inscripto. Para el tratamiento financiero del Decreto 1038/2000 actualizado, los bienes muebles deben cumplir, entre otros requisitos, una duración mínima equivalente al 50% de su vida útil fiscal.',
        'Maquinaria productiva: revisar beneficios provinciales específicos de Sellos, inscripción o transferencia; no extender a toda maquinaria una exención prevista sólo para determinadas categorías o actividades.',
      ]
    : assetKind === 'automotor'
      ? [
          'Beneficio fiscal potencial del bien: el uso empresarial puede permitir incidencia de cánones en Ganancias y crédito fiscal de IVA, sujeto a afectación, documentación y a las limitaciones legales específicas de automóviles. Utilitarios, camiones y vehículos productivos pueden tener tratamientos distintos de un automóvil de uso personal.',
          'Automotor: verificar por separado beneficio o exención en la adquisición inicial, Sellos del contrato, patente durante el uso y tasa de la opción/transferencia. La exención de una etapa no exime las demás.',
        ]
      : assetKind === 'inmueble'
        ? [
            'Beneficio fiscal potencial del bien: el Decreto 1038/2000 actualizado exige para inmuebles una duración mínima equivalente al 10% de su vida útil fiscal, además de los demás requisitos. Deben separarse cánones, IVA si corresponde, Sellos, tributos inmobiliarios y transferencia por opción.',
            'Inmueble productivo: pueden existir beneficios en parques o agrupamientos industriales, pero sólo se aplican si la ubicación, destino y reconocimiento oficial cumplen la norma provincial concreta.',
          ]
        : assetKind === 'embarcación'
          ? [
              'Beneficio fiscal potencial del bien: depende de su afectación a actividad gravada, del encuadre como bien mueble y de las limitaciones aplicables. Deben verificarse IVA, Ganancias, tasas de Prefectura Naval, matrícula, seguros y la transferencia por opción.',
            ]
          : assetKind === 'aeronave'
            ? [
                'Beneficio fiscal potencial del bien: depende de la afectación empresarial, encuadre como bien mueble, documentación y limitaciones de IVA y Ganancias. Deben agregarse matrícula y aranceles aeronáuticos, seguros, mantenimiento obligatorio y transferencia por opción.',
              ]
            : [
                'Beneficios fiscales según el bien: todavía no pueden determinarse. Indicá si es automotor, maquinaria, inmueble, embarcación o aeronave; cada uno tiene límites, registros, tributos y posibles exenciones diferentes.',
              ];
  const distinctiveAdvantages = [
    'Puede financiar una proporción alta del bien y, según la oferta, también ciertos gastos asociados, reduciendo el capital inicial frente a una compra con préstamo que exige anticipo.',
    'El propio bien permanece en dominio del dador y funciona como soporte principal de la operación; esto puede reducir la necesidad de hipoteca, prenda u otras garantías adicionales, aunque el dador puede exigirlas.',
    'Permite diseñar maxi canon, cánones y opción según generación de ingresos, estacionalidad y valor residual del activo; un préstamo tradicional suele amortizar capital e intereses con una estructura menos vinculada al uso del bien.',
    'En responsables inscriptos con actividad gravada, el IVA de los cánones puede distribuirse durante el contrato en lugar de concentrarse en la compra inicial, sujeto a facturación y encuadre. Para consumidores o monotributistas ese crédito fiscal no existe.',
    'En Ganancias puede producir un perfil de deducción diferente de comprar y amortizar el activo, si cumple el Decreto 1038/2000 actualizado y el destino empresarial. No se promete ahorro: debe compararse el valor presente después de impuestos.',
    'La opción permite decidir al final si adquirir el activo; puede ser valiosa frente a obsolescencia, pero pierde fuerza cuando la opción es económicamente obligatoria o el costo de salida es alto.',
    'No debe venderse como ventaja la antigua idea de que todo leasing queda fuera del balance: la exposición contable depende de las normas aplicables, incluida NIIF 16 cuando corresponda.',
  ];
  const humanPersonComparison = [
    'Persona humana: mientras no se ejerza la opción y se transmita el dominio, el bien pertenece al dador; por eso el bien subyacente no integra el patrimonio del tomador a declarar en Bienes Personales. Al ejercer la opción debe analizarse su incorporación desde la transmisión y la situación fiscal concreta.',
    'Financiación: una oferta de leasing puede cubrir hasta el 100% del valor neto del bien, sujeto a evaluación crediticia y condiciones del dador. Un préstamo prendario normalmente exige integración inicial o financia un porcentaje menor, aunque no existe una prohibición legal universal que impida financiar el 100%.',
    'Costos de la prenda a comparar: anticipo no financiado, interés y CFT, comisión de otorgamiento, IVA sobre prestaciones gravadas, Sellos según jurisdicción, inscripción y posteriores modificaciones de la prenda, seguro, informes, certificaciones, gestoría y cancelación. También debe computarse que el comprador adquiere y registra el dominio desde el inicio.',
    'Ventaja patrimonial potencial del leasing para uso personal: permite usar el bien sin adquirir inicialmente el dominio y difiere la decisión de compra. No genera por sí solo crédito fiscal de IVA ni deducción de Ganancias para consumo personal, y el contrato puede trasladar al tomador seguro, patente, mantenimiento, impuestos y tasas.',
  ];
  const leasingTypeAndOptionRules = [
    'Leasing contractual argentino (CCyC): para quedar bajo los artículos 1227 y siguientes debe existir una opción de compra a favor del tomador. El precio debe estar fijado en el contrato o ser determinable por procedimientos o pautas pactadas; también deben revisarse el momento habilitado para ejercerla y sus efectos.',
    'Leasing financiero: el dador financia sustancialmente la adquisición y recupera capital, costo financiero y margen mediante maxi canon/cánones y opción. Una opción residual baja puede hacer probable la compra, pero no debe suponerse sin leer el flujo; se compara el costo total incluyendo opción y transferencia.',
    'Leasing operativo: prioriza disponibilidad, servicios, mantenimiento, renovación o devolución y suele conservar mayor riesgo residual en el proveedor. Si no hay una verdadera opción de compra, puede tratarse económicamente o jurídicamente como locación y no debe recibir automáticamente los beneficios del leasing financiero.',
    'Lease-back: el futuro tomador vende su activo al dador y lo recibe en leasing. Deben agregarse los impuestos y gastos de la venta inicial, analizar sustancia económica y luego los cánones y la eventual recompra; no equivale a un préstamo garantizado sólo por cambiarle el nombre.',
    'Control de la opción: informar valor o fórmula, fecha habilitada, IVA, Sellos o impuesto de transferencia, arancel registral, deuda previa, condición del bien y crédito por Sellos pagado sobre cánones cuando la provincia lo admita.',
  ];
  const leaseBackRules = isLeaseBack ? [
    'Estructura: el propietario vende un activo propio al dador y, dentro de la misma operación o vinculada a ella, lo recibe en leasing para continuar usándolo. Convierte un activo inmovilizado en liquidez sin interrumpir su explotación, pero incorpora una venta inicial real, cánones y una eventual recompra.',
    'Aforo: no existe un porcentaje legal único. El dador parte del menor entre valor de mercado, valor de realización y tasación aceptada, y aplica su política de riesgo según liquidez, antigüedad, estado, vida útil, obsolescencia, registro y facilidad de recupero. Debe informarse por separado valor tasado, porcentaje aforado y desembolso neto.',
    'Desembolso neto: del precio aforado pueden descontarse cancelaciones de prendas o deudas, comisión, Sellos, gastos registrales, seguros, impuestos y reservas. Por eso el porcentaje sobre la tasación no equivale al efectivo que recibe el tomador.',
    'Plazo comercial: debe ser compatible con la vida útil remanente y la capacidad de repago. No hay un plazo contractual universal; el simulador debe pedir antigüedad del bien, vida útil, plazo propuesto, cantidad de cánones, opción y garantías.',
    'Tratamiento fiscal nacional: el artículo 26 del Decreto 1038/2000 trata el lease-back como operación financiera. En Ganancias del tomador no se deduce automáticamente el canon completo: para bienes afectados a ganancias gravadas, la deducción se determina sobre la diferencia entre cánones más opción y el valor de transferencia al dador, distribuida según vencimientos.',
    'Beneficios fiscales: no deben trasladarse sin más los beneficios publicitados para un leasing de adquisición. Hay que analizar la venta inicial del activo, su resultado impositivo, IVA según bien y sujeto, Sellos, tasas de transferencia/registro y el tratamiento financiero posterior. Puede existir una ventaja de liquidez, pero no una exención fiscal automática.',
    'Control anti-sobrevaloración: comparar tasación independiente, valor contable e impositivo, precio de venta, aforo y valor residual. Una valuación alta aumenta liquidez inicial pero también el flujo a devolver y puede generar contingencias fiscales o crediticias.',
  ] : [];
  const comparableStampRates = profilesToReport.filter((item) => item.stampRatePercent !== undefined);
  const percentageIncidence = profilesToReport.flatMap((item) => {
    const lines: string[] = [];
    if (item.stampRatePercent !== undefined) {
      lines.push(`${item.jurisdiction} — Sellos del contrato: ${item.stampRatePercent}%. Incidencia directa o trasladable según la obligación legal y la cláusula fiscal; la base es la prevista para el instrumento, no los ingresos del dador.`);
    }
    if (item.grossIncomeRatePercent !== undefined) {
      lines.push(`${item.jurisdiction} — Ingresos Brutos del dador (actividad 649100): ${item.grossIncomeRatePercent}%. El contribuyente legal es el dador, pero puede recuperar total o parcialmente el costo en el canon, maxi canon, tasa, comisiones u opción. Regla de cálculo: salvo que la oferta o el contrato manifiesten expresamente que se factura o reintegra aparte, se presume incorporado en la tasa, el margen, los cánones u otros gastos cobrados al tomador y no se vuelve a sumar. “No discriminado” no significa “sin incidencia económica”. No equivale necesariamente a adicionar ${item.grossIncomeRatePercent}% a cada canon.`);
    }
    return lines;
  });
  const stampComparison = comparableStampRates.length > 1
    ? `Comparación preliminar de Sellos del contrato: ${comparableStampRates.map((item) => `${item.jurisdiction} ${item.stampRatePercent}%${item.stampRateCondition ? ` (${item.stampRateCondition})` : ''}`).join('; ')}. La menor tasa nominal no define por sí sola el escenario más barato: faltan inscripción, patente anual, opción de compra y verificar que la jurisdicción alternativa sea legalmente utilizable.`
    : '';
  const comparableGrossIncomeRates = profilesToReport.filter((item) => item.grossIncomeRatePercent !== undefined);
  const grossIncomeComparison = comparableGrossIncomeRates.length
    ? `Ingresos Brutos de la actividad del dador: ${comparableGrossIncomeRates.map((item) => `${item.jurisdiction} ${item.grossIncomeRatePercent}%`).join('; ')}. Es razonable analizar su traslado económico al tomador, pero la alícuota no se suma automáticamente como impuesto directo: debe revisarse la base imponible del dador y cómo fue incorporada al precio.`
    : '';
  const shortCell = (value: string, fallback: string) => {
    const compact = value.replace(/\s+/g, ' ').trim();
    if (!compact) return fallback;
    const firstSentence = compact.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || compact;
    return firstSentence.length > 150 ? `${firstSentence.slice(0, 147).trimEnd()}…` : firstSentence;
  };
  const jurisdictionRole = (jurisdiction: string) => {
    const normalizedJurisdiction = jurisdiction.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const roles: string[] = [];
    if (normalizedQuestion.includes(`domicilio de uso del cliente: ${normalizedJurisdiction}`)
      || normalizedQuestion.includes(`jurisdiccion del tomador y del contrato: ${normalizedJurisdiction}`)
      || normalizedQuestion.includes(`provincia de uso, guarda y radicacion del bien: ${normalizedJurisdiction}`)) roles.push('Uso del cliente');
    if (normalizedQuestion.includes(`jurisdiccion legal de quien financia: ${normalizedJurisdiction}`)
      || normalizedQuestion.includes(`domicilio o lugar de presentacion fiscal del dador: ${normalizedJurisdiction}`)
      || normalizedQuestion.includes(`domicilio del dador: ${normalizedJurisdiction}`)) roles.push('Financiador');
    if (normalizedQuestion.includes(`provincia alternativa de uso para comparar: ${normalizedJurisdiction}`)
      || normalizedQuestion.includes(`comparar la jurisdiccion del tomador con: ${normalizedJurisdiction}`)
      || normalizedQuestion.includes(`escenario provincial alternativo para comparar contrato y radicacion: ${normalizedJurisdiction}`)) roles.push('Uso alternativo');
    return roles.length ? roles.join(' + ') : 'Jurisdicción comparada';
  };
  const provincialComparisonTable = profilesToReport.length > 1 ? {
    columns: profilesToReport.map((item) => item.jurisdiction),
    rows: [
      {
        label: 'Rol en la consulta',
        values: profilesToReport.map((item) => jurisdictionRole(item.jurisdiction)),
      },
      {
        label: 'Sellos del contrato',
        values: profilesToReport.map((item) => item.stampRatePercent === undefined
          ? 'Alícuota pendiente de verificación'
          : `${item.stampRatePercent}%${item.stampRateCondition ? ` — ${item.stampRateCondition}` : ''}`),
      },
      {
        label: 'Ingresos Brutos del dador',
        values: profilesToReport.map((item) => item.grossIncomeRatePercent === undefined
          ? 'Incidencia no cuantificada'
          : `${item.grossIncomeRatePercent}% para actividad 649100; no sumar otra vez si ya integra tasa o canon`),
      },
      {
        label: 'Beneficios o exenciones',
        values: profilesToReport.map((item) => item.exemptions.length
          ? shortCell(item.exemptions.join(' '), 'Sin beneficio confirmado')
          : 'No se confirmó una exención automática para el caso'),
      },
      {
        label: 'Base, territorialidad y condiciones',
        values: profilesToReport.map((item) => shortCell(item.treatment, 'Tratamiento pendiente de verificación')),
      },
      {
        label: 'Estado de la fuente',
        values: profilesToReport.map((item) => item.status === 'verified-current'
          ? `Norma ${item.fiscalYear || 'vigente'} verificada`
          : 'Requiere confirmar la norma anual vigente'),
      },
    ],
  } : undefined;
  const taxFindings = [
    `Persona jurídica: ${LEASING_TAXPAYER_PROFILES.company}`,
    `Persona humana en régimen general: ${LEASING_TAXPAYER_PROFILES['human-general-regime']}`,
    `Monotributista: ${LEASING_TAXPAYER_PROFILES.monotributista}`,
    `Uso personal: ${LEASING_TAXPAYER_PROFILES.consumer}`,
    ...profilesToReport.map((item) => `${item.jurisdiction} (${item.fiscalYear || 'norma vigente verificada'}): ${item.treatment} ${item.exemptions.join(' ')}`),
    'Mapa de gastos y exenciones aplicable a la consulta:',
    ...expenseMap,
    'Beneficios impositivos según el tipo de bien informado:',
    ...assetTaxBenefits,
    ...percentageIncidence,
    stampComparison,
    grossIncomeComparison,
    'Regla de comparación: mostrar todos los porcentajes, su base, momento y obligado legal. No sumar mecánicamente Sellos, Ingresos Brutos, patente y opción de compra porque pueden recaer sobre bases distintas, corresponder a sujetos diferentes o devengarse en etapas separadas. Un impuesto propio del dador sólo se agrega como cargo separado al flujo del tomador cuando la propuesta o el contrato así lo manifiestan; en caso contrario se trata como incluido en el precio financiero para evitar doble cómputo.',
    'Sellos es provincial: no existe una única alícuota argentina. Para las demás jurisdicciones debe verificarse la ley anual vigente antes de informar tasa o exención; el sistema no presume que el leasing esté exento.',
  ];
  const financialHeadline = quoteData
    ? `La cotización fue leída directamente: ${quoteData.assetValueNet !== undefined ? `valor neto ${amount(quoteData.assetValueNet)}` : 'valor pendiente'}${quoteData.regularCanonCount !== undefined && quoteData.regularCanonAmount !== undefined ? `, ${quoteData.regularCanonCount} cánones de ${amount(quoteData.regularCanonAmount)}` : ''}${quoteData.optionAmount !== undefined ? ` y opción de ${amount(quoteData.optionAmount)}` : ''}. Los importes del archivo no se reemplazan por una simulación del formulario.`
    : financeResult
      ? `Resultado del caso: se financian ${amount(financeResult.financedAmount)} netos de IVA y el canon financiero estimado es ${amount(financeResult.monthlyCanon)} durante ${months} meses, con una opción de ${amount(financeResult.optionAmount)}.`
      : 'Todavía faltan datos para calcular el flujo financiero completo. La comparación debe llevar leasing y préstamo al mismo flujo después de impuestos.';
  return {
    kind,
    status: 'partial',
    title: 'Resultado financiero del leasing',
    directAnswer: financialHeadline,
    findings: [
      'Marco contractual: Código Civil y Comercial de la Nación, artículos 1227 y siguientes. El artículo 1238 regula el uso y goce del bien; no fija plazos fiscales de amortización.',
      `Marco tributario nacional vigente desde el 29/03/2022: ${currentTaxRule}`,
      'Modalidades económicas a distinguir: leasing financiero, leasing operativo o asimilado a locación y lease-back. La denominación comercial no reemplaza el análisis de las condiciones legales y tributarias.',
      'Tipo de leasing y efecto sobre la opción de compra:',
      ...leasingTypeAndOptionRules,
      'Cálculo del caso práctico:',
      ...financialCaseFindings,
      'Ventajas diferenciales frente a préstamo, prenda u otra financiación de inversión:',
      ...distinctiveAdvantages,
      'Una ventaja fiscal sólo existe si el tomador puede computarla conforme su actividad, afectación del bien, impuesto, jurisdicción y documentación; no debe sumarse como ahorro sin verificar su utilización efectiva.',
      ...taxFindings,
      ...publicSectorRules,
      ...internationalFindings,
    ],
    sections: [
      { title: 'Resultado financiero', items: financialCaseFindings },
      ...(leaseBackRules.length ? [{ title: 'Lease-back: aforo, plazo y efecto fiscal', items: leaseBackRules }] : []),
      { title: 'Modalidad y opción de compra', items: leasingTypeAndOptionRules },
      { title: 'Ventajas frente a préstamo y prenda', items: [...distinctiveAdvantages, ...humanPersonComparison] },
      { title: 'Ventajas impositivas y tratamiento del tomador', items: [
        `Persona jurídica: ${LEASING_TAXPAYER_PROFILES.company}`,
        `Persona humana en actividad: ${LEASING_TAXPAYER_PROFILES['human-general-regime']}`,
        `Monotributista: ${LEASING_TAXPAYER_PROFILES.monotributista}`,
        `Uso personal: ${LEASING_TAXPAYER_PROFILES.consumer}`,
        ...assetTaxBenefits,
      ] },
      { title: 'Costos, registración y tributos', items: [...expenseMap, ...percentageIncidence, stampComparison, grossIncomeComparison].filter(Boolean) },
      ...(publicSectorRules.length ? [{ title: 'Sector público', items: publicSectorRules }] : []),
      ...(internationalFindings.length ? [{ title: 'Comparación internacional', items: internationalFindings }] : []),
      { title: 'Cómo debe interpretarse el leasing', items: [`El leasing debe analizarse como contrato, financiación, inversión e impuesto, sin mezclar sus resultados. No es automáticamente mejor ni peor que un préstamo: la conveniencia depende del contrato, activo, plazo y situación fiscal. ${focus}`] },
    ],
    comparisonTable: provincialComparisonTable,
    nextActions: [
      'Comparar leasing, préstamo y compra al contado con el mismo activo, plazo y valor residual, usando flujos mensuales después de impuestos.',
      'Separar canon financiero, servicios, IVA, seguros, mantenimiento, gastos registrales, comisiones y precio de opción.',
      'Verificar quién es el dador, cómo se eligió el bien, quién asume vicios, pérdida, mantenimiento, seguro, impuestos y obsolescencia.',
      'Confirmar con asesoramiento contable el encuadre en Ganancias, IVA e impuestos provinciales antes de atribuir una ventaja impositiva.',
      'Si el tomador es público, verificar competencia para contratar, procedimiento de selección, autorización presupuestaria y de endeudamiento, capacidad de repago, garantía ofrecida y autorización o encuadre BCRA; no presumir que siempre debe ceder coparticipación.',
      'Si el bien es importado, verificar antes de contratar el régimen aduanero y el texto ordenado vigente de Exterior y Cambios del BCRA para cada pago al exterior.',
      internationalFindings.length ? 'Para una comparación internacional definitiva, indicar país o estado, residencia fiscal de las partes, tipo de activo, moneda, proveedor, plazo, opción, estándar contable y lugar de registro.' : '',
    ],
    limitations: [profilesToReport.length
      ? 'La liquidación es orientativa hasta conocer valor del bien, maxi canon, cánones, plazo, opción, IVA, servicios, cláusula de impuestos y datos registrales.'
      : 'Para informar gastos y exenciones concretos faltan como mínimo la provincia donde se celebra el contrato, la provincia de uso/radicación, el tipo de bien y el tipo fiscal de tomador. Sin esos datos no debe afirmarse una exención.'],
  };
}

export function buildCustomerDecisionAnswer(input: DecisionAnswerInput): CustomerDecisionAnswer {
  const question = `${input.userInstruction || ''}\n${input.documentText}`;
  const legalCategorySelected = input.selectedCategory === 'argentina-legal-documents';
  const explicitQuestion = input.userInstruction?.trim() || input.documentText;
  if (input.selectedCategory === 'leasing-specialist' || /\bleasing\b|lease[ -]?back|arrendamiento\s+financiero|opci[oó]n\s+de\s+compra/i.test(explicitQuestion)) {
    return buildLeasingAnswer(input.selectedCategory, explicitQuestion);
  }
  if (input.argentinaLegalAnalysis.applicable && input.argentinaLegalAnalysis.subtopic === 'sexual-offense') {
    return withLegalCategoryWarning(buildSexualOffenseAnswer(input.argentinaLegalAnalysis), input.argentinaLegalAnalysis);
  }
  if (input.argentinaLegalAnalysis.applicable && input.argentinaLegalAnalysis.subtopic === 'family-support') {
    return withLegalCategoryWarning(buildChildSupportAnswer(input.argentinaLegalAnalysis), input.argentinaLegalAnalysis);
  }
  if (input.argentinaLegalAnalysis.applicable && input.argentinaLegalAnalysis.subtopic === 'succession') {
    return withLegalCategoryWarning(buildSuccessionAnswer(input.argentinaLegalAnalysis), input.argentinaLegalAnalysis);
  }
  if (legalCategorySelected) {
    const subtopicAnswer = buildLegalSubtopicAnswer(input.argentinaLegalAnalysis);
    if (subtopicAnswer) return withLegalCategoryWarning(subtopicAnswer, input.argentinaLegalAnalysis);
  }
  if (legalCategorySelected && input.argentinaLegalAnalysis.legalBranch === 'commercial' && input.argentinaLegalAnalysis.subtopic === 'contract-review') {
    return withLegalCategoryWarning(buildCommercialContractAnswer(input.argentinaLegalAnalysis), input.argentinaLegalAnalysis);
  }
  if (legalCategorySelected && input.argentinaLegalAnalysis.subtopic === 'labor') {
    return withLegalCategoryWarning(buildLaborAnswer(input.argentinaLegalAnalysis), input.argentinaLegalAnalysis);
  }
  if (legalCategorySelected && input.argentinaLegalAnalysis.subtopic === 'tax') {
    return withLegalCategoryWarning(buildTaxAnswer(input.argentinaLegalAnalysis), input.argentinaLegalAnalysis);
  }
  if (legalCategorySelected && input.argentinaLegalAnalysis.legalBranch === 'administrative') {
    return withLegalCategoryWarning(buildAdministrativeAnswer(input.argentinaLegalAnalysis), input.argentinaLegalAnalysis);
  }
  if (legalCategorySelected && input.argentinaLegalAnalysis.subtopic === 'debt-enforcement') {
    return withLegalCategoryWarning(buildLegalDebtEnforcementAnswer(input.argentinaLegalAnalysis), input.argentinaLegalAnalysis);
  }
  if (legalCategorySelected && input.argentinaLegalAnalysis.legalBranch === 'family') {
    return withLegalCategoryWarning(buildFamilyAnswer(input.argentinaLegalAnalysis), input.argentinaLegalAnalysis);
  }
  if (legalCategorySelected && input.argentinaLegalAnalysis.legalBranch === 'criminal') {
    return withLegalCategoryWarning(buildCriminalAnswer(input.argentinaLegalAnalysis), input.argentinaLegalAnalysis);
  }
  if (legalCategorySelected && input.argentinaLegalAnalysis.legalBranch === 'commercial') {
    return withLegalCategoryWarning(buildCommercialAnswer(input.argentinaLegalAnalysis), input.argentinaLegalAnalysis);
  }
  if (legalCategorySelected && input.argentinaLegalAnalysis.legalBranch === 'civil') {
    return withLegalCategoryWarning(buildCivilAnswer(input.argentinaLegalAnalysis), input.argentinaLegalAnalysis);
  }
  if (legalCategorySelected) {
    return withLegalCategoryWarning(buildGeneralLegalAnswer(input.argentinaLegalAnalysis), input.argentinaLegalAnalysis);
  }
  if (isFinancialProductComparison(question)) {
    return buildFinancialProductComparisonAnswer(question);
  }
  if ((input.selectedCategory === 'investment-project' || input.selectedCategory === 'scam-risk') && asksEntityOrOfferVerification(question)) {
    return buildEntityVerificationAnswer(input, question);
  }
  if (input.selectedCategory === 'finance-credit' && input.financialAnalysis && /\b(?:prenda(?:s|ria|rias)?|prendari[oa]s?)\b/i.test(question)) {
    return buildPledgeFinanceAnswer(input.financialAnalysis, question);
  }
  const asksInvestment = /\b(?:inversi[oó]n|invertir|rentabilidad|renta|retorno|viabilidad|proyecto|alquiler|precio\s+por\s+m2|precio\s+por\s+metro|exportaci[oó]n|demanda\s+internacional|miner[ií]a|minero|litio|cobre|oro|petr[oó]leo|gas\s+natural|hidrocarburo|vaca\s+muerta|yacimiento|tierras?|terrenos?)\b/i.test(question);
  if (input.investmentProjectAnalysis?.applicable && (input.selectedCategory === 'investment-project' || asksInvestment)) {
    return buildInvestmentAnswer(input.investmentProjectAnalysis);
  }
  if (input.financialAnalysis && (input.selectedCategory === 'finance-credit' || /(?:cu[aá]nto|total|costo|inter[eé]s|tasa|inflaci[oó]n|tna|tea|cft|cuota|pag(?:ar|ando)|pr[eé]stamo|cr[eé]dito|prenda(?:ria)?|prendari[oa]|financi)/i.test(question))) {
    return buildLoanAnswer(input.financialAnalysis, question);
  }
  if (input.selectedCategory === 'scam-risk' || input.scamRiskAnalysis.applicable) {
    const hasSignals = input.scamRiskAnalysis.signals.length > 0;
    const elevatedRisk = ['alto', 'muy-alto'].includes(input.scamRiskAnalysis.level);
    return {
      kind: 'scam-prevention', status: hasSignals ? 'needs-verification' : 'partial',
      title: elevatedRisk ? 'La propuesta presenta un riesgo elevado: no pagues sin verificarla' : hasSignals ? 'Hay señales que conviene verificar antes de pagar' : 'No alcanza para confirmar que la operación sea segura',
      directAnswer: elevatedRisk
        ? `Evaluación preliminar: riesgo ${input.scamRiskAnalysis.level === 'muy-alto' ? 'muy alto' : 'alto'}. ${input.scamRiskAnalysis.conclusion} No puede afirmarse que sea una estafa sin identificar al operador y contrastar su autorización, pero tampoco debe tratarse como una oferta confiable.`
        : input.scamRiskAnalysis.applicable
          ? input.scamRiskAnalysis.conclusion
          : 'No aparecen señales concretas suficientes para afirmar que la propuesta sea engañosa. Eso no acredita la identidad, autorización ni solvencia de la contraparte: la categoría exige revisar esos elementos antes de confiar o pagar.',
      findings: input.scamRiskAnalysis.signals.map((signal) => `${signal.label}: “${signal.evidence}”.`),
      nextActions: input.scamRiskAnalysis.checks,
      limitations: ['La ausencia de patrones conocidos no acredita la identidad, legitimidad o solvencia de la contraparte.'],
    };
  }
  if (input.argentinaLegalAnalysis.applicable) {
    return buildGeneralLegalAnswer(input.argentinaLegalAnalysis);
  }
  return {
    kind: 'supported-review', status: 'needs-verification', title: 'Qué puede concluirse con la información aportada',
    directAnswer: 'La información disponible no permite todavía una respuesta accionable y suficientemente respaldada.', findings: [],
    nextActions: ['Aportar el documento, oferta o comunicación completa y formular una pregunta concreta.'],
    limitations: ['No se infiere una conclusión por la sola ausencia de información.'],
  };
}

export function enrichDecisionAnswerWithExternalEvidence(
  answer: CustomerDecisionAnswer | undefined,
  records: ExternalVerificationSourceRecord[],
  verificationRationale?: string
): CustomerDecisionAnswer | undefined {
  if (!answer || answer.kind !== 'scam-prevention') return answer;
  const relevant = records
    .filter((record) => ['domain-registration-data', 'domain-reputation', 'security-research', 'consumer-protection-agencies', 'securities-regulator-cnv'].includes(record.sourceType) && record.excerpt)
    .slice(0, 5)
    .map((record) => `${record.title}: ${record.excerpt}`);
  if (!relevant.length && !verificationRationale) return answer;
  return {
    ...answer,
    directAnswer: `${answer.directAnswer}${verificationRationale ? ` Verificación externa: ${verificationRationale}` : ''}`,
    findings: [...new Set([...answer.findings, ...relevant])],
    limitations: [...new Set([
      ...answer.limitations,
      'Una reputación baja, un dominio reciente o un antecedente de malvertising son señales de riesgo; no demuestran por sí solos un delito.',
      'La ausencia de una coincidencia en un registro o listado de alertas no equivale a autorización ni garantiza seguridad.',
    ])],
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
