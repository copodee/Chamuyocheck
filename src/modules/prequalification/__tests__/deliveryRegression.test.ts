import assert from 'node:assert/strict';
import test from 'node:test';
import { stage2NotificationHtml } from '../infrastructure/email/resendProvider';
import { buildDossierPdf } from '../reports/dossierPdf';

test('el informe PDF conserva la generación del expediente para revisión humana', async () => {
  const pdf = await buildDossierPdf({
    caseNumber: 'LS-TEST-1',
    subject: 'Empresa de prueba',
    cuitMasked: '**-1234567-*',
    stage1: {
      status: 'manual-review', score: 50, currentSituation: null,
      maximumSituation: null, totalDebt: 0, creditorCount: 0, rejectedChecks: 0,
    },
    economic: {
      status: 'manual-review', score: 50, confidence: 'documental',
      normalizedMonthlyIncome: null, totalCommitmentCoverage: null,
      reasons: [], conditions: ['Revisión contable requerida.'],
    },
    documents: [{ name: 'balance.pdf', kind: 'balance-1', status: 'needs-review' }],
    submittedForManualReview: true,
  });
  assert.ok(pdf.byteLength > 500);
  assert.equal(String.fromCharCode(...pdf.slice(0, 4)), '%PDF');
});

test('la plantilla Resend conserva el estado existente de revisión manual', () => {
  const html = stage2NotificationHtml({
    caseNumber: 'LS-TEST-1', subject: 'Empresa de prueba',
    responseEmail: 'persona@example.com', economicStatus: 'manual-review',
    economicProfile: 'legal-entity', economicScore: 50, confidence: 'documental',
    normalizedMonthlyIncome: null, declaredMonthlyIncome: null,
    documentedMonthlyIncome: null, declaredDocumentedDifference: null,
    declaredDocumentedDifferenceRatio: null, proposedMonthlyCanon: 100,
    declaredMonthlyDebtService: 0, maximumPrudentCanon: null,
    installmentToIncomeRatio: null, totalCommitmentCoverage: null,
    reasons: [], conditions: ['Revisión contable requerida.'],
    regulatoryExposure: {
      applicable: false, label: 'No aplicable', totalExposure: 0,
      computableNetWorth: null, exposureToNetWorthRatio: null,
      basicMarginAvailable: null,
    },
    documents: [{ name: 'balance.pdf', kind: 'balance-1' }],
    downloadLinks: [], submittedForManualReview: true,
  });
  assert.match(html, /REVISI[ÓO]N MANUAL/i);
  assert.match(html, /ENVIADO PARA REVISI[ÓO]N HUMANA/i);
  assert.match(html, /LS-TEST-1/);
});
