import assert from 'node:assert/strict';
import { buildAnalysisReport } from '../reportBuilder.ts';

const text = `
El Gobierno anunció que el empleo registrado creció 2.1% durante el año pasado.
La nota periodística cita a la Secretaría de Trabajo y no ofrece un enlace original.
`;

const report = buildAnalysisReport(text, 'Texto', 'example.txt', null);

if (report.topicLabel !== 'Economía / información pública / nota periodística') {
  throw new Error(`Expected public/economic topic, got ${report.topicLabel}`);
}

if (report.strengths.some((item) => /No se observan|No hay|Falta/i.test(item))) {
  throw new Error('Strengths should not contain absence-based language.');
}

if (!report.risks.some((item) => /contrastar|contexto|desactualizado|trazabilidad/i.test(item))) {
  throw new Error('Expected interpretive risk items.');
}

if (!report.recommendations.some((item) => /fuente|fecha|metodolog/i.test(item))) {
  throw new Error('Expected evidence-seeking recommendations.');
}

console.log('reportBuilder test passed');
