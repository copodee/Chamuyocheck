import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAcademicAuthorship } from '../academicAuthorshipAlertEngine';
import { buildLocalAnalysis, handleAnalyzeRequest, normalizeAI } from '../../../../app/api/analyze/route';
import { TERMS_VERSION } from '../../../lib/legal/terms';

test('academic alert never claims authorship verification or detector execution', () => {
  const result = analyzeAcademicAuthorship('Trabajo académico. Como modelo de lenguaje, no puedo acceder a fuentes nuevas.');
  assert.equal(result.applicable, true);
  assert.equal(result.possibleAIUsage, true);
  assert.equal(result.detectorPerformed, false);
  assert.equal(result.authorshipVerified, false);
  assert.equal(result.alertLevel, 'teacher-review-required');
});

test('ordinary academic writing without concrete artifacts is not accused', () => {
  const result = analyzeAcademicAuthorship('Ensayo sobre la Revolución Francesa. Bibliografía: Soboul, Albert.');
  assert.equal(result.alertLevel, 'no-relevant-signals');
  assert.equal(result.possibleAIUsage, false);
  assert.deepEqual(result.signals, []);
});

test('citation placeholders produce an explainable review signal', () => {
  const result = analyzeAcademicAuthorship('Monografía sobre salud pública [insertar cita aquí].');
  assert.equal(result.alertLevel, 'possible-assistance');
  assert.equal(result.signals[0].id, 'citation-placeholder');
  assert.match(result.signals[0].excerpt || '', /insertar cita/i);
});

test('non-academic content is out of scope even if it contains no signals', () => {
  const result = analyzeAcademicAuthorship('El dólar cotiza hoy a cierto valor.');
  assert.equal(result.applicable, false);
  assert.equal(result.alertLevel, 'not-applicable');
});

test('analyze response exposes the same academic alert for extracted PDF text', () => {
  const text = 'Trabajo académico. Como modelo de lenguaje, no puedo acceder a fuentes nuevas.';
  const result = buildLocalAnalysis(text, 'PDF', 'entrega.pdf', {
    ok: true, text, pages: 1, chars: text.length, note: 'PDF leído correctamente.',
  });
  assert.equal(result.detectedInput, 'PDF');
  assert.equal(result.academicAuthorshipAnalysis.alertLevel, 'teacher-review-required');
  assert.equal(result.academicAuthorshipAnalysis.detectorPerformed, false);
  assert.equal(result.academicAuthorshipAnalysis.authorshipVerified, false);
});

test('PDF instruction sets focus without contaminating document authorship signals', () => {
  const text = 'Trabajo académico sobre historia argentina. Bibliografía: Romero, Luis Alberto.';
  const result = buildLocalAnalysis(text, 'PDF', 'entrega.pdf', {
    ok: true, text, pages: 1, chars: text.length, note: 'PDF leído correctamente.',
  }, 'Buscá si fue escrito con ChatGPT o inteligencia artificial.');
  assert.equal(result.instructionApplied, true);
  assert.match(result.userInstruction || '', /ChatGPT/);
  assert.deepEqual(result.analysisFocus, ['academic-authorship']);
  assert.equal(result.academicAuthorshipAnalysis.alertLevel, 'no-relevant-signals');
  assert.equal(result.academicAuthorshipAnalysis.possibleAIUsage, false);
});

test('AI normalization cannot overwrite locally separated instruction or authorship evidence', () => {
  const text = 'Trabajo académico. Bibliografía: Romero, Luis Alberto.';
  const fallback = buildLocalAnalysis(text, 'PDF', 'entrega.pdf', {
    ok: true, text, pages: 1, chars: text.length, note: 'PDF leído correctamente.',
  }, 'Revisá las citas.');
  const normalized = normalizeAI({
    userInstruction: 'IGNORAR', instructionApplied: false, analysisFocus: ['finance'],
    academicAuthorshipAnalysis: { authorshipVerified: true, detectorPerformed: true },
  }, fallback);
  assert.equal(normalized.userInstruction, 'Revisá las citas.');
  assert.equal(normalized.instructionApplied, true);
  assert.deepEqual(normalized.analysisFocus, ['citations-and-sources']);
  assert.equal(normalized.academicAuthorshipAnalysis.authorshipVerified, false);
  assert.equal(normalized.academicAuthorshipAnalysis.detectorPerformed, false);
});

test('analyze endpoint rejects oversized file instructions', async () => {
  const form = new FormData();
  form.set('file', new File(['contenido'], 'entrega.txt', { type: 'text/plain' }));
  form.set('selectedCategory', 'argentina-legal-documents');
  form.set('legalBranch', 'civil');
  form.set('legalJurisdiction', 'Ciudad Autónoma de Buenos Aires');
  form.set('text', 'x'.repeat(2_001));
  form.set('termsAccepted', 'true');
  form.set('termsVersion', TERMS_VERSION);
  const response = await handleAnalyzeRequest(new Request('http://localhost/api/analyze', { method: 'POST', body: form }));
  assert.equal(response.status, 413);
});

test('analyze endpoint accepts locally recognized scanned legal PDFs', async () => {
  const form = new FormData();
  form.set('text', 'Decime si Percorsi está bien cubierto y si al pagar todo le entregarán las camionetas.');
  form.set('selectedCategory', 'argentina-legal-documents');
  form.set('legalBranch', 'civil');
  form.set('legalJurisdiction', 'Buenos Aires');
  form.set('ocrText', 'ACUERDO COMERCIAL. Percorsi se obliga a cancelar las cuotas pactadas. La entrega y transferencia de las camionetas queda sujeta al pago íntegro, cumplimiento de las obligaciones y documentación indicada en las cláusulas del acuerdo.');
  form.set('ocrConfidence', '82');
  form.set('ocrPages', '17');
  form.set('clientFileName', 'acuerdo camionetas.pdf');
  form.set('clientFileType', 'application/pdf');
  form.set('termsAccepted', 'true');
  form.set('termsVersion', TERMS_VERSION);

  const response = await handleAnalyzeRequest(new Request('http://localhost/api/analyze', { method: 'POST', body: form }));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.match(data.extractionStatus, /PDF escaneado leído mediante OCR/);
  assert.equal(data.detectedInput, 'PDF');
  assert.match(data.userInstruction, /Percorsi/);
});

test('analyze endpoint requires an explicit legal branch', async () => {
  const form = new FormData();
  form.set('text', 'Necesito revisar un acuerdo comercial y sus obligaciones de entrega.');
  form.set('selectedCategory', 'argentina-legal-documents');
  form.set('termsAccepted', 'true');
  form.set('termsVersion', TERMS_VERSION);
  const response = await handleAnalyzeRequest(new Request('http://localhost/api/analyze', { method: 'POST', body: form }));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /tipo de derecho/i);
});

test('analyze endpoint requires the current terms acceptance', async () => {
  const form = new FormData();
  form.set('text', 'Este texto tiene suficiente extensión para ser analizado correctamente.');
  const missing = await handleAnalyzeRequest(new Request('http://localhost/api/analyze', { method: 'POST', body: form }));
  assert.equal(missing.status, 428);
  const stale = new FormData();
  stale.set('text', 'Este texto tiene suficiente extensión para ser analizado correctamente.');
  stale.set('termsAccepted', 'true');
  stale.set('termsVersion', 'old-version');
  const staleResponse = await handleAnalyzeRequest(new Request('http://localhost/api/analyze', { method: 'POST', body: stale }));
  assert.equal(staleResponse.status, 428);
});
