import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runClaimFirstPipeline } from '../claimFirstPipeline';
import { runUniversalClaimReasoning } from '../universalClaimReasoningEngine';
import { runCoreReasoning } from '../coreReasoningEngine';
import { calculateDomainWeightedScore } from '../domainWeightedScoringEngine';

interface TestCase {
  id: string;
  category: string;
  input: string;
  expectedMinScore: number;
  expectedMaxScore: number;
  expectedLabel: string;
  expectedClaimType: string;
  expectedDomain: string;
  notes: string;
}

interface TestResult {
  passed: number;
  failed: number;
  total: number;
  cases: Array<TestCase & { actualScore: number; status: string; error?: string }>;
}

// Comprehensive test cases across all categories
const testCases: TestCase[] = [
  // SCIENCE - Impossible claims (95-100)
  {
    id: 'sci-001',
    category: 'Science',
    input: 'La Tierra es plana.',
    expectedMinScore: 95,
    expectedMaxScore: 100,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'scientific/public-event',
    notes: 'Impossible: flat earth'
  },
  {
    id: 'sci-002',
    category: 'Science',
    input: 'Un dinosaurio vivo caminó por el parque ayer.',
    expectedMinScore: 95,
    expectedMaxScore: 100,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'scientific/public-event',
    notes: 'Impossible: dinosaur alive'
  },
  {
    id: 'sci-003',
    category: 'Science',
    input: 'Los humanos pueden volar sin tecnología.',
    expectedMinScore: 95,
    expectedMaxScore: 100,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'scientific/public-event',
    notes: 'Impossible: humans flying'
  },
  {
    id: 'sci-004',
    category: 'Science',
    input: 'El agua no tiene moléculas.',
    expectedMinScore: 95,
    expectedMaxScore: 100,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'scientific/public-event',
    notes: 'Impossible: water has no molecules'
  },
  {
    id: 'sci-005',
    category: 'Science',
    input: 'Las vacunas contienen microchips que rastrean personas.',
    expectedMinScore: 95,
    expectedMaxScore: 100,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'scientific/public-event',
    notes: 'Impossible: vaccine microchips'
  },

  // SCIENCE - Extraordinary claims (90-98)
  {
    id: 'sci-006',
    category: 'Science',
    input: 'Ayer vi un extraterrestre caminando por la calle.',
    expectedMinScore: 90,
    expectedMaxScore: 98,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'scientific/public-event',
    notes: 'Extraordinary: aliens without evidence'
  },
  {
    id: 'sci-007',
    category: 'Science',
    input: 'Un OVNI pasó sobre mi casa anoche.',
    expectedMinScore: 90,
    expectedMaxScore: 98,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'scientific/public-event',
    notes: 'Extraordinary: UFO sighting'
  },
  {
    id: 'sci-008',
    category: 'Science',
    input: 'Vi un milagro que desafía las leyes de la física.',
    expectedMinScore: 90,
    expectedMaxScore: 98,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'scientific/public-event',
    notes: 'Extraordinary: miracle'
  },
  {
    id: 'sci-009',
    category: 'Science',
    input: 'Descubrieron una tecnología secreta del gobierno.',
    expectedMinScore: 90,
    expectedMaxScore: 98,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'scientific/public-event',
    notes: 'Extraordinary: secret technology'
  },
  {
    id: 'sci-010',
    category: 'Science',
    input: 'Eventos sobrenaturales ocurren cada noche en esa casa.',
    expectedMinScore: 90,
    expectedMaxScore: 98,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'scientific/public-event',
    notes: 'Extraordinary: supernatural events'
  },

  // SCIENCE - Mixed ordinary + extraordinary (should use extraordinary score)
  {
    id: 'sci-011',
    category: 'Science',
    input: 'El cielo estaba azul. Después vi un extraterrestre.',
    expectedMinScore: 90,
    expectedMaxScore: 98,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'scientific/public-event',
    notes: 'Mixed: ordinary sentence should not dilute extraordinary'
  },
  {
    id: 'sci-012',
    category: 'Science',
    input: 'Fue un día normal. Luego ocurrió un milagro inexplicable.',
    expectedMinScore: 90,
    expectedMaxScore: 98,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'scientific/public-event',
    notes: 'Mixed: ordinary context with extraordinary event'
  },

  // BIOLOGY AND HEALTH - Impossible
  {
    id: 'bio-001',
    category: 'Biology/Health',
    input: 'Una mujer puede tener un hijo híbrido humano-perro.',
    expectedMinScore: 95,
    expectedMaxScore: 100,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'scientific/public-event',
    notes: 'Impossible: human-dog hybrid'
  },
  {
    id: 'bio-002',
    category: 'Biology/Health',
    input: 'Un varón puede quedar embarazado naturalmente.',
    expectedMinScore: 95,
    expectedMaxScore: 100,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'scientific/public-event',
    notes: 'Impossible: male pregnancy'
  },
  {
    id: 'bio-003',
    category: 'Biology/Health',
    input: 'Mi cuerpo produce energía ilimitada sin comer.',
    expectedMinScore: 95,
    expectedMaxScore: 100,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'scientific/public-event',
    notes: 'Impossible: perpetual energy from body'
  },

  // BIOLOGY AND HEALTH - Extraordinary
  {
    id: 'bio-004',
    category: 'Biology/Health',
    input: 'Descubrí una cura milagrosa para el cáncer.',
    expectedMinScore: 90,
    expectedMaxScore: 98,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'scientific/public-event',
    notes: 'Extraordinary: miracle cancer cure'
  },
  {
    id: 'bio-005',
    category: 'Biology/Health',
    input: 'Vi a alguien recuperarse de una enfermedad terminal instantáneamente.',
    expectedMinScore: 90,
    expectedMaxScore: 98,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'scientific/public-event',
    notes: 'Extraordinary: instant recovery'
  },

  // MATHEMATICS - Ordinary true facts (0-25)
  {
    id: 'math-001',
    category: 'Mathematics',
    input: '2 + 2 = 4.',
    expectedMinScore: 0,
    expectedMaxScore: 25,
    expectedLabel: 'Bajo chamuyo',
    expectedClaimType: 'factual',
    expectedDomain: 'general',
    notes: 'Correct math: basic addition'
  },
  {
    id: 'math-002',
    category: 'Mathematics',
    input: 'El círculo tiene 360 grados.',
    expectedMinScore: 0,
    expectedMaxScore: 25,
    expectedLabel: 'Bajo chamuyo',
    expectedClaimType: 'factual',
    expectedDomain: 'general',
    notes: 'Correct math: circle degrees'
  },
  {
    id: 'math-003',
    category: 'Mathematics',
    input: 'Si invierto 100.000 pesos al 10% anual, en un año recibiría 110.000.',
    expectedMinScore: 0,
    expectedMaxScore: 25,
    expectedLabel: 'Bajo chamuyo',
    expectedClaimType: 'factual',
    expectedDomain: 'general',
    notes: 'Correct investment math'
  },
  {
    id: 'math-004',
    category: 'Mathematics',
    input: '5 × 8 = 40.',
    expectedMinScore: 0,
    expectedMaxScore: 25,
    expectedLabel: 'Bajo chamuyo',
    expectedClaimType: 'factual',
    expectedDomain: 'general',
    notes: 'Correct math: multiplication'
  },

  // MATHEMATICS - Incorrect math
  {
    id: 'math-005',
    category: 'Mathematics',
    input: '2 + 2 = 5.',
    expectedMinScore: 100,
    expectedMaxScore: 100,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'general',
    notes: 'Conclusively false arithmetic: 2+2 always equals 4, never 5'
  },

  // FINANCE AND INVESTMENT - Scams (95-100)
  {
    id: 'fin-001',
    category: 'Finance/Investment',
    input: 'Gana 10.000 pesos diarios trabajando solo 5 minutos.',
    expectedMinScore: 95,
    expectedMaxScore: 100,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'financial',
    notes: 'Financial scam: unrealistic returns'
  },
  {
    id: 'fin-002',
    category: 'Finance/Investment',
    input: 'Garantizo 100% de ganancia cada mes sin riesgo.',
    expectedMinScore: 95,
    expectedMaxScore: 100,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'financial',
    notes: 'Financial scam: guaranteed returns'
  },
  {
    id: 'fin-003',
    category: 'Finance/Investment',
    input: 'Invierte ahora y multiplica tu dinero en 7 días.',
    expectedMinScore: 95,
    expectedMaxScore: 100,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'financial',
    notes: 'Financial scam: rapid multiplication'
  },
  {
    id: 'fin-004',
    category: 'Finance/Investment',
    input: 'Sistema piramidal: gana reclutando a otros.',
    expectedMinScore: 95,
    expectedMaxScore: 100,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'financial',
    notes: 'Pyramid scheme admission'
  },

  // FINANCE - Legitimate information (0-30)
  {
    id: 'fin-005',
    category: 'Finance/Investment',
    input: 'El plazo fijo actual rinde 35% anual.',
    expectedMinScore: 0,
    expectedMaxScore: 30,
    expectedLabel: 'Bajo chamuyo',
    expectedClaimType: 'factual',
    expectedDomain: 'general',
    notes: 'Legitimate financial fact (verifiable)'
  },
  {
    id: 'fin-006',
    category: 'Finance/Investment',
    input: 'La tasa de cambio del dólar es importante para invertir.',
    expectedMinScore: 0,
    expectedMaxScore: 30,
    expectedLabel: 'Bajo chamuyo',
    expectedClaimType: 'factual',
    expectedDomain: 'general',
    notes: 'True general finance statement'
  },

  // HISTORY - Ordinary true facts (0-25)
  {
    id: 'hist-001',
    category: 'History',
    input: 'La Segunda Guerra Mundial terminó en 1945.',
    expectedMinScore: 0,
    expectedMaxScore: 25,
    expectedLabel: 'Bajo chamuyo',
    expectedClaimType: 'factual',
    expectedDomain: 'general',
    notes: 'Historical fact: WWII end date'
  },
  {
    id: 'hist-002',
    category: 'History',
    input: 'Cristóbal Colón llegó a América en 1492.',
    expectedMinScore: 0,
    expectedMaxScore: 25,
    expectedLabel: 'Bajo chamuyo',
    expectedClaimType: 'factual',
    expectedDomain: 'general',
    notes: 'Historical fact: Columbus discovery'
  },
  {
    id: 'hist-003',
    category: 'History',
    input: 'Argentina se independizó en 1816.',
    expectedMinScore: 0,
    expectedMaxScore: 25,
    expectedLabel: 'Bajo chamuyo',
    expectedClaimType: 'factual',
    expectedDomain: 'general',
    notes: 'Historical fact: Argentina independence'
  },

  // TECHNOLOGY - Ordinary facts (0-25)
  {
    id: 'tech-001',
    category: 'Technology',
    input: 'Internet funciona mediante protocolos de comunicación.',
    expectedMinScore: 0,
    expectedMaxScore: 25,
    expectedLabel: 'Bajo chamuyo',
    expectedClaimType: 'factual',
    expectedDomain: 'general',
    notes: 'True technology statement'
  },
  {
    id: 'tech-002',
    category: 'Technology',
    input: 'Python es un lenguaje de programación.',
    expectedMinScore: 0,
    expectedMaxScore: 25,
    expectedLabel: 'Bajo chamuyo',
    expectedClaimType: 'factual',
    expectedDomain: 'general',
    notes: 'Technology fact'
  },
  {
    id: 'tech-003',
    category: 'Technology',
    input: 'Los chips procesadores se fabrican con silicio.',
    expectedMinScore: 0,
    expectedMaxScore: 25,
    expectedLabel: 'Bajo chamuyo',
    expectedClaimType: 'factual',
    expectedDomain: 'general',
    notes: 'Technology fact'
  },

  // PUBLIC CLAIMS AND NEWS - Extraordinary (90-98)
  {
    id: 'news-001',
    category: 'Public Claims/News',
    input: 'Encontré una cura para el SIDA que el gobierno oculta.',
    expectedMinScore: 90,
    expectedMaxScore: 98,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'scientific/public-event',
    notes: 'Extraordinary: hidden cure claim'
  },
  {
    id: 'news-002',
    category: 'Public Claims/News',
    input: 'El gobierno está controlando el clima con chemtrails.',
    expectedMinScore: 90,
    expectedMaxScore: 98,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'scientific/public-event',
    notes: 'Extraordinary: weather control conspiracy'
  },
  {
    id: 'news-003',
    category: 'Public Claims/News',
    input: 'Vi pruebas de que los ataques del 11 de septiembre fueron un montaje.',
    expectedMinScore: 90,
    expectedMaxScore: 98,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'scientific/public-event',
    notes: 'Extraordinary: conspiracy theory'
  },

  // ADVERTISING AND SCAMS (95-100)
  {
    id: 'scam-001',
    category: 'Advertising/Scams',
    input: '¡GANA DINERO YA! Haz clic aquí sin trabajar. Garantizado.',
    expectedMinScore: 95,
    expectedMaxScore: 100,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'advertising',
    expectedDomain: 'financial',
    notes: 'Scam: unrealistic money promise'
  },
  {
    id: 'scam-002',
    category: 'Advertising/Scams',
    input: 'Este producto cura todas las enfermedades.',
    expectedMinScore: 95,
    expectedMaxScore: 100,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'advertising',
    expectedDomain: 'scientific/public-event',
    notes: 'Scam: universal cure claim'
  },
  {
    id: 'scam-003',
    category: 'Advertising/Scams',
    input: 'Únicamente hoy: pierde 20 kg en una semana garantizado.',
    expectedMinScore: 95,
    expectedMaxScore: 100,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'advertising',
    expectedDomain: 'scientific/public-event',
    notes: 'Scam: unrealistic weight loss'
  },
  {
    id: 'scam-004',
    category: 'Advertising/Scams',
    input: 'Príncipe nigeriano: heredarás 5 millones de dólares. Confirma datos.',
    expectedMinScore: 95,
    expectedMaxScore: 100,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'advertising',
    expectedDomain: 'financial',
    notes: 'Scam: Nigerian prince variant'
  },

  // OPINIONS - Should NOT be treated as false (0-35)
  {
    id: 'opin-001',
    category: 'Opinions',
    input: 'Creo que la pizza es mejor que las hamburguesas.',
    expectedMinScore: 0,
    expectedMaxScore: 35,
    expectedLabel: 'Bajo chamuyo',
    expectedClaimType: 'opinion',
    expectedDomain: 'general',
    notes: 'Opinion: preference, not false'
  },
  {
    id: 'opin-002',
    category: 'Opinions',
    input: 'Pienso que ese actor es el mejor de todos.',
    expectedMinScore: 0,
    expectedMaxScore: 35,
    expectedLabel: 'Bajo chamuyo',
    expectedClaimType: 'opinion',
    expectedDomain: 'general',
    notes: 'Opinion: subjective judgment'
  },
  {
    id: 'opin-003',
    category: 'Opinions',
    input: 'Me parece que deberían cambiar las leyes.',
    expectedMinScore: 0,
    expectedMaxScore: 35,
    expectedLabel: 'Bajo chamuyo',
    expectedClaimType: 'opinion',
    expectedDomain: 'general',
    notes: 'Opinion: political view'
  },
  {
    id: 'opin-004',
    category: 'Opinions',
    input: 'Opino que el fútbol es aburrido.',
    expectedMinScore: 0,
    expectedMaxScore: 35,
    expectedLabel: 'Bajo chamuyo',
    expectedClaimType: 'opinion',
    expectedDomain: 'general',
    notes: 'Opinion: entertainment preference'
  },

  // OPINIONS - Overstated as fact (higher score)
  {
    id: 'opin-005',
    category: 'Opinions',
    input: 'DEFINITIVAMENTE el gobierno está robando a todos.',
    expectedMinScore: 35,
    expectedMaxScore: 60,
    expectedLabel: 'Requiere verificación',
    expectedClaimType: 'opinion',
    expectedDomain: 'general',
    notes: 'Opinion overstated with absolute language'
  },

  // PREDICTIONS - Should NOT be treated as false (0-35)
  {
    id: 'pred-001',
    category: 'Predictions',
    input: 'Creo que mañana va a llover.',
    expectedMinScore: 0,
    expectedMaxScore: 35,
    expectedLabel: 'Bajo chamuyo',
    expectedClaimType: 'prediction',
    expectedDomain: 'general',
    notes: 'Prediction: weather, reasonable'
  },
  {
    id: 'pred-002',
    category: 'Predictions',
    input: 'Pienso que el próximo presidente será bueno.',
    expectedMinScore: 0,
    expectedMaxScore: 35,
    expectedLabel: 'Bajo chamuyo',
    expectedClaimType: 'prediction',
    expectedDomain: 'general',
    notes: 'Prediction: political, not false'
  },
  {
    id: 'pred-003',
    category: 'Predictions',
    input: 'La economía mejorará el próximo año.',
    expectedMinScore: 0,
    expectedMaxScore: 35,
    expectedLabel: 'Bajo chamuyo',
    expectedClaimType: 'prediction',
    expectedDomain: 'general',
    notes: 'Prediction: economic forecast'
  },

  // LEGAL/CONTRACTUAL CLAIMS - Usually low chamuyo if factual
  {
    id: 'legal-001',
    category: 'Legal/Contractual',
    input: 'Este contrato tiene 5 cláusulas principales.',
    expectedMinScore: 0,
    expectedMaxScore: 25,
    expectedLabel: 'Bajo chamuyo',
    expectedClaimType: 'factual',
    expectedDomain: 'general',
    notes: 'Legal fact: contract structure'
  },
  {
    id: 'legal-002',
    category: 'Legal/Contractual',
    input: 'La ley requiere que se especifique el CFT en los créditos.',
    expectedMinScore: 0,
    expectedMaxScore: 25,
    expectedLabel: 'Bajo chamuyo',
    expectedClaimType: 'factual',
    expectedDomain: 'general',
    notes: 'Legal requirement'
  },

  // LEGAL - False legal claims
  {
    id: 'legal-003',
    category: 'Legal/Contractual',
    input: 'No es legal exigir que se especifique el costo financiero.',
    expectedMinScore: 50,
    expectedMaxScore: 85,
    expectedLabel: 'Alto chamuyo',
    expectedClaimType: 'factual',
    expectedDomain: 'general',
    notes: 'False legal claim'
  },

  // ORDINARY TRUE FACTS - Should be very low (0-25)
  {
    id: 'ord-001',
    category: 'Ordinary Facts',
    input: 'Messi ganó el Mundial 2022 con Argentina.',
    expectedMinScore: 0,
    expectedMaxScore: 25,
    expectedLabel: 'Bajo chamuyo',
    expectedClaimType: 'factual',
    expectedDomain: 'general',
    notes: 'Ordinary true fact: sports'
  },
  {
    id: 'ord-002',
    category: 'Ordinary Facts',
    input: 'Buenos Aires es la capital de Argentina.',
    expectedMinScore: 0,
    expectedMaxScore: 25,
    expectedLabel: 'Bajo chamuyo',
    expectedClaimType: 'factual',
    expectedDomain: 'general',
    notes: 'Ordinary true fact: geography'
  },
  {
    id: 'ord-003',
    category: 'Ordinary Facts',
    input: 'El agua hierve a 100 grados Celsius.',
    expectedMinScore: 0,
    expectedMaxScore: 25,
    expectedLabel: 'Bajo chamuyo',
    expectedClaimType: 'factual',
    expectedDomain: 'general',
    notes: 'Ordinary true fact: physics'
  },
  {
    id: 'ord-004',
    category: 'Ordinary Facts',
    input: 'El año tiene 365 días.',
    expectedMinScore: 0,
    expectedMaxScore: 25,
    expectedLabel: 'Bajo chamuyo',
    expectedClaimType: 'factual',
    expectedDomain: 'general',
    notes: 'Ordinary true fact: calendar'
  },
  {
    id: 'ord-005',
    category: 'Ordinary Facts',
    input: 'Los pájaros pueden volar.',
    expectedMinScore: 0,
    expectedMaxScore: 25,
    expectedLabel: 'Bajo chamuyo',
    expectedClaimType: 'factual',
    expectedDomain: 'general',
    notes: 'Ordinary true fact: biology'
  },

  // MIXED CASES - Key regression tests
  {
    id: 'mix-001',
    category: 'Mixed',
    input: 'El cielo está azul. Extraterrestres aterrizaron en mi patio.',
    expectedMinScore: 90,
    expectedMaxScore: 98,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'scientific/public-event',
    notes: 'KEY: Extraordinary claim NOT diluted by ordinary sentence'
  },
  {
    id: 'mix-002',
    category: 'Mixed',
    input: 'Desayuné café. El gobierno oculta la cura para el cáncer.',
    expectedMinScore: 90,
    expectedMaxScore: 98,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'scientific/public-event',
    notes: 'KEY: Multiple claims, extraordinary dominates'
  },
  {
    id: 'mix-003',
    category: 'Mixed',
    input: 'Creo que mañana llueve. El agua no tiene moléculas.',
    expectedMinScore: 95,
    expectedMaxScore: 100,
    expectedLabel: 'Chamuyo extremo',
    expectedClaimType: 'factual',
    expectedDomain: 'scientific/public-event',
    notes: 'KEY: Impossible claim overrides prediction'
  },
];

// Run all tests
async function runTests() {
  const results: TestResult = {
    passed: 0,
    failed: 0,
    total: testCases.length,
    cases: []
  };

  const categoryStats: Record<string, { passed: number; total: number }> = {};

  console.log('\n🧪 V19.1 Comprehensive Regression Test Suite\n');
  console.log(`Running ${testCases.length} test cases...\n`);

  for (const testCase of testCases) {
    try {
      // Initialize category stats
      if (!categoryStats[testCase.category]) {
        categoryStats[testCase.category] = { passed: 0, total: 0 };
      }
      categoryStats[testCase.category].total++;

      // Run the production pipeline
      const claimResult = runClaimFirstPipeline(testCase.input);
      const universalResult = runUniversalClaimReasoning(testCase.input);
      const coreResult = runCoreReasoning(testCase.input);

      // Determine final score (same logic as route.ts)
      let finalScore: number;
      if (claimResult.finalScore === 100) {
        finalScore = 100;
      } else if (claimResult.finalScore >= 90) {
        finalScore = Math.max(claimResult.finalScore, 90);
      } else if (universalResult.forceScore !== null) {
        finalScore = universalResult.forceScore;
      } else if (coreResult.forcedScore !== null) {
        finalScore = coreResult.forcedScore;
      } else {
        finalScore = claimResult.finalScore;
      }

      // Clamp to 0-100
      finalScore = Math.max(0, Math.min(100, Math.round(finalScore)));

      // Determine risk label
      const riskLabel =
        finalScore > 80
          ? 'Chamuyo extremo'
          : finalScore > 60
            ? 'Alto chamuyo'
            : finalScore > 40
              ? 'Requiere verificación'
              : 'Bajo chamuyo';

      // Check if test passed
      const scorePassed =
        finalScore >= testCase.expectedMinScore && finalScore <= testCase.expectedMaxScore;
      const labelPassed = riskLabel === testCase.expectedLabel;
      const passed = scorePassed && labelPassed;

      if (passed) {
        results.passed++;
        categoryStats[testCase.category].passed++;
      } else {
        results.failed++;
      }

      results.cases.push({
        ...testCase,
        actualScore: finalScore,
        status: passed ? 'PASS' : 'FAIL',
        error: !passed
          ? `Score: ${finalScore} (expected ${testCase.expectedMinScore}-${testCase.expectedMaxScore}), Label: ${riskLabel} (expected ${testCase.expectedLabel})`
          : undefined
      });
    } catch (error) {
      results.failed++;
      if (!categoryStats[testCase.category]) {
        categoryStats[testCase.category] = { passed: 0, total: 0 };
      }
      categoryStats[testCase.category].total++;

      results.cases.push({
        ...testCase,
        actualScore: 0,
        status: 'ERROR',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Print summary
  console.log('\n📊 TEST SUMMARY\n');
  console.log(`Total Cases:    ${results.total}`);
  console.log(`Passed:         ${results.passed}`);
  console.log(`Failed:         ${results.failed}`);
  console.log(
    `Accuracy:       ${((results.passed / results.total) * 100).toFixed(2)}%\n`
  );

  console.log('📈 ACCURACY BY CATEGORY\n');
  for (const [category, stats] of Object.entries(categoryStats).sort()) {
    const accuracy = ((stats.passed / stats.total) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round((stats.passed / stats.total) * 20));
    console.log(
      `${category.padEnd(20)} ${bar.padEnd(20)} ${stats.passed}/${stats.total} (${accuracy}%)`
    );
  }

  // Print failed cases
  const failedCases = results.cases.filter((c) => c.status !== 'PASS');
  if (failedCases.length > 0) {
    console.log('\n❌ FAILED CASES\n');
    for (const failedCase of failedCases) {
      console.log(`ID: ${failedCase.id}`);
      console.log(`Category: ${failedCase.category}`);
      console.log(`Input: "${failedCase.input}"`);
      console.log(`Status: ${failedCase.status}`);
      console.log(`Error: ${failedCase.error}`);
      console.log('---');
    }
  } else {
    console.log('\n✅ ALL TESTS PASSED!\n');
  }

  // Return results for test framework
  return results;
}

// Run tests with node test runner
test('Comprehensive Regression Suite', async () => {
  const results = await runTests();
  assert.equal(results.failed, 0, `${results.failed} test(s) failed`);
});

// Also run standalone if executed directly
if (require.main === module || import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}
