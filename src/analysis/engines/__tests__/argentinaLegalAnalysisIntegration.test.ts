import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLocalAnalysis, normalizeAI } from '../../../../app/api/analyze/route';

test('integra fragmentos y fuentes jurídicas en el análisis principal', () => {
  const result = buildLocalAnalysis('Contrato en Argentina. La empresa podrá modificar unilateralmente las condiciones sin aviso y aplicar una penalidad de $50.000.', 'Texto', '', null);
  assert.equal(result.argentinaLegalAnalysis.area, 'contracts');
  assert.ok(result.argentinaLegalAnalysis.issues.some((issue) => issue.id === 'unilateral-change'));
  assert.ok(result.evidenceFound.some((item) => /Fragmento jurídico/.test(item)));
  assert.ok(result.categoryScores.some((item) => item.name === 'Revisión jurídica necesaria'));
});

test('normalización no puede borrar el análisis jurídico local', () => {
  const fallback = buildLocalAnalysis('Según el Código Penal argentino, robar un caramelo se castiga con la horca.', 'Texto', '', null);
  const normalized = normalizeAI({ argentinaLegalAnalysis: null }, fallback);
  assert.deepEqual(normalized.argentinaLegalAnalysis, fallback.argentinaLegalAnalysis);
});

test('responde la consulta coloquial sobre pena por violación dentro del derecho argentino', () => {
  const result = buildLocalAnalysis('¿Cuántos años de cárcel le dan a un violador?', 'Texto', '', null, '', '', 'argentina-legal-documents');
  assert.equal(result.argentinaLegalAnalysis.area, 'criminal');
  assert.equal(result.argentinaLegalAnalysis.jurisdiction, 'argentina');
  assert.match(result.decisionAnswer?.directAnswer || '', /6 meses a 4 años/);
  assert.match(result.decisionAnswer?.directAnswer || '', /6 a 15 años/);
  assert.match(result.decisionAnswer?.directAnswer || '', /no puede determinarse/i);
});

test('prioriza derecho de familia frente a la palabra cuota', () => {
  const result = buildLocalAnalysis('Me estoy divorciando y tengo un hijo de 8 años. ¿Hasta qué edad se le debe dar cuota de alimento?', 'Texto', '', null, '', '', 'argentina-legal-documents');
  assert.equal(result.argentinaLegalAnalysis.area, 'family');
  assert.equal(result.decisionAnswer?.kind, 'legal-document');
  assert.match(result.decisionAnswer?.directAnswer || '', /hasta los 21 años/i);
  assert.match(result.decisionAnswer?.directAnswer || '', /hasta los 25 años/i);
  assert.doesNotMatch(result.decisionAnswer?.directAnswer || '', /CFT|costo solicitado/i);
});

test('la categoría legal prevalece ante costos, pagos y honorarios jurídicos', () => {
  const result = buildLocalAnalysis('¿Qué costos y honorarios tengo que pagar si no cumplo una sentencia?', 'Texto', '', null, '', '', 'argentina-legal-documents');
  assert.equal(result.decisionAnswer?.kind, 'legal-document');
  assert.equal(result.argentinaLegalAnalysis.jurisdiction, 'argentina');
  assert.doesNotMatch(result.decisionAnswer?.directAnswer || '', /CFT|cuotas financieras|monto financiado/i);
});

test('la categoría legal excluye puntajes y explicaciones financieras', () => {
  const result = buildLocalAnalysis('Me estoy separando y tengo hijos menores. ¿Hasta cuántos años tengo que darle una cuota de alimento?', 'Texto', '', null, '', '', 'argentina-legal-documents');
  const rendered = JSON.stringify(result);
  assert.equal(result.decisionAnswer?.kind, 'legal-document');
  assert.equal(result.financialAnalysis, null);
  assert.equal(result.categoryScores.some((item) => /financiero|ponzi/i.test(item.name)), false);
  assert.ok(result.categoryScores.some((item) => item.name === 'Revisión jurídica necesaria'));
  assert.doesNotMatch(rendered, /CFT|monto financiado|tasa implícita|Riesgo financiero/i);
});

test('responde sobre embargo e intereses por honorarios impagos', () => {
  const result = buildLocalAnalysis('No le pagué a un abogado, me embargaron las cuentas de mi banco y me cobran intereses por la deuda. ¿Está bien?', 'Texto', '', null, '', '', 'argentina-legal-documents');
  const rendered = JSON.stringify(result);
  assert.equal(result.decisionAnswer?.kind, 'legal-document');
  assert.match(result.decisionAnswer?.directAnswer || '', /Puede estar bien.*no se puede confirmar/is);
  assert.match(result.decisionAnswer?.directAnswer || '', /orden judicial/i);
  assert.match(result.decisionAnswer?.findings.join(' ') || '', /diez días.*ejecución de sentencia/is);
  assert.doesNotMatch(rendered, /No se detectaron alertas textuales específicas|CFT|monto financiado|tasa implícita|Riesgo financiero/i);
});

test('trata el leasing como especialidad transversal sin confundir el puntaje principal', () => {
  const legal = buildLocalAnalysis('¿Qué debo revisar en un contrato de leasing y qué dice el artículo 1238?', 'Texto', '', null, '', '', 'argentina-legal-documents');
  const finance = buildLocalAnalysis('Compará un leasing con un préstamo para comprar una máquina.', 'Texto', '', null, '', '', 'finance-credit');
  assert.equal(legal.argentinaLegalAnalysis.subtopic, 'leasing');
  assert.equal(legal.decisionAnswer?.kind, 'legal-document');
  assert.match(legal.decisionAnswer?.findings.join(' ') || '', /Decreto 1038\/2000.*Decreto 152\/2022.*50%.*10%/is);
  assert.doesNotMatch(legal.decisionAnswer?.findings.join(' ') || '', /20%.*inmuebles no destinados/i);
  assert.equal(legal.categoryScores.some((item) => /Riesgo financiero/i.test(item.name)), false);
  assert.equal(finance.decisionAnswer?.kind, 'financial-product-comparison');
  assert.match(finance.decisionAnswer?.directAnswer || '', /mismo flujo después de impuestos/i);
});

test('el leasing público no presume una cesión universal de coparticipación', () => {
  const result = buildLocalAnalysis('¿Un municipio puede financiar maquinaria con leasing y tiene que ceder coparticipación?', 'Texto', '', null, '', '', 'argentina-legal-documents');
  const rendered = JSON.stringify(result.decisionAnswer);
  assert.match(rendered, /sector público no financiero/i);
  assert.match(rendered, /no un requisito universal|no presumir que siempre/i);
  assert.match(rendered, /autorización presupuestaria y de endeudamiento/i);
});

test('compara leasing internacional sin convertir IFRS 16 en ley contractual o fiscal europea', () => {
  const result = buildLocalAnalysis('Compará el leasing argentino con Estados Unidos y Europa.', 'Texto', '', null, '', '', 'argentina-legal-documents');
  const findings = result.decisionAnswer?.findings.join(' ') || '';
  assert.match(findings, /UCC Article 2A/i);
  assert.match(findings, /ASC Topic 842/i);
  assert.match(findings, /IFRS 16/i);
  assert.match(findings, /No existe un contrato civil único de leasing para toda la Unión/i);
  assert.match(findings, /IVA, deducciones, depreciación.*país por país/i);
});

test('la categoría leasing usa especialista y dimensiones propias', () => {
  const result = buildLocalAnalysis('Compará un leasing de maquinaria con un préstamo. Canon, opción de compra, IVA, seguro y valor residual.', 'Texto', '', null, '', '', 'leasing-specialist');
  assert.equal(result.decisionAnswer?.kind, 'leasing-specialist');
  assert.equal(result.topic, 'leasing');
  assert.ok(result.categoryScores.some((item) => item.name === 'Estructura contractual del leasing'));
  assert.ok(result.categoryScores.some((item) => item.name === 'Tratamiento tributario'));
  assert.ok(result.categoryScores.some((item) => item.name === 'Registro y oponibilidad'));
  assert.equal(result.categoryScores.some((item) => item.name === 'Riesgo financiero'), false);
});

test('leasing separa la jurisdicción del tomador de la presentación fiscal del dador', () => {
  const context = 'Compará impuestos de un leasing automotor. Jurisdicción del tomador y del contrato: Córdoba. Domicilio o lugar de presentación fiscal del dador: Ciudad Autónoma de Buenos Aires. Comparar la jurisdicción del tomador con: Mendoza.';
  const result = buildLocalAnalysis(context, 'Texto', '', null, '', '', 'leasing-specialist');
  const findings = result.decisionAnswer?.findings.join(' ') || '';
  assert.match(findings, /Ciudad Autónoma de Buenos Aires.*0,50%/is);
  assert.match(findings, /Córdoba.*Decreto provincial 484\/2022/is);
  assert.match(findings, /Mendoza.*alícuota general de Sellos del 1%/is);
  assert.doesNotMatch(findings, /Neuquén.*14‰|Jujuy.*8%/is);
});

test('leasing entrega provincias en columnas y separa resultados por tema', () => {
  const result = buildLocalAnalysis('Compará un leasing entre Ciudad Autónoma de Buenos Aires y Mendoza para una persona humana.', 'Texto', '', null, '', '', 'leasing-specialist');
  assert.deepEqual(result.decisionAnswer?.comparisonTable?.columns, ['Ciudad Autónoma de Buenos Aires', 'Mendoza']);
  assert.ok(result.decisionAnswer?.comparisonTable?.rows.some((row) => row.label === 'Sellos del contrato'));
  assert.ok(result.decisionAnswer?.sections?.some((section) => section.title === 'Resultado financiero'));
  assert.ok(result.decisionAnswer?.sections?.some((section) => section.title === 'Ventajas frente a préstamo y prenda'));
  const sections = result.decisionAnswer?.sections?.flatMap((section) => section.items).join(' ') || '';
  assert.match(sections, /no integra el patrimonio del tomador a declarar en Bienes Personales/i);
  assert.match(sections, /puede cubrir hasta el 100%.*no existe una prohibición legal universal/is);
  assert.match(sections, /Costos de la prenda a comparar:.*interés y CFT.*inscripción/is);
});

test('leasing muestra porcentajes y distingue obligación legal de traslado económico', () => {
  const result = buildLocalAnalysis('Analizá los porcentajes de un leasing en Río Negro: sellos, Ingresos Brutos y opción de compra.', 'Texto', '', null, '', '', 'leasing-specialist');
  const findings = result.decisionAnswer?.findings.join(' ') || '';
  assert.match(findings, /Río Negro — Sellos del contrato: 1%/i);
  assert.match(findings, /Ingresos Brutos del dador \(actividad 649100\): 9%/i);
  assert.match(findings, /puede recuperar total o parcialmente.*canon, maxi canon, tasa, comisiones u opción/is);
  assert.match(findings, /salvo que la oferta o el contrato.*factura o reintegra aparte.*se presume incorporado/is);
  assert.match(findings, /en caso contrario se trata como incluido.*evitar doble cómputo/is);
  assert.match(findings, /No sumar mecánicamente Sellos, Ingresos Brutos, patente y opción de compra/i);
});

test('leasing responde gastos y exenciones de la jurisdicción elegida', () => {
  const result = buildLocalAnalysis('Quiero un leasing automotor en Córdoba. ¿Qué gastos voy a tener y de cuáles estoy exento?', 'Texto', '', null, '', '', 'leasing-specialist');
  const findings = result.decisionAnswer?.findings.join(' ') || '';
  assert.match(findings, /Mapa de gastos y exenciones/i);
  assert.match(findings, /Precio financiero: maxi canon o anticipo, cánones, tasa o margen/i);
  assert.match(findings, /Córdoba — Sellos: 0%/i);
  assert.match(findings, /Córdoba — Sellos: 0%.*Decreto 484\/2022/is);
  assert.match(findings, /Beneficios o exenciones verificadas\/condicionadas.*destino económico/is);
  assert.match(findings, /Registración de automotor.*DNRPA/is);
  assert.match(findings, /Finalización:.*ejercicio de la opción.*transferencia de dominio/is);
});

test('leasing no inventa una exención cuando faltan jurisdicción y bien', () => {
  const result = buildLocalAnalysis('¿Qué gastos y exenciones tiene un leasing?', 'Texto', '', null, '', '', 'leasing-specialist');
  assert.match(result.decisionAnswer?.limitations.join(' ') || '', /faltan como mínimo la provincia.*tipo de bien.*tipo fiscal de tomador/is);
});

test('leasing explica ventajas exclusivas frente a otras financiaciones sin prometer ahorro', () => {
  const result = buildLocalAnalysis('Compará un leasing de maquinaria con un préstamo para inversión.', 'Texto', '', null, '', '', 'leasing-specialist');
  const findings = result.decisionAnswer?.findings.join(' ') || '';
  assert.match(findings, /Ventajas diferenciales frente a préstamo, prenda u otra financiación/i);
  assert.match(findings, /propio bien permanece en dominio del dador.*reducir la necesidad.*garantías/is);
  assert.match(findings, /IVA de los cánones puede distribuirse durante el contrato/is);
  assert.match(findings, /perfil de deducción diferente.*No se promete ahorro/is);
  assert.match(findings, /NIIF 16/i);
});

test('leasing distingue financiero operativo y lease-back al analizar la opción', () => {
  const result = buildLocalAnalysis('Analizá un leasing operativo o financiero y la opción de compra.', 'Texto', '', null, '', '', 'leasing-specialist');
  const findings = result.decisionAnswer?.findings.join(' ') || '';
  assert.match(findings, /Leasing contractual argentino.*debe existir una opción de compra/is);
  assert.match(findings, /Leasing financiero:.*maxi canon\/cánones y opción/is);
  assert.match(findings, /Leasing operativo:.*Si no hay una verdadera opción de compra.*locación/is);
  assert.match(findings, /Lease-back:.*venta inicial.*eventual recompra/is);
  assert.match(findings, /Control de la opción: informar valor o fórmula.*IVA.*Sellos/is);
});

test('leasing calcula sistema francés garantía inicial gasto y TIR del dador', () => {
  const prompt = 'Caso práctico: leasing financiero con sistema francés. Tipo de bien: Maquinaria o equipo. Valor del bien sin IVA: 100000000. Porcentaje financiado: 80%. Plazo: 36 meses. TNA: 42%. Opción de compra porcentual: 5%. Opción de compra importe fijo: no aplica. Cánones de garantía recibidos al inicio y aplicados a las últimas cuotas: 3. Gasto de estructuración: 3% del valor financiado.';
  const result = buildLocalAnalysis(prompt, 'Texto', '', null, '', '', 'leasing-specialist');
  const findings = result.decisionAnswer?.findings.join(' ') || '';
  assert.match(findings, /sistema francés.*canon periódico constante/is);
  assert.match(findings, /Valor neto sin IVA financiado: 80\.000\.000.*80%/is);
  assert.match(findings, /IVA se analiza por separado/is);
  assert.match(findings, /Cánones de garantía al inicio: 3.*no se cuenta otra vez/is);
  assert.match(findings, /Gasto de estructuración: 3%.*2\.400\.000/is);
  assert.match(findings, /TIR estimada del dador.*mensual.*efectiva anual/is);
});

test('leasing acepta una opción de compra pactada como importe fijo', () => {
  const prompt = 'Caso práctico: leasing financiero con sistema francés. Valor del bien sin IVA: 100000000. Porcentaje financiado: 80%. Plazo: 36 meses. TNA: 42%. Opción de compra porcentual: no aplica. Opción de compra importe fijo: 7000000. Cánones de garantía recibidos al inicio y aplicados a las últimas cuotas: 0. Gasto de estructuración: 2% del valor financiado.';
  const result = buildLocalAnalysis(prompt, 'Texto', '', null, '', '', 'leasing-specialist');
  const findings = result.decisionAnswer?.findings.join(' ') || '';
  assert.match(findings, /Opción pactada usada en el cálculo: 7\.000\.000 como importe fijo/is);
});
