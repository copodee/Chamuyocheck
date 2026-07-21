import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeArgentinaLegal } from '../argentinaLegalAnalysis';

test('clasifica contrato argentino y justifica cláusulas concretas', () => {
  const result = analyzeArgentinaLegal('Contrato argentino. El proveedor podrá modificar unilateralmente el precio sin aviso. Renovación automática. Penalidad de $100.000.');
  assert.equal(result.area, 'contracts');
  assert.equal(result.jurisdiction, 'argentina');
  assert.ok(result.issues.some((issue) => issue.id === 'unilateral-change'));
  assert.ok(result.issues.every((issue) => issue.evidence.length > 0));
});

test('una consulta penal no determina delito sin hechos', () => {
  const result = analyzeArgentinaLegal('Según el Código Penal argentino, ¿qué pena tiene un robo?');
  assert.equal(result.area, 'criminal');
  assert.ok(result.factsNeeded.some((item) => /conducta/.test(item)));
  assert.match(result.sourceTargets[0], /Código Penal/);
});

test('divorcio identifica familia y datos relevantes', () => {
  const result = analyzeArgentinaLegal('Quiero iniciar un divorcio en Argentina y tenemos hijos y bienes.');
  assert.equal(result.area, 'family');
  assert.ok(result.sourceTargets.some((item) => /Código Civil y Comercial/));
});

test('no asume Argentina cuando falta jurisdicción', () => {
  const result = analyzeArgentinaLegal('Este contrato permite cancelar sin aviso.');
  assert.equal(result.jurisdiction, 'not-specified');
  assert.match(result.conclusion, /no corresponde aplicar automáticamente/);
});

test('reconoce una consulta coloquial por violación y pide los hechos relevantes', () => {
  const result = analyzeArgentinaLegal('¿Cuántos años de cárcel le dan a un violador?', true);
  assert.equal(result.applicable, true);
  assert.equal(result.jurisdiction, 'argentina');
  assert.equal(result.area, 'criminal');
  assert.ok(result.factsNeeded.some((item) => /edad de la víctima/i.test(item)));
});

test('subcategoriza las ramas jurídicas y asigna sus fuentes oficiales', () => {
  const civil = analyzeArgentinaLegal('Me embargaron por una deuda y me cobran intereses.', true);
  const commercial = analyzeArgentinaLegal('Una sociedad entró en concurso preventivo y los socios discuten el directorio.', true);
  const administrative = analyzeArgentinaLegal('Quiero recurrir una multa de un organismo estatal y revisar el acto administrativo.', true);
  assert.equal(civil.legalBranch, 'civil');
  assert.ok(civil.sourceTargets.some((item) => /Código Civil y Comercial/i.test(item)));
  assert.equal(commercial.legalBranch, 'commercial');
  assert.ok(commercial.sourceTargets.some((item) => /Ley General de Sociedades 19\.550/i.test(item)));
  assert.ok(commercial.sourceTargets.some((item) => /Concursos y Quiebras 24\.522/i.test(item)));
  assert.equal(administrative.legalBranch, 'administrative');
  assert.ok(administrative.sourceTargets.some((item) => /19\.549/i.test(item)));
  assert.ok(administrative.sourceTargets.some((item) => /1759\/72/i.test(item)));
});

test('subcategoriza problemas jurídicos por materia y pide hechos específicos', () => {
  const consumer = analyzeArgentinaLegal('Un proveedor no respeta la garantía legal del producto.', true);
  const insurance = analyzeArgentinaLegal('La aseguradora rechazó el siniestro de mi póliza.', true);
  const damages = analyzeArgentinaLegal('Quiero reclamar daños y perjuicios por un accidente.', true);
  const tax = analyzeArgentinaLegal('ARCA me notificó una determinación de oficio de un impuesto.', true);
  assert.equal(consumer.subtopic, 'consumer');
  assert.ok(consumer.sourceTargets.some((item) => /24\.240/i.test(item)));
  assert.equal(insurance.subtopic, 'insurance');
  assert.ok(insurance.factsNeeded.some((item) => /póliza completa/i.test(item)));
  assert.equal(damages.subtopic, 'civil-damages');
  assert.ok(damages.factsNeeded.some((item) => /relación causal/i.test(item)));
  assert.equal(tax.subtopic, 'tax');
  assert.ok(tax.sourceTargets.some((item) => /11\.683/i.test(item)));
});

test('distingue sociedades concursos títulos y contrataciones públicas', () => {
  const corporate = analyzeArgentinaLegal('Los accionistas cuestionan una decisión del directorio de la sociedad.', true);
  const insolvency = analyzeArgentinaLegal('La empresa está en cesación de pagos y analiza un concurso preventivo.', true);
  const cheque = analyzeArgentinaLegal('Me rechazaron un cheque y quiero ejecutar el título.', true);
  const procurement = analyzeArgentinaLegal('Impugnamos una licitación de un organismo nacional por el pliego.', true);
  assert.equal(corporate.subtopic, 'corporate');
  assert.equal(insolvency.subtopic, 'insolvency');
  assert.ok(insolvency.sourceTargets.some((item) => /24\.522/i.test(item)));
  assert.equal(cheque.subtopic, 'negotiable-instruments');
  assert.ok(cheque.sourceTargets.some((item) => /24\.452/i.test(item)));
  assert.equal(procurement.subtopic, 'public-procurement');
  assert.ok(procurement.sourceTargets.some((item) => /1023\/2001/i.test(item)));
});

test('la pregunta contractual prevalece sobre menciones penales o de leasing incidentales del documento', () => {
  const document = 'ACUERDO COMERCIAL entre dos empresas. El anexo menciona una penalidad contractual, una operación previa de leasing y advierte que una defraudación podría denunciarse. Percorsi pagó las cuotas y reclama la entrega de las camionetas.';
  const question = 'Necesito saber si Percorsi, habiendo pagado todo, tiene riesgo de que Vitalcan no entregue las camionetas según el acuerdo y cómo puede demandar.';
  const result = analyzeArgentinaLegal(`${question}\n${document}`, true, question);
  assert.equal(result.legalBranch, 'commercial');
  assert.equal(result.area, 'contracts');
  assert.equal(result.subtopic, 'contract-review');
  assert.doesNotMatch(result.areaLabel, /penal/i);
  assert.ok(result.sourceTargets.some((item) => /Código Civil y Comercial/i.test(item)));
  assert.ok(result.sourceTargets.every((item) => !/Código Penal/i.test(item)));
});

test('la rama comercial elegida por el usuario prevalece sobre una penalidad contractual', () => {
  const result = analyzeArgentinaLegal('El acuerdo contiene una penalidad por demora.', true, '¿Puedo exigir la entrega pactada?', 'commercial');
  assert.equal(result.legalBranch, 'commercial');
  assert.equal(result.area, 'contracts');
  assert.doesNotMatch(result.areaLabel, /penal/i);
  assert.ok(result.sourceTargets.some((item) => /Código Civil y Comercial/i.test(item)));
});

test('la rama tributaria elegida prioriza fuentes fiscales aunque la consulta sea breve', () => {
  const result = analyzeArgentinaLegal('Recibí esta notificación.', true, '¿Qué debo revisar?', 'tax');
  assert.equal(result.legalBranch, 'tax');
  assert.equal(result.subtopic, 'tax');
  assert.match(result.areaLabel, /tributario/i);
  assert.ok(result.sourceTargets.some((item) => /11\.683/i.test(item)));
});

test('la rama laboral elegida no se desvía a comercial por mencionar empresa y contrato', () => {
  const result = analyzeArgentinaLegal('La empresa terminó mi contrato y no pagó la indemnización.', true, '¿Qué puedo reclamar por el despido?', 'labor');
  assert.equal(result.legalBranch, 'labor');
  assert.equal(result.subtopic, 'labor');
  assert.match(result.areaLabel, /laboral/i);
  assert.ok(result.sourceTargets.some((item) => /20\.744/i.test(item)));
  assert.ok(result.factsNeeded.some((item) => /fecha de ingreso/i.test(item)));
});

test('conserva la jurisdicción elegida y la aplica a las fuentes procesales', () => {
  const result = analyzeArgentinaLegal('Quiero reclamar daños por un incumplimiento.', true, '¿Cómo demando?', 'civil', 'Buenos Aires');
  assert.equal(result.selectedJurisdiction, 'Buenos Aires');
  assert.ok(result.sourceTargets.some((item) => /Buenos Aires/i.test(item)));
});

test('reconoce sucesiones con distintas formas de preguntar aunque se haya elegido familia o civil', () => {
  const variants = [
    'Si muere el padre, ¿cómo se reparte la herencia entre su viuda y sus hijos?',
    'Falleció mi esposo y tenemos dos hijos, ¿cómo se divide la casa?',
    'Murió mi mamá, ¿quiénes heredan?',
    '¿Cómo se reparte un bien ganancial si hay cónyuge y tres hijos?',
  ];
  for (const [index, question] of variants.entries()) {
    const result = analyzeArgentinaLegal(question, true, question, index % 2 ? 'civil' : 'family');
    assert.equal(result.subtopic, 'succession');
    assert.equal(result.detectedBranch, 'succession');
    assert.match(result.sourceTargets.join(' '), /2426.*2433/);
  }
});

test('avisa cuando la consulta no coincide con la rama jurídica seleccionada', () => {
  const result = analyzeArgentinaLegal('Me despidieron y no me pagaron la indemnización.', true, '', 'criminal');
  assert.equal(result.detectedBranch, 'labor');
  assert.match(result.branchSelectionWarning || '', /Laboral.*Penal/i);
});
