import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCommercialCourse } from '../commercialCourseAnalysis';

test('analiza coherencia de un curso de éxito comercial', () => {
  const result = analyzeCommercialCourse('Este curso te enseña a facturar un millón por mes sin experiencia. Casos de éxito garantizados. Cuesta $500.000 en tres cuotas.');
  assert.equal(result.applicable, true);
  assert.ok(result.observedPromises.length > 0);
  assert.ok(result.coherenceIssues.some((item) => /facturación/.test(item)));
  assert.ok(result.coherenceIssues.some((item) => /testimonios|casos/.test(item)));
});
