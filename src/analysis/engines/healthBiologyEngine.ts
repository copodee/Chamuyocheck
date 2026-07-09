export type HealthBiologyVerification = {
  isReproductiveBiology: boolean;
  hasFalsePremise?: boolean;
  contextualAnswer?: string;
  keyTerms: string[];
  ambiguity: string;
  riskFactors: string[];
  verifiedClaims: string[];
};

const reproductiveTerms = /\b(embarazo|embarazada|embarazado|embarazar|gestar|gestación|vientre|útero|matriz|ovarios|óvulo|espermatozoide|esperma|fertilidad|fertilizaci[oó]n|reproducción|reproductiv|trans|transgénero|intersex|sexo biológico|identidad de género)\b/i;

const reproductiveRoleTerms = {
  male: /\b(hombre|varón|macho|masculino|hombre cisgénero|varón cis)\b/i,
  female: /\b(mujer|hembra|femenino|mujer cisgénero|mujer cis)\b/i,
  trans: /\b(trans|transgénero|persona trans|hombre trans|mujer trans|identidad|género)\b/i,
  intersex: /\b(intersex|intersexual)\b/i
};

const medicalTreatmentTerms = /\b(tratamiento|hormonas|hormonal|medicamento|medicina|terapia|pastilla|inyecci[oó]n|c[ií]rugica|intervenci[oó]n)\b/i;

function detectFalsePremise(text: string, keyTerms: string[]): boolean {
  const lower = text.toLowerCase();

  // False premise: cisgender male + pregnancy/gestation + treatment claim
  // WITHOUT explicit mention of trans/intersex context
  const isMaleScope = reproductiveRoleTerms.male.test(lower) && !keyTerms.includes('identidad trans') && !keyTerms.includes('intersex');
  const hasPregnancyTerms = /(embarazo|embarazad|gestar|gestaci[oó]n|vientre)/i.test(lower);
  const hasTreatmentClaim = medicalTreatmentTerms.test(lower);

  // False premise: assumes treatment can enable pregnancy in cisgender male
  if (isMaleScope && hasPregnancyTerms && hasTreatmentClaim) {
    return true;
  }

  return false;
}

export function detectReproductiveBiologyQuestion(text: string): HealthBiologyVerification {
  const lower = text.toLowerCase();
  const isRepro = reproductiveTerms.test(lower);

  if (!isRepro) {
    return {
      isReproductiveBiology: false,
      keyTerms: [],
      ambiguity: '',
      riskFactors: [],
      verifiedClaims: []
    };
  }

  const keyTerms: string[] = [];
  if (reproductiveRoleTerms.male.test(lower)) keyTerms.push('hombre/varón');
  if (reproductiveRoleTerms.female.test(lower)) keyTerms.push('mujer');
  if (reproductiveRoleTerms.trans.test(lower)) keyTerms.push('identidad trans');
  if (reproductiveRoleTerms.intersex.test(lower)) keyTerms.push('intersex');

  const hasFalsePremise = detectFalsePremise(lower, keyTerms);

  let ambiguity = 'El término "hombre" puede referirse a varón cisgénero, hombre trans o personas de otra identidad de género.';
  if (reproductiveRoleTerms.trans.test(lower)) {
    ambiguity = 'Se menciona contexto trans. Es importante aclarar: una persona trans masculina con útero y ovarios funcionales puede gestar un embarazo.';
  } else if (reproductiveRoleTerms.intersex.test(lower)) {
    ambiguity = 'Se menciona contexto intersex. Las características reproductivas pueden variar significativamente en personas intersex.';
  } else if (hasFalsePremise) {
    ambiguity = 'PREMISA FALSA DETECTADA: La pregunta asume que los tratamientos hormonales pueden permitir que un varón cisgénero quede embarazado. Esto no es médicamente soportado. El embarazo en personas trans masculinas solo es posible si conservan útero y ovarios funcionales.';
  }

  const riskFactors = [
    'Ambigüedad en los términos "hombre", "mujer", "género" y "sexo biológico".',
    'Falta de especificación sobre si es pregunta teórica o situación personal.'
  ];

  const verifiedClaims = [
    'Un varón cisgénero típico no tiene útero ni ovarios, por lo que no puede gestar un embarazo.',
    'Para que un embarazo ocurra se requieren, en términos generales: óvulo, espermatozoide y útero funcional.',
    'Personas trans masculinas que conservan útero y ovarios pueden quedar embarazadas.',
    'Personas intersex pueden tener características reproductivas variables según su condición específica.'
  ];

  return {
    isReproductiveBiology: true,
    hasFalsePremise,
    contextualAnswer: buildContextualAnswer(text, keyTerms),
    keyTerms,
    ambiguity,
    riskFactors,
    verifiedClaims
  };
}

function buildContextualAnswer(text: string, keyTerms: string[]): string {
  const lower = text.toLowerCase();
  const hasTreatmentClaim = medicalTreatmentTerms.test(lower);
  const isCismaleFocus = /\bhombre\b/i.test(lower) && !keyTerms.includes('identidad trans') && !keyTerms.includes('intersex');

  // False premise: cisgender male with treatment claim
  if (isCismaleFocus && hasTreatmentClaim && /(embarazo|embarazad|gestar|gestaci[oó]n|vientre)/i.test(lower)) {
    return 'ACLARACIÓN IMPORTANTE: Los tratamientos hormonales NO pueden crear un útero ni ovarios en un varón cisgénero. El embarazo requiere útero y ovarios funcionales. Si la pregunta se refiere a una persona trans masculina que conserva estos órganos, entonces sí puede quedar embarazada. La pregunta como está formulada contiene una premisa biológicamente falsa.';
  }

  if (lower.includes('embarazado') && lower.includes('hombre') && !keyTerms.includes('identidad trans') && !keyTerms.includes('intersex')) {
    return 'Un varón cisgénero no puede gestar un embarazo porque no tiene útero ni ovarios. Sin embargo, una persona trans masculina que conserva útero y ovarios sí puede quedar embarazada. Si la pregunta es sobre "engendrar", es importante aclarar: un varón cisgénero aporta espermatozoides (es decir, "engendra" genéticamente), pero "gestar en su vientre" requiere un útero funcional.';
  }

  if (keyTerms.includes('identidad trans')) {
    return 'La capacidad reproductiva en personas trans depende de si conservan órganos reproductivos funcionales. Una persona trans masculina con útero y ovarios puede quedar embarazada. Tratamientos hormonales pueden afectar la fertilidad, pero no siempre de forma permanente. Se recomienda consultar con especialistas en salud trans y reproducción.';
  }

  if (keyTerms.includes('intersex')) {
    return 'Las personas intersex pueden tener características reproductivas variadas según su condición específica. La capacidad de quedar embarazada dependerá de la presencia y funcionamiento de útero y ovarios en particular. Se recomienda consulta médica especializada para una respuesta personalizada.';
  }

  return 'En términos generales, para un embarazo se requieren: óvulo (del sistema reproductor femenino), espermatozoide (del sistema reproductor masculino) y un útero funcional donde desarrollarse el embrión. La capacidad varía según las características biológicas individuales.';
}
