export type AcademicAuthorshipAlertLevel =
  | 'not-applicable'
  | 'no-relevant-signals'
  | 'possible-assistance'
  | 'teacher-review-required';

export type AcademicAuthorshipSignal = {
  id: string;
  severity: 'weak' | 'moderate' | 'strong';
  explanation: string;
  excerpt?: string;
};

export type AcademicAuthorshipAlert = {
  applicable: boolean;
  alertLevel: AcademicAuthorshipAlertLevel;
  possibleAIUsage: boolean;
  detectorPerformed: false;
  authorshipVerified: false;
  signals: AcademicAuthorshipSignal[];
  evidenceToRequest: string[];
  oralDefenseQuestions: string[];
  limitations: string[];
};

const ACADEMIC_CONTEXT = /\b(tesis|monografía|ensayo|trabajo práctico|trabajo académico|informe académico|alumno|estudiante|universidad|facultad|colegio|bibliografía|referencias)\b/i;
const AI_SELF_REFERENCE = /\b(como (?:modelo|asistente) de (?:lenguaje|ia)|no puedo (?:acceder|navegar)|mi fecha de corte|soy una inteligencia artificial)\b/i;
const PROMPT_RESIDUE = /\b(?:system prompt|instrucciones del usuario|respuesta final|a continuación redactaré|como chatgpt)\b/i;
const PLACEHOLDER_CITATION = /\[(?:insertar|agregar|añadir|citation needed|cita requerida)[^\]]*\]|\((?:autor|apellido),?\s*(?:año|xxxx)\)/i;
const REFERENCES_HEADING = /\b(bibliografía|referencias)\b/i;
const IN_TEXT_CITATION = /\([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúÑñ-]+,?\s+(?:19|20)\d{2}\)|\[\d+\]/;

function excerptFor(text: string, pattern: RegExp): string | undefined {
  const match = pattern.exec(text);
  if (!match || match.index === undefined) return undefined;
  return text.slice(Math.max(0, match.index - 45), Math.min(text.length, match.index + match[0].length + 45)).replace(/\s+/g, ' ').trim();
}

/** Text-only authorship screening. It raises review signals, never proof. */
export function analyzeAcademicAuthorship(text: string): AcademicAuthorshipAlert {
  const applicable = ACADEMIC_CONTEXT.test(text);
  const signals: AcademicAuthorshipSignal[] = [];

  if (AI_SELF_REFERENCE.test(text)) signals.push({
    id: 'ai-self-reference', severity: 'strong',
    explanation: 'Aparece una autorreferencia típica de un asistente de IA; puede ser una cita y requiere contexto.',
    excerpt: excerptFor(text, AI_SELF_REFERENCE),
  });
  if (PROMPT_RESIDUE.test(text)) signals.push({
    id: 'prompt-residue', severity: 'strong',
    explanation: 'Aparecen restos de instrucciones o formato conversacional que no suelen pertenecer al trabajo final.',
    excerpt: excerptFor(text, PROMPT_RESIDUE),
  });
  if (PLACEHOLDER_CITATION.test(text)) signals.push({
    id: 'citation-placeholder', severity: 'moderate',
    explanation: 'El texto conserva un marcador de cita sin completar.',
    excerpt: excerptFor(text, PLACEHOLDER_CITATION),
  });
  if (applicable && IN_TEXT_CITATION.test(text) && !REFERENCES_HEADING.test(text)) signals.push({
    id: 'citations-without-references', severity: 'moderate',
    explanation: 'Se detectan citas internas pero no una sección de referencias o bibliografía.',
  });

  const strong = signals.filter((signal) => signal.severity === 'strong').length;
  const moderate = signals.filter((signal) => signal.severity === 'moderate').length;
  const alertLevel: AcademicAuthorshipAlertLevel = !applicable
    ? 'not-applicable'
    : strong > 0 || moderate > 1
      ? 'teacher-review-required'
      : moderate > 0
        ? 'possible-assistance'
        : 'no-relevant-signals';

  return {
    applicable,
    alertLevel,
    possibleAIUsage: alertLevel === 'possible-assistance' || alertLevel === 'teacher-review-required',
    detectorPerformed: false,
    authorshipVerified: false,
    signals,
    evidenceToRequest: applicable ? [
      'Borradores o versiones intermedias con fechas.',
      'Historial de edición cuando esté disponible.',
      'Fuentes consultadas y notas de lectura.',
      'Declaración del uso permitido o no permitido de herramientas de IA.',
      'Un trabajo anterior comparable del mismo alumno, con autorización.',
    ] : [],
    oralDefenseQuestions: applicable ? [
      '¿Cuál es la tesis central y cómo llegaste a ella?',
      '¿Por qué elegiste esas fuentes y qué aporta cada una?',
      '¿Podés explicar con tus palabras el argumento más importante?',
      '¿Qué parte del trabajo te resultó más difícil y cómo la resolviste?',
      '¿Usaste herramientas de IA? Si fue así, ¿en qué partes y bajo qué criterio?',
    ] : [],
    limitations: [
      'El estilo textual por sí solo no demuestra autoría humana ni uso de IA.',
      'No se ejecutó un detector externo de IA.',
      'La revisión no reemplaza borradores, historial de edición ni defensa oral.',
      'Las señales no deben utilizarse por sí solas para sancionar o acusar al alumno.',
    ],
  };
}
