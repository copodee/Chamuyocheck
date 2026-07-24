import { mkdir, writeFile } from 'node:fs/promises';
import { buildDossierPdf } from '../src/modules/prequalification/reports/dossierPdf';

async function main() {
const output = 'output/pdf/precalificacion-LS-2026-000123.pdf';
await mkdir('output/pdf', { recursive: true });
await writeFile(output, await buildDossierPdf({
  caseNumber: 'LS-2026-000123',
  subject: 'EMPRESA ARGENTINA DE PRUEBA SA',
  cuitMasked: '**-1234567-*',
  stage1: { status: 'prequalified', score: 86, currentSituation: 1, maximumSituation: 1, totalDebt: 8_450_000, creditorCount: 2, rejectedChecks: 0, modelVersion: 'bcra-v1' },
  contact: { fullName: 'Empresa Argentina de Prueba SA', email: 'solicitante@ejemplo.com', mobile: '+54 9 11 5555-5555', address: 'Av. Corrientes 1000', city: 'CABA', province: 'Ciudad Autónoma de Buenos Aires' },
  economic: { status: 'compatible', score: 82, normalizedMonthlyIncome: 5_500_000, installmentToIncomeRatio: .27 },
  compliance: { pepStatus: 'no', fundsLawfulOrigin: true, ownAccount: true, obligedSubject: false },
  decision: 'ready',
  responseEmail: 'solicitante@ejemplo.com',
}));
console.log(output);
}
main();
