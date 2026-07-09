export type ScientificPremiseValidation = {
  hasInvalidPremise: boolean;
  severity: 'extreme' | 'high' | 'medium' | 'none';
  category: 'interspecies-hybrid' | 'reproductive-impossibility' | 'scientific-impossibility' | 'none';
  conclusion: string;
  confidence: number;
  reasoning: string[];
};

// Detect human-animal hybrids and cross-species reproduction
function detectInterspeciesHybrid(text: string): boolean {
  const lower = text.toLowerCase();

  // Keywords for animal species in reproduction context
  const animalSpecies = /\b(perro|canino|gato|felino|caballo|equino|vaca|bovino|cerdo|porcino|primate|mono|chimpancé|oso|ave|pajaro|pez|peces|pez|insecto|reptil|serpiente|lagartija|anfibio)\b/i;

  // Keywords for human-animal hybrids
  const hybridTerms = /(mezcla.*humano.*animal|mezcla.*canino|mezcla.*felino|mezcla.*especie|híbrido.*humano|híbrido.*animal|mitad.*humano.*mitad.*animal|mitad.*humano.*mitad.*perro|mitad.*humano.*mitad.*gato|humano.*canino|humano.*felino|espermatozoides.*animal|óvulo.*animal|genética.*cruzada.*especies|hijo.*perro|hijo.*gato|hijo.*animal|cría.*humano.*animal|embarazo.*animal|preñez.*animal)/i;

  // Keywords for sexual activity with animals
  const animalReproduction = /(relaciones.*sexuales.*con.*animal|sexual.*con.*perro|sexual.*con.*gato|sexual.*con.*caballo|copular.*animal|apareamiento.*humano.*animal|cohabitar.*animal|fecundar.*animal)/i;

  const hasAnimal = animalSpecies.test(lower);
  const hasHybridTerms = hybridTerms.test(lower);
  const hasAnimalReproduction = animalReproduction.test(lower);
  const hasPregnancyTerms = /(embarazo|embarazad|embarazada|gestaci|gestar|vientre|hijo|hijos|cría|preñez|feto|fetal|parto)/i.test(lower);

  // Trigger: animal species + (hybrid terms OR animal reproduction) + pregnancy
  if (hasAnimal && (hasHybridTerms || hasAnimalReproduction) && hasPregnancyTerms) {
    return true;
  }

  return false;
}

// Detect reproductive impossibilities
function detectReproductiveImpossibility(text: string): boolean {
  const lower = text.toLowerCase();

  // Incompatible reproductive scenarios
  const incompatibleTerms = /(mujer.*embarazo|embarazo|gestación|concepción|fecundación)/i;

  // Pregnancy without reproductive organs
  const noOrgans = /(sin útero|sin ovarios|sin aparato|ausencia.*útero|ausencia.*ovario|sin capacidad reproductiva)/i;

  // Treatment creating organs that don't exist
  const treatmentCreatesOrgans = /(tratamiento.*crea.*útero|tratamiento.*crea.*ovario|terapia.*genera.*órgano|hormona.*genera.*útero|hormona.*crea.*reproducti)/i;

  // Cross-species conception
  const crossSpecies = /(especie.*diferente|especies.*incompatibles|reproducción.*especies|concepto.*entre.*especies)/i;

  if (incompatibleTerms.test(lower)) {
    if (noOrgans.test(lower) || treatmentCreatesOrgans.test(lower) || crossSpecies.test(lower)) {
      return true;
    }
  }

  return false;
}

// Detect scientific impossibilities
function detectScientificImpossibility(text: string): boolean {
  const lower = text.toLowerCase();

  const impossibilities = [
    // Flat earth
    /\b(tierra plana|mundo plano|planeta plano|globe es mentira)\b/i,

    // Vaccines with microchips
    /\b(vacuna.*microchip|vacuna.*chip|vacun.*implante.*electrónico|vacun.*nano.*robot|vacun.*control mental|vacuna.*seguimiento)\b/i,

    // Mathematical impossibilities
    /\b(2\s*\+\s*2\s*=\s*5|dos más dos es cinco|dos mas dos son cinco)\b/i,

    // Humans breathing underwater without equipment
    /\b(humano.*respir.*agua.*sin.*equipo|persona.*respir.*agua.*sin.*aparato|respirar.*bajo.*agua.*sin.*tanque|branquias.*humano|pulmones.*acuático)\b/i,

    // Miracle cures without evidence
    /\b(cura.*milagrosa.*cáncer|cura.*absoluta.*sida|remedio.*mágico|cura.*garantizada.*diabetes)\b/i,

    // Perpetual motion
    /\b(máquina.*movimiento.*perpetuo|energía.*infinita.*sin.*fuente|motor.*sin.*combustible.*garantizado)\b/i,

    // Teleportation without technology
    /\b(teletransportación.*humano.*sin.*tecnología|teletransport.*mente|viaje.*tiempo.*físico.*sin.*máquina)\b/i
  ];

  return impossibilities.some((regex) => regex.test(lower));
}

export function validateScientificPremise(text: string): ScientificPremiseValidation {
  const lower = text.toLowerCase();
  const reasoning: string[] = [];

  // Check for interspecies hybrids (most severe)
  if (detectInterspeciesHybrid(text)) {
    reasoning.push('Detectada afirmación de reproducción entre especies incompatibles.');
    reasoning.push('La compatibilidad genética requiere afinidad cromosómica básica (número y estructura de cromosomas).');
    reasoning.push('Los híbridos naturales (mulas, ligers) ocurren entre especies proximales; humanos y otros mamíferos no comparten compatibilidad reproductiva.');
    reasoning.push('No existe evidencia científica de reproducción exitosa entre humanos y otras especies.');

    return {
      hasInvalidPremise: true,
      severity: 'extreme',
      category: 'interspecies-hybrid',
      conclusion:
        'No se encontró respaldo verificable para la afirmación; contradice principios básicos de reproducción y compatibilidad genética entre especies.',
      confidence: 0.98,
      reasoning
    };
  }

  // Check for reproductive impossibilities
  if (detectReproductiveImpossibility(text)) {
    reasoning.push('Detectada imposibilidad reproductiva fundamental.');
    reasoning.push('La gestación requiere aparato reproductivo funcional (útero, ovarios).');
    reasoning.push('Los tratamientos hormonales no crean órganos reproductivos nuevos.');
    reasoning.push('La terapia hormonal modifica características sexuales secundarias solamente.');

    return {
      hasInvalidPremise: true,
      severity: 'extreme',
      category: 'reproductive-impossibility',
      conclusion:
        'La afirmación describe un fenómeno incompatible con mecanismos conocidos de reproducción humana.',
      confidence: 0.98,
      reasoning
    };
  }

  // Check for scientific impossibilities
  if (detectScientificImpossibility(text)) {
    reasoning.push('Detectada afirmación de imposibilidad científica.');
    reasoning.push('La premisa contradice leyes naturales verificadas y ampliamente documentadas.');
    reasoning.push('No existe evidencia experimental que respalde la posibilidad descrita.');

    return {
      hasInvalidPremise: true,
      severity: 'extreme',
      category: 'scientific-impossibility',
      conclusion:
        'La afirmación contradice conocimiento científico básico ampliamente aceptado; no existe respaldo verificable.',
      confidence: 0.98,
      reasoning
    };
  }

  return {
    hasInvalidPremise: false,
    severity: 'none',
    category: 'none',
    conclusion: '',
    confidence: 0,
    reasoning: []
  };
}
