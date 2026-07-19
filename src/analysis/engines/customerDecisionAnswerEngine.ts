import type { LoanNumbers } from '../../lib/finance/loanMath';
import type { ScamRiskAnalysis } from '../../lib/scams/scamRiskAnalysis';
import type { ArgentinaLegalAnalysis } from '../../lib/legal/argentinaLegalAnalysis';
import type { ExternalVerificationSourceRecord } from '../types/externalVerification';
import type { InvestmentProjectAnalysis } from '../../lib/investments/investmentProjectAnalysis';
import { leasingKnowledge } from '../../lib/leasing/argentinaLeasingKnowledge';
import { buildInternationalLeasingFindings } from '../../lib/leasing/internationalLeasingComparison';
import { LEASING_TAXPAYER_PROFILES, PROVINCIAL_LEASING_STAMP_MATRIX } from '../../lib/leasing/argentinaLeasingTaxMatrix';

export type CustomerDecisionAnswer = {
  kind: 'loan-cost' | 'financial-product-comparison' | 'investment-project' | 'scam-prevention' | 'legal-document' | 'leasing-specialist' | 'supported-review';
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
  const hasUpfrontFee = financial.upfrontFeePercent !== null && financial.upfrontFeeAmount !== null;
  const systemExplanation = financial.amortizationSystem === 'german'
    ? 'El cálculo usa sistema alemán: cuotas mensuales vencidas y decrecientes, con amortización de capital constante.'
    : 'El cálculo usa sistema francés: cuotas mensuales iguales y vencidas, pagadas al final de cada mes.';
  const paymentSummary = hasFlow
    ? financial.amortizationSystem === 'german'
      ? `Las ${financial.months} cuotas irían desde ${money(financial.firstInstallment || 0, financial.currency)} hasta ${money(financial.lastInstallment || 0, financial.currency)} y sumarían ${money(financial.calculatedInstallmentsTotal || 0, financial.currency)}.`
      : `La cuota mensual ${financial.installmentEstimated ? 'estimada' : 'informada'} es ${money(financial.installment || 0, financial.currency)} y ${financial.months} cuotas sumarían un total estimado de ${money(financial.calculatedInstallmentsTotal || 0, financial.currency)}.`
    : '';
  const adjustedRateAnswer = modeledFromRate && financial.tnaPercent !== null && hasImplicitRate
    ? `La TNA contractual sigue siendo ${percent(financial.tnaPercent || 0)}. ${hasUpfrontFee ? `La comisión inicial de ${percent(financial.upfrontFeePercent || 0)} equivale a ${money(financial.upfrontFeeAmount || 0, financial.currency)} y deja un desembolso neto de ${money(financial.netDisbursement || 0, financial.currency)}. ` : ''}La TNA implícita ajustada por el flujo es ${percent(financial.impliedTnaPercent || 0)} y la TEA implícita es ${percent(financial.impliedTeaPercent || 0)}. No son un CFT oficial.`
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
      hasFlow ? `Modelo de cálculo: sistema ${financial.amortizationSystem === 'german' ? 'alemán, con amortización constante y cuotas decrecientes' : 'francés, con cuotas iguales'}; periodicidad mensual; pagos vencidos al final de cada mes.` : '',
      hasFlow && !financial.installmentEstimated ? 'El sistema de amortización es un supuesto necesario para estimar la tasa implícita; debe confirmarse en el contrato.' : '',
      financial.selectedScenarioReason || '',
      financial.installment !== null && financial.months !== null && financial.amortizationSystem === 'french' ? `${financial.months} cuotas ${financial.installmentEstimated ? 'estimadas' : 'informadas'} de ${money(financial.installment, financial.currency)}.` : '',
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
  const leasingTypeAndOptionRules = [
    'Leasing contractual argentino (CCyC): para quedar bajo los artículos 1227 y siguientes debe existir una opción de compra a favor del tomador. El precio debe estar fijado en el contrato o ser determinable por procedimientos o pautas pactadas; también deben revisarse el momento habilitado para ejercerla y sus efectos.',
    'Leasing financiero: el dador financia sustancialmente la adquisición y recupera capital, costo financiero y margen mediante maxi canon/cánones y opción. Una opción residual baja puede hacer probable la compra, pero no debe suponerse sin leer el flujo; se compara el costo total incluyendo opción y transferencia.',
    'Leasing operativo: prioriza disponibilidad, servicios, mantenimiento, renovación o devolución y suele conservar mayor riesgo residual en el proveedor. Si no hay una verdadera opción de compra, puede tratarse económicamente o jurídicamente como locación y no debe recibir automáticamente los beneficios del leasing financiero.',
    'Lease-back: el futuro tomador vende su activo al dador y lo recibe en leasing. Deben agregarse los impuestos y gastos de la venta inicial, analizar sustancia económica y luego los cánones y la eventual recompra; no equivale a un préstamo garantizado sólo por cambiarle el nombre.',
    'Control de la opción: informar valor o fórmula, fecha habilitada, IVA, Sellos o impuesto de transferencia, arancel registral, deuda previa, condición del bien y crédito por Sellos pagado sobre cánones cuando la provincia lo admita.',
  ];
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
  return {
    kind,
    status: 'partial',
    title: 'El leasing debe analizarse como contrato, financiación, inversión e impuesto, sin mezclar sus puntajes',
    directAnswer: `El leasing no es automáticamente mejor ni peor que un préstamo. Combina el uso de un bien a cambio de cánones con una opción de compra y su conveniencia depende del contrato, del activo, del plazo y de la situación fiscal concreta. ${focus}`,
    findings: [
      'Marco contractual: Código Civil y Comercial de la Nación, artículos 1227 y siguientes. El artículo 1238 regula el uso y goce del bien; no fija plazos fiscales de amortización.',
      `Marco tributario nacional vigente desde el 29/03/2022: ${currentTaxRule}`,
      'Modalidades económicas a distinguir: leasing financiero, leasing operativo o asimilado a locación y lease-back. La denominación comercial no reemplaza el análisis de las condiciones legales y tributarias.',
      'Tipo de leasing y efecto sobre la opción de compra:',
      ...leasingTypeAndOptionRules,
      'Ventajas diferenciales frente a préstamo, prenda u otra financiación de inversión:',
      ...distinctiveAdvantages,
      'Una ventaja fiscal sólo existe si el tomador puede computarla conforme su actividad, afectación del bien, impuesto, jurisdicción y documentación; no debe sumarse como ahorro sin verificar su utilización efectiva.',
      ...taxFindings,
      ...publicSectorRules,
      ...internationalFindings,
    ],
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
  if (/\bleasing\b|lease[ -]?back|arrendamiento\s+financiero|opci[oó]n\s+de\s+compra/i.test(explicitQuestion)) {
    return buildLeasingAnswer(input.selectedCategory, explicitQuestion);
  }
  if (input.argentinaLegalAnalysis.applicable && input.argentinaLegalAnalysis.subtopic === 'sexual-offense') {
    return buildSexualOffenseAnswer(input.argentinaLegalAnalysis);
  }
  if (input.argentinaLegalAnalysis.applicable && input.argentinaLegalAnalysis.subtopic === 'family-support') {
    return buildChildSupportAnswer(input.argentinaLegalAnalysis);
  }
  if (legalCategorySelected && input.argentinaLegalAnalysis.subtopic === 'debt-enforcement') {
    return buildLegalDebtEnforcementAnswer(input.argentinaLegalAnalysis);
  }
  if (legalCategorySelected) {
    return buildGeneralLegalAnswer(input.argentinaLegalAnalysis);
  }
  if (isFinancialProductComparison(question)) {
    return buildFinancialProductComparisonAnswer(question);
  }
  const asksInvestment = /\b(?:inversi[oó]n|invertir|rentabilidad|renta|retorno|viabilidad|proyecto|alquiler|precio\s+por\s+m2|precio\s+por\s+metro|exportaci[oó]n|demanda\s+internacional|miner[ií]a|minero|litio|cobre|oro|petr[oó]leo|gas\s+natural|hidrocarburo|vaca\s+muerta|yacimiento|tierras?|terrenos?)\b/i.test(question);
  if (input.investmentProjectAnalysis?.applicable && asksInvestment) {
    return buildInvestmentAnswer(input.investmentProjectAnalysis);
  }
  if (input.financialAnalysis && /(?:cu[aá]nto|total|costo|inter[eé]s|tasa|inflaci[oó]n|tna|tea|cft|cuota|pag(?:ar|ando)|pr[eé]stamo|cr[eé]dito|financi)/i.test(question)) {
    return buildLoanAnswer(input.financialAnalysis, question);
  }
  if (input.scamRiskAnalysis.applicable) {
    const hasSignals = input.scamRiskAnalysis.signals.length > 0;
    const elevatedRisk = ['alto', 'muy-alto'].includes(input.scamRiskAnalysis.level);
    return {
      kind: 'scam-prevention', status: hasSignals ? 'needs-verification' : 'partial',
      title: elevatedRisk ? 'La propuesta presenta un riesgo elevado: no pagues sin verificarla' : hasSignals ? 'Hay señales que conviene verificar antes de pagar' : 'No alcanza para confirmar que la operación sea segura',
      directAnswer: elevatedRisk
        ? `Evaluación preliminar: riesgo ${input.scamRiskAnalysis.level === 'muy-alto' ? 'muy alto' : 'alto'}. ${input.scamRiskAnalysis.conclusion} No puede afirmarse que sea una estafa sin identificar al operador y contrastar su autorización, pero tampoco debe tratarse como una oferta confiable.`
        : input.scamRiskAnalysis.conclusion,
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
