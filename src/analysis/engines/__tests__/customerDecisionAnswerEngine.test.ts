import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractLoanNumbers } from '../../../lib/finance/loanMath';
import { analyzeScamRisk } from '../../../lib/scams/scamRiskAnalysis';
import { analyzeArgentinaLegal } from '../../../lib/legal/argentinaLegalAnalysis';
import { analyzeInvestmentProject } from '../../../lib/investments/investmentProjectAnalysis';
import { buildCustomerDecisionAnswer, enrichDecisionAnswerWithExternalEvidence } from '../customerDecisionAnswerEngine';

test('la categoría elegida gobierna el tipo de respuesta aunque la redacción sea genérica', () => {
  const baseText = 'Necesito analizar esta propuesta y saber qué información falta.';
  const legal = analyzeArgentinaLegal(baseText, true, baseText, 'civil', 'CABA');

  const financeAnswer = buildCustomerDecisionAnswer({
    documentText: baseText, selectedCategory: 'finance-credit',
    financialAnalysis: extractLoanNumbers(baseText), scamRiskAnalysis: analyzeScamRisk(''), argentinaLegalAnalysis: analyzeArgentinaLegal(''),
  });
  assert.equal(financeAnswer.kind, 'loan-cost');

  const investmentAnswer = buildCustomerDecisionAnswer({
    documentText: baseText, selectedCategory: 'investment-project', financialAnalysis: null,
    investmentProjectAnalysis: analyzeInvestmentProject(baseText, '', true), scamRiskAnalysis: analyzeScamRisk(''), argentinaLegalAnalysis: analyzeArgentinaLegal(''),
  });
  assert.equal(investmentAnswer.kind, 'investment-project');

  const scamAnswer = buildCustomerDecisionAnswer({
    documentText: baseText, selectedCategory: 'scam-risk', financialAnalysis: null,
    scamRiskAnalysis: analyzeScamRisk(baseText), argentinaLegalAnalysis: analyzeArgentinaLegal(''),
  });
  assert.equal(scamAnswer.kind, 'scam-prevention');
  assert.match(scamAnswer.directAnswer, /no acredita la identidad/i);

  const legalAnswer = buildCustomerDecisionAnswer({
    documentText: baseText, selectedCategory: 'argentina-legal-documents', financialAnalysis: null,
    scamRiskAnalysis: analyzeScamRisk(''), argentinaLegalAnalysis: legal,
  });
  assert.equal(legalAnswer.kind, 'legal-document');

  const leasingAnswer = buildCustomerDecisionAnswer({
    documentText: baseText, selectedCategory: 'leasing-specialist', financialAnalysis: null,
    scamRiskAnalysis: analyzeScamRisk(''), argentinaLegalAnalysis: analyzeArgentinaLegal(''),
  });
  assert.equal(leasingAnswer.kind, 'leasing-specialist');
});

test('responde primero cuánto se paga y estima tasas para el plazo pedido', () => {
  const text = 'Monto del préstamo $1.007.000. 12 cuotas de $130.381. 24 cuotas de $100.553. 36 cuotas de $106.213. 48 cuotas de $107.037.';
  const instruction = 'Necesito saber el CFT y la TNA para 36 meses.';
  const financialAnalysis = extractLoanNumbers(text, instruction);
  const answer = buildCustomerDecisionAnswer({
    documentText: text, userInstruction: instruction, financialAnalysis,
    scamRiskAnalysis: analyzeScamRisk(text), argentinaLegalAnalysis: analyzeArgentinaLegal(text),
  });
  assert.equal(answer.kind, 'loan-cost');
  assert.equal(answer.status, 'answerable');
  assert.match(answer.directAnswer, /36 cuotas sumarían/i);
  assert.match(answer.directAnswer, /sistema francés.*cuotas mensuales iguales y vencidas/i);
  assert.match(answer.directAnswer, /TNA implícita estimada/i);
  assert.match(answer.directAnswer, /CFT oficial no puede conocerse/i);
  assert.match(answer.findings.join(' '), /Modelo de cálculo: sistema francés.*periodicidad mensual.*pagos vencidos/i);
  assert.match(answer.findings.join(' '), /supuesto necesario.*confirmarse en el contrato/i);
  assert.match(answer.findings.join(' '), /priorizó la instrucción.*36 meses/i);
  assert.match(answer.nextActions.join(' '), /CFT contractual/i);
});

test('calcula una consulta simple con capital abreviado, plazo y TNA', () => {
  const text = 'Cuanto pago de cuota si me prestan 1M de pesos en 12 meses al 30% TNA';
  const financialAnalysis = extractLoanNumbers(text);
  const answer = buildCustomerDecisionAnswer({
    documentText: text,
    userInstruction: text,
    financialAnalysis,
    scamRiskAnalysis: analyzeScamRisk(text),
    argentinaLegalAnalysis: analyzeArgentinaLegal(text),
  });
  assert.equal(answer.kind, 'loan-cost');
  assert.equal(answer.status, 'answerable');
  assert.match(answer.title, /esto es lo que pagarías/i);
  assert.match(answer.directAnswer, /cuota mensual estimada.*97\.487/i);
  assert.match(answer.directAnswer, /total estimado.*1\.169\.845/i);
  assert.match(answer.directAnswer, /sistema francés.*mensuales iguales y vencidas/i);
  assert.doesNotMatch(answer.directAnswer, /faltan datos/i);
});

test('no acusa estafa cuando no hay señales y explica qué falta verificar', () => {
  const text = 'Préstamo personal de entidad desconocida. Consultar condiciones.';
  const answer = buildCustomerDecisionAnswer({
    documentText: text, userInstruction: '¿Es seguro pagar un anticipo?', financialAnalysis: null,
    scamRiskAnalysis: analyzeScamRisk(text), argentinaLegalAnalysis: analyzeArgentinaLegal(text),
  });
  assert.equal(answer.kind, 'scam-prevention');
  assert.doesNotMatch(answer.directAnswer, /es una estafa/i);
  assert.ok(answer.nextActions.length > 0);
});

test('responde una consulta de TNA ajustada por comisión inicial sin pedir una cuota inexistente', () => {
  const text = 'Me quieren prestar 1.000.000 de dólares a 36 meses. Me dicen que la TNA es 30% pero me piden el 3% de comisión al inicio.';
  const instruction = '¿Cuánto sería la TNA real que pago en 36 meses?';
  const financialAnalysis = extractLoanNumbers(text, instruction);
  const answer = buildCustomerDecisionAnswer({
    documentText: text, userInstruction: instruction, financialAnalysis,
    scamRiskAnalysis: analyzeScamRisk(text), argentinaLegalAnalysis: analyzeArgentinaLegal(text),
  });
  assert.equal(answer.kind, 'loan-cost');
  assert.equal(answer.status, 'answerable');
  assert.match(answer.title, /comisión eleva el costo real/i);
  assert.match(answer.directAnswer, /TNA contractual sigue siendo 30,00%/i);
  assert.match(answer.directAnswer, /sistema francés.*cuotas mensuales iguales y vencidas/i);
  assert.match(answer.directAnswer, /desembolso neto de US\$\s*970\.000/i);
  assert.match(answer.directAnswer, /TNA implícita ajustada.*32,38%/i);
  assert.match(answer.directAnswer, /TEA implícita.*37,64%/i);
  assert.match(answer.directAnswer, /No son un CFT oficial/i);
});

test('explica el sistema alemán cuando el usuario lo solicita', () => {
  const text = 'Me prestan 1.000.000 de dólares a 36 meses con TNA 30% y 3% de comisión al inicio.';
  const instruction = 'Calcular con sistema alemán.';
  const financialAnalysis = extractLoanNumbers(text, instruction);
  const answer = buildCustomerDecisionAnswer({
    documentText: text, userInstruction: instruction, financialAnalysis,
    scamRiskAnalysis: analyzeScamRisk(text), argentinaLegalAnalysis: analyzeArgentinaLegal(text),
  });
  assert.equal(answer.status, 'answerable');
  assert.match(answer.directAnswer, /sistema alemán.*cuotas mensuales vencidas y decrecientes/i);
  assert.match(answer.findings.join(' '), /primera.*última/i);
});

test('responde la instrucción inmobiliaria con métricas preliminares y requisitos locales', () => {
  const text = 'Departamento en Córdoba, precio de compra USD 100.000, 50 m2, alquiler mensual USD 700, gastos mensuales USD 100 y vacancia 5%.';
  const instruction = 'Calcular precio por metro, rendimiento y decir si será fácil alquilarlo.';
  const answer = buildCustomerDecisionAnswer({
    documentText: text,
    userInstruction: instruction,
    financialAnalysis: null,
    scamRiskAnalysis: analyzeScamRisk(text),
    argentinaLegalAnalysis: analyzeArgentinaLegal(text),
    investmentProjectAnalysis: analyzeInvestmentProject(text, instruction),
  });
  assert.equal(answer.kind, 'investment-project');
  assert.equal(answer.status, 'partial');
  assert.match(answer.findings.join(' '), /Precio calculado por m².*2\.000/i);
  assert.match(answer.findings.join(' '), /Rendimiento bruto anual preliminar.*8,40%/i);
  assert.match(answer.findings.join(' '), /Rendimiento neto anual preliminar.*6,78%/i);
  assert.match(answer.nextActions.join(' '), /localidad.*tipología.*vacancia/i);
  assert.doesNotMatch(answer.directAnswer, /es una buena inversión|inversión recomendable/i);
});

test('una oportunidad exportadora exige demanda, destinos, competidores y barreras', () => {
  const text = 'Proyecto para exportar vino argentino con demanda mundial creciente y retorno asegurado.';
  const instruction = 'Validar si es una buena inversión para vender al exterior.';
  const answer = buildCustomerDecisionAnswer({
    documentText: text,
    userInstruction: instruction,
    financialAnalysis: null,
    scamRiskAnalysis: analyzeScamRisk(text),
    argentinaLegalAnalysis: analyzeArgentinaLegal(text),
    investmentProjectAnalysis: analyzeInvestmentProject(text, instruction),
  });
  assert.equal(answer.kind, 'investment-project');
  assert.equal(answer.status, 'needs-verification');
  assert.match(answer.nextActions.join(' '), /posición arancelaria.*destino.*barreras sanitarias/i);
  assert.match(answer.directAnswer, /no debe tratarse como una inversión recomendable/i);
});

test('expone producción, margen y retorno de un proyecto agrícola con sus límites', () => {
  const text = 'Proyecto de soja en 600 hectáreas. Inversión inicial USD 500.000, rinde 3,5 toneladas por hectárea, precio por tonelada USD 400 y costo por hectárea USD 900.';
  const instruction = 'Calcular producción, ingresos, costos, margen y retorno anual.';
  const answer = buildCustomerDecisionAnswer({
    documentText: text,
    userInstruction: instruction,
    financialAnalysis: null,
    scamRiskAnalysis: analyzeScamRisk(text),
    argentinaLegalAnalysis: analyzeArgentinaLegal(text),
    investmentProjectAnalysis: analyzeInvestmentProject(text, instruction),
  });
  assert.equal(answer.kind, 'investment-project');
  assert.match(answer.findings.join(' '), /Producto detectado: soja/i);
  assert.match(answer.findings.join(' '), /Producción proyectada.*2\.100 toneladas/i);
  assert.match(answer.findings.join(' '), /Margen operativo proyectado.*US\$\s*300\.000.*35,71%/i);
  assert.match(answer.findings.join(' '), /Retorno anual preliminar.*60,00%/i);
  assert.match(answer.findings.join(' '), /Escenario adverso.*US\$\s*51\.000.*10,20%/i);
  assert.match(answer.findings.join(' '), /Escenario base.*US\$\s*300\.000.*60,00%/i);
  assert.match(answer.directAnswer, /tres escenarios internos son positivos.*no equivale a una recomendación/i);
  assert.match(answer.nextActions.join(' '), /campaña y región.*clima.*rinde adverso/i);
});

test('incorpora evidencia externa a la respuesta de scam con su alcance correcto', () => {
  const base = buildCustomerDecisionAnswer({
    documentText: 'Autotrader con IA que genera dinero sin riesgo.',
    userInstruction: '¿Es real o scam?',
    financialAnalysis: null,
    scamRiskAnalysis: analyzeScamRisk('Autotrader con IA que genera dinero sin riesgo.'),
    argentinaLegalAnalysis: analyzeArgentinaLegal('Autotrader con IA que genera dinero sin riesgo.'),
  });
  const answer = enrichDecisionAnswerWithExternalEvidence(base, [{
    sourceType: 'domain-reputation', url: 'https://example.test/check', title: 'Reputación del dominio exacto',
    retrievedAt: new Date().toISOString(), claimIndexes: [0], official: false,
    excerpt: 'El servicio informa reputación baja; su evaluación es orientativa.',
  }], 'La consulta externa fue parcial.');
  assert.match(answer?.findings.join(' ') || '', /reputación baja/i);
  assert.match(answer?.directAnswer || '', /consulta externa fue parcial/i);
  assert.match(answer?.limitations.join(' ') || '', /no demuestran por sí solos un delito/i);
});

test('responde una nota de cuenta remunerada sin inventar sectores ni tratarla como préstamo', () => {
  const text = 'Inversión rápida y sencilla: una cuenta remunerada con TNA del 31% le gana por varios puntos al plazo fijo de grandes bancos. El saldo remunerado tiene un tope de $800.000 y la tasa puede cambiar.';
  const instruction = '¿Qué te parece esta propuesta?';
  const answer = buildCustomerDecisionAnswer({
    documentText: text,
    userInstruction: instruction,
    financialAnalysis: null,
    scamRiskAnalysis: analyzeScamRisk(text),
    argentinaLegalAnalysis: analyzeArgentinaLegal(text),
    investmentProjectAnalysis: analyzeInvestmentProject(text, instruction),
  });
  const completeAnswer = [answer.directAnswer, ...answer.findings, ...answer.nextActions, ...answer.limitations].join(' ');
  assert.equal(answer.kind, 'financial-product-comparison');
  assert.match(completeAnswer, /TNA.*31%/i);
  assert.match(completeAnswer, /tope.*800\.000/i);
  assert.doesNotMatch(completeAnswer, /transporte|logística|frutas|hectáreas|\bCFT\b/i);
});

test('responde un incumplimiento comercial como contrato y no como causa penal', () => {
  const documentText = 'Acuerdo comercial. Percorsi pagó todas las cuotas. Vitalcan debe entregar las camionetas. El contrato contiene una penalidad por demora.';
  const userInstruction = '¿Puede Vitalcan no entregar los vehículos y cómo puede demandar Percorsi?';
  const answer = buildCustomerDecisionAnswer({
    documentText,
    userInstruction,
    selectedCategory: 'argentina-legal-documents',
    financialAnalysis: null,
    scamRiskAnalysis: analyzeScamRisk(documentText),
    argentinaLegalAnalysis: analyzeArgentinaLegal(documentText, true, userInstruction, 'commercial'),
  });
  const completeAnswer = [answer.title, answer.directAnswer, ...answer.findings, ...answer.nextActions].join(' ');
  assert.match(completeAnswer, /contrato exigible/i);
  assert.match(completeAnswer, /exigir cumplimiento|resolver el acuerdo/i);
  assert.doesNotMatch(answer.title, /derecho penal/i);
});

test('la respuesta laboral analiza el vínculo real sin tratarlo como contrato comercial', () => {
  const text = 'Trabajé para una empresa como monotributista durante cuatro años y me despidieron.';
  const answer = buildCustomerDecisionAnswer({
    documentText: text,
    userInstruction: '¿Qué puedo reclamar?',
    selectedCategory: 'argentina-legal-documents',
    financialAnalysis: null,
    scamRiskAnalysis: analyzeScamRisk(text),
    argentinaLegalAnalysis: analyzeArgentinaLegal(text, true, '¿Qué puedo reclamar?', 'labor'),
  });
  const rendered = [answer.title, answer.directAnswer, ...answer.findings, ...answer.nextActions].join(' ');
  assert.match(rendered, /vínculo real|cómo se prestaron realmente las tareas/i);
  assert.match(rendered, /monotributista.*no resuelve/i);
  assert.doesNotMatch(answer.title, /comercial|financier/i);
});

test('la respuesta tributaria separa el reclamo fiscal de una financiación', () => {
  const text = 'ARCA me reclama una deuda, intereses y una multa.';
  const answer = buildCustomerDecisionAnswer({
    documentText: text,
    userInstruction: '¿Está bien calculado y cómo lo recurro?',
    selectedCategory: 'argentina-legal-documents',
    financialAnalysis: null,
    scamRiskAnalysis: analyzeScamRisk(text),
    argentinaLegalAnalysis: analyzeArgentinaLegal(text, true, '¿Está bien calculado y cómo lo recurro?', 'tax'),
  });
  const rendered = [answer.title, answer.directAnswer, ...answer.findings, ...answer.nextActions].join(' ');
  assert.match(rendered, /impuesto, período, jurisdicción/i);
  assert.match(rendered, /fiscalización, determinación de oficio/i);
  assert.doesNotMatch(rendered, /CFT|préstamo|cuota financiera/i);
});

test('la respuesta civil separa incumplimiento daño y remedios', () => {
  const text = 'El vendedor no entregó el bien y tuve gastos y daños.';
  const answer = buildCustomerDecisionAnswer({
    documentText: text,
    userInstruction: '¿Qué puedo reclamar?',
    selectedCategory: 'argentina-legal-documents',
    financialAnalysis: null,
    scamRiskAnalysis: analyzeScamRisk(text),
    argentinaLegalAnalysis: analyzeArgentinaLegal(text, true, '¿Qué puedo reclamar?', 'civil'),
  });
  const rendered = [answer.title, answer.directAnswer, ...answer.findings, ...answer.nextActions].join(' ');
  assert.match(rendered, /incumplimiento.*prueba del perjuicio/is);
  assert.match(rendered, /cumplimiento, resolver el contrato.*restitución.*reparación/is);
  assert.doesNotMatch(answer.title, /penal|tributario|laboral/i);
});

test('la respuesta administrativa prioriza acto expediente notificación y recurso', () => {
  const text = 'Un organismo provincial rechazó mi habilitación mediante una resolución.';
  const answer = buildCustomerDecisionAnswer({
    documentText: text,
    userInstruction: '¿Cómo puedo impugnarla?',
    selectedCategory: 'argentina-legal-documents',
    financialAnalysis: null,
    scamRiskAnalysis: analyzeScamRisk(text),
    argentinaLegalAnalysis: analyzeArgentinaLegal(text, true, '¿Cómo puedo impugnarla?', 'administrative'),
  });
  const rendered = [answer.title, answer.directAnswer, ...answer.findings, ...answer.nextActions].join(' ');
  assert.match(rendered, /acto.*notificación.*expediente.*vía/is);
  assert.match(rendered, /régimen nacional no debe aplicarse automáticamente/i);
  assert.doesNotMatch(answer.title, /civil|comercial|financier/i);
});

test('la respuesta general de familia separa asuntos personales patrimoniales y urgentes', () => {
  const text = 'Estoy por divorciarme, tenemos hijos, vivienda y bienes.';
  const answer = buildCustomerDecisionAnswer({
    documentText: text, userInstruction: '¿Qué tengo que ordenar primero?', selectedCategory: 'argentina-legal-documents',
    financialAnalysis: null, scamRiskAnalysis: analyzeScamRisk(text),
    argentinaLegalAnalysis: analyzeArgentinaLegal(text, true, '¿Qué tengo que ordenar primero?', 'family'),
  });
  const rendered = [answer.title, answer.directAnswer, ...answer.findings, ...answer.nextActions].join(' ');
  assert.match(rendered, /centro de vida.*acuerdos.*medidas vigentes/is);
  assert.match(rendered, /separar los asuntos personales de los patrimoniales/i);
});

test('la respuesta penal no convierte un incumplimiento contractual en delito', () => {
  const text = 'Una empresa no cumplió el acuerdo y quiero denunciar una estafa.';
  const answer = buildCustomerDecisionAnswer({
    documentText: text, userInstruction: '¿Es delito?', selectedCategory: 'argentina-legal-documents',
    financialAnalysis: null, scamRiskAnalysis: analyzeScamRisk(text),
    argentinaLegalAnalysis: analyzeArgentinaLegal(text, true, '¿Es delito?', 'criminal'),
  });
  const rendered = [answer.title, answer.directAnswer, ...answer.findings, ...answer.nextActions].join(' ');
  assert.match(rendered, /conducta concreta, evidencia y circunstancias/i);
  assert.match(rendered, /no convierte automáticamente.*delito/i);
});

test('la respuesta comercial distingue sociedades títulos garantías y concursos', () => {
  const text = 'Los socios discuten una decisión del directorio y la empresa tiene cheques vencidos.';
  const answer = buildCustomerDecisionAnswer({
    documentText: text, userInstruction: '¿Qué vías existen?', selectedCategory: 'argentina-legal-documents',
    financialAnalysis: null, scamRiskAnalysis: analyzeScamRisk(text),
    argentinaLegalAnalysis: analyzeArgentinaLegal(text, true, '¿Qué vías existen?', 'commercial'),
  });
  const rendered = [answer.title, answer.directAnswer, ...answer.findings, ...answer.nextActions].join(' ');
  assert.match(rendered, /sociedad.*título de crédito.*situación concursal/is);
  assert.match(rendered, /personalidad jurídica.*administradores, socios o garantes/i);
});

test('responde específicamente cómo se distribuye una herencia entre cónyuge e hijos', () => {
  const question = 'Si muere el padre de una familia, ¿cómo se reparte la herencia entre su viuda y dos hijos?';
  for (const branch of ['family', 'civil', 'succession'] as const) {
    const legal = analyzeArgentinaLegal(question, true, question, branch);
    const answer = buildCustomerDecisionAnswer({
      documentText: question, userInstruction: question, selectedCategory: 'argentina-legal-documents',
      financialAnalysis: null, scamRiskAnalysis: analyzeScamRisk(question), argentinaLegalAnalysis: legal,
    });
    const rendered = [answer.title, answer.directAnswer, ...answer.findings, ...answer.nextActions].join(' ');
    assert.match(rendered, /bienes propios.*misma porción que (?:cada|un) hijo/is);
    assert.match(rendered, /50%.*cada hijo recibe 25%/is);
    assert.match(rendered, /artículo 2426.*artículo 2433/is);
    assert.doesNotMatch(answer.title, /caso de familia debe organizarse|reclamo civil/i);
  }
});

test('muestra una advertencia clara si la rama seleccionada contradice la consulta', () => {
  const question = 'Me despidieron y no me pagaron la indemnización.';
  const legal = analyzeArgentinaLegal(question, true, question, 'criminal');
  const answer = buildCustomerDecisionAnswer({
    documentText: question, userInstruction: question, selectedCategory: 'argentina-legal-documents',
    financialAnalysis: null, scamRiskAnalysis: analyzeScamRisk(question), argentinaLegalAnalysis: legal,
  });
  assert.match(answer.categoryWarning || '', /Laboral.*Penal/i);
});
