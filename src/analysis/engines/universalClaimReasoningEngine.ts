import { extractClaims } from './claimExtractionEngine';

export type UniversalReasoningResult = {
  triggered: boolean;
  forceScore: number | null;
  severity: 'extreme' | 'high' | 'none';
  category: string;
  claimDescription: string;
  explanation: string;
  whyImpossible: string[];
  evidenceNeeded: string[];
};

// -----------------------------------------------------------------------
// Scientific impossibility patterns - improved for natural Spanish language
// -----------------------------------------------------------------------
type SciImpossibility = { pattern: RegExp; label: string; explanation: string; facts: string[] };

const SCIENTIFIC_IMPOSSIBILITIES: SciImpossibility[] = [
  {
    pattern: /tierra\s+(?:es\s+|está\s+|era\s+)?plana|tierra\s+plana|el\s+mundo\s+es\s+plano|planeta\s+(?:es\s+)?plano|la\s+tierra\s+no\s+es\s+redonda|el\s+globo\s+(?:es|fue)\s+(?:una\s+mentira|falso|inventado)/i,
    label: 'Tierra plana',
    explanation: 'La forma esférica de la Tierra es un hecho verificado por observación directa, fotografías satelitales, física orbital y miles de años de navegación.',
    facts: [
      'La esfericidad de la Tierra fue demostrada científicamente hace más de 2.300 años.',
      'Astronautas, satélites y física orbital confirman la forma esférica del planeta.',
      'La navegación GPS, eclipses lunares y el horizonte visual son consistentes con un planeta esférico.'
    ]
  },
  {
    pattern: /vacunas?\s+(?:contienen?|tienen?|llevan?|traen?|con|incluyen?|inyectan?)\s+microchips?|vacunas?\s+(?:contienen?|tienen?|llevan?|traen?|con|incluyen?|inyectan?)\s+chips?|microchip[s]?\s+en\s+(?:las\s+)?vacunas?|chip[s]?\s+en\s+(?:las\s+)?vacunas?/i,
    label: 'Vacunas con microchips',
    explanation: 'Las vacunas no contienen microchips ni dispositivos electrónicos. Su composición es pública, analizada por laboratorios independientes en todo el mundo.',
    facts: [
      'La composición de las vacunas aprobadas es pública y analizada por múltiples laboratorios independientes.',
      'Un microchip electrónico no puede ser inyectado con una jeringa estándar; es físicamente incompatible.',
      'Ninguna investigación científica independiente ha encontrado dispositivos electrónicos en vacunas.'
    ]
  },
  {
    pattern: /alunizaje\s+(?:fue\s+)?(?:falso|inventado|faked|fake|mentira)|nasa\s+(?:falsificó|mintió|inventó)\s+(?:el\s+)?(?:alunizaje|luna)|nunca\s+(?:llegamos?|fueron?)\s+a\s+la\s+luna|la\s+luna\s+no\s+(?:existe|es\s+real|fue\s+visitada)/i,
    label: 'Negación del alunizaje',
    explanation: 'El alunizaje del Apolo 11 en 1969 es un hecho histórico verificado por miles de fuentes independientes, incluyendo naciones que eran rivales de EEUU.',
    facts: [
      'El alunizaje fue seguido en tiempo real por estaciones de control en múltiples países, incluyendo la URSS.',
      'Muestras lunares fueron analizadas por laboratorios de decenas de países.',
      'La NASA publicó 1.407 horas de grabaciones, miles de fotografías y telemetría verificable.'
    ]
  },
  {
    pattern: /2\s*\+\s*2\s*(?:es|=|son|igual[s]?)\s*5|dos\s+(?:más|mas)\s+dos\s+(?:es|son|igual)\s+cinco/i,
    label: 'Imposibilidad matemática (2+2=5)',
    explanation: '2+2=4 es un axioma matemático básico verificable en cualquier sistema de numeración estándar.',
    facts: [
      '2+2=4 es un axioma de la aritmética básica.',
      'Es verificable de forma independiente en cualquier contexto.'
    ]
  },
  {
    pattern: /el\s+sol\s+(?:gira|orbita|da\s+vueltas?)\s+(?:alrededor|en\s+torno)\s+(?:de\s+la\s+)?tierra|la\s+tierra\s+(?:está|es)\s+el\s+centro\s+(?:del\s+universo|del\s+sistema)/i,
    label: 'Geocentrismo',
    explanation: 'La Tierra orbita al Sol. El heliocentrismo es un hecho científico verificado desde el siglo XVI y confirmado por física orbital, sondas espaciales y astronomía moderna.',
    facts: [
      'La Tierra orbita al Sol, no al revés; esto fue verificado por Copérnico, Galileo y la física newtoniana.',
      'Las sondas espaciales y el GPS confirman el modelo heliocéntrico con precisión milimétrica.'
    ]
  },
  // ---- Miracle cures with non-medical substances ----
  {
    pattern: /(?:c[aá]ncer|tumor|leucemia|metástasis|miest[aá]sis)\s+se\s+(?:cura|curable|elimina|trata)\s+(?:con|tomando|usando|bebiendo|aplicando)\s+(?:bicarbonato|lim[oó]n|vinagre|miel|ajo|aceite\s+de\s+coco|aloe|jugo\s+de|t[eé]\s+verde|c[uú]rcuma|curcuma|jugo\s+de|hierba)/i,
    label: 'Cura milagrosa del cáncer sin base médica',
    explanation: 'No existe evidencia científica verificable de que el cáncer se cure con bicarbonato, limón u otros remedios caseros. Las terapias para cáncer requieren evaluación médica y oncológica.',
    facts: [
      'El cáncer requiere tratamiento oncológico verificado; ningún remedio casero tiene evidencia clínica de cura.',
      'La afirmación contradice décadas de investigación biomédica revisada por pares.',
      'El uso de remedios sin base médica puede retrasar tratamientos que sí tienen evidencia.'
    ]
  },
  // ---- Historical figures doing impossible things (pre-space age) ----
  {
    pattern: /(napole[oó]n|julio\s+c[eé]sar|alejandro\s+(?:el\s+)?magno|cle[oó]patra|jesucristo|jes[uú]s|los\s+romanos?|los\s+griegos?\s+antiguos?|los\s+aztecas?|los\s+mayas?|los\s+egipcios\s+antiguos?|los\s+vikingos?)\s+(?:conquist[oó]|visit[oó]|lleg[oó]\s+a|estuvo\s+en|fue\s+a|viajó\s+a|fueron\s+a)\s+(?:marte|júpiter|saturno|otros\s+planetas?|el\s+espacio\s+exterior|la\s+luna\s+(?!en\s+1969))/i,
    label: 'Imposibilidad histórica (viaje espacial pre-moderno)',
    explanation: 'La exploración espacial y los viajes a planetas son imposibles con la tecnología de las civilizaciones antiguas. Los primeros vuelos espaciales ocurrieron en el siglo XX.',
    facts: [
      'El primer vuelo espacial tripulado fue el de Yuri Gagarin en 1961.',
      'La tecnología para viajes a planetas no existía en la antigüedad ni en el siglo XIX.',
      'La afirmación contradice la historia documentada de la tecnología y la exploración espacial.'
    ]
  },
  // ---- Impossible technology ----
  {
    pattern: /(?:celular|tel[eé]fono|dispositivo|m[oó]vil|bater[ií]a)\s+se\s+(?:carga|recarga|alimenta|funciona)\s+(?:con|por|mediante|a\s+trav[eé]s\s+de)\s+(?:telepat[ií]a|telekinesis|la\s+mente|el\s+pensamiento|la\s+voluntad|energía\s+mental)|cargar\s+(?:un\s+)?(?:celular|tel[eé]fono|dispositivo)\s+(?:con|por)\s+(?:telepat[ií]a|telekinesis|la\s+mente|el\s+pensamiento)/i,
    label: 'Tecnología imposible (carga por telepatía)',
    explanation: 'Ningún dispositivo electrónico puede cargarse mediante telepatía, telekinesis o el pensamiento. La carga eléctrica requiere transferencia de energía electromagnética.',
    facts: [
      'Los dispositivos electrónicos requieren energía eléctrica para funcionar y cargarse.',
      'La telepatía y telekinesis no tienen respaldo científico verificable.',
      'No existe ninguna tecnología ni mecanismo físico que permita carga mental de dispositivos.'
    ]
  }
];

// -----------------------------------------------------------------------
// Extraordinary claim + money request detection (beyond financial math)
// -----------------------------------------------------------------------
const EXTRAORDINARY_CLAIMS = [
  /(?:ver|visitar|encontrar|tocar|fotografiar|conocer)\s+(?:dinosauri[ao]s?|mamuts?|pterod[aá]ctilos?|especies\s+extintas?)/i,
  /(?:aliens?|extraterrestres?|ovnis?)\s+(?:viven?|están?|existen?)\s+(?:en|entre)/i,
  /(?:secreto|tecnología|cura)\s+(?:oculto|prohibido|suprimido|escondido)\s+(?:del\s+gobierno|por\s+la\s+nasa|por\s+los\s+médicos)/i,
  /bigfoot|yeti|pie\s+grande|monstruo\s+del\s+lago|el\s+chupacabras?\s+(?:existe|es\s+real)/i,
];

const MONEY_WITH_ACCESS = /(?:pag[aá][r]?|cobra[rn]?|cuesta|vale|costo|precio|deposita[r]?|transfi[eé]r[ei]r?|abon[ao]|enviar?)\s*[^.]{0,40}?\$?\s*\d[\d.,]*/i;

export function runUniversalClaimReasoning(text: string): UniversalReasoningResult {
  const empty: UniversalReasoningResult = {
    triggered: false,
    forceScore: null,
    severity: 'none',
    category: 'none',
    claimDescription: '',
    explanation: '',
    whyImpossible: [],
    evidenceNeeded: []
  };

  // --- 1. Scientific impossibilities (improved patterns) ---
  for (const item of SCIENTIFIC_IMPOSSIBILITIES) {
    if (item.pattern.test(text)) {
      return {
        triggered: true,
        forceScore: 100,
        severity: 'extreme',
        category: 'scientific-impossibility',
        claimDescription: item.label,
        explanation: item.explanation,
        whyImpossible: item.facts,
        evidenceNeeded: [
          'Publicación en revista científica con revisión por pares que refute el consenso actual.',
          'Evidencia experimental reproducible de forma independiente.',
          'Confirmación por múltiples instituciones científicas sin interés en el resultado.'
        ]
      };
    }
  }

  // --- 2. Extinct species alive ---
  const claims = extractClaims(text);

  if (claims.detected && claims.hasAliveAssertion) {
    const speciesLabel = claims.speciesLabel ?? claims.speciesName ?? 'especie extinta';

    // Extraordinary + money = 100
    if (claims.hasMoneyRequest) {
      return {
        triggered: true,
        forceScore: 100,
        severity: 'extreme',
        category: 'extinct-species-alive-with-money',
        claimDescription: `Afirmación de que ${speciesLabel} existen hoy + solicitud de dinero`,
        explanation: `La afirmación de que ${speciesLabel} están vivos contradice el registro paleontológico y científico global. Además, se solicita dinero para "acceder" a esta promesa extraordinaria.`,
        whyImpossible: [
          `La extinción de los ${claims.speciesName} es un hecho verificado por el registro fósil, datación radiométrica y consenso paleontológico global.`,
          'No existe ningún reporte científico verificado de ejemplares vivos en ningún lugar del planeta.',
          'Solicitar dinero para acceder a una afirmación extraordinaria sin evidencia es un patrón clásico de estafa.'
        ],
        evidenceNeeded: [
          'Especímenes vivos verificados por una institución científica reconocida.',
          'Publicación en revista de paleontología o biología con revisión por pares.',
          'Acceso libre a la evidencia, sin requerir pago previo para verla.'
        ]
      };
    }

    // Just extinct species alive (no money) = 95
    return {
      triggered: true,
      forceScore: 95,
      severity: 'extreme',
      category: 'extinct-species-alive',
      claimDescription: `Afirmación de que ${speciesLabel} están vivos actualmente`,
      explanation: `La afirmación contradice el registro paleontológico y científico: los ${claims.speciesName} son una especie extinta documentada.`,
      whyImpossible: [
        `La extinción de los ${claims.speciesName} está documentada por el registro fósil y datación radiométrica.`,
        'No existe evidencia científica verificable de ejemplares vivos.',
        'La afirmación contradice conocimiento biológico y paleontológico ampliamente aceptado.'
      ],
      evidenceNeeded: [
        'Especímenes físicos verificados por la comunidad científica internacional.',
        'Publicación en revista científica con revisión por pares.',
        'Confirmación por múltiples instituciones científicas independientes.'
      ]
    };
  }

  // --- 3. Extraordinary claim keyword + money request ---
  const hasExtraordinaryClaim = EXTRAORDINARY_CLAIMS.some((p) => p.test(text));
  const hasMoneyWithAccess = MONEY_WITH_ACCESS.test(text);

  if (hasExtraordinaryClaim && hasMoneyWithAccess) {
    return {
      triggered: true,
      forceScore: 100,
      severity: 'extreme',
      category: 'extraordinary-claim-with-money',
      claimDescription: 'Afirmación extraordinaria combinada con solicitud de pago',
      explanation: 'Se detectó una afirmación extraordinaria (sin respaldo verificable) combinada con una solicitud de dinero. Este patrón es consistente con estafa.',
      whyImpossible: [
        'La afirmación no tiene respaldo en fuentes verificables y se solicita dinero para acceder a la promesa.',
        'Las afirmaciones extraordinarias requieren evidencia extraordinaria; no se encontró ninguna.'
      ],
      evidenceNeeded: [
        'Evidencia verificable y pública de la afirmación, sin requerir pago previo.',
        'Fuente científica o institucional que respalde la promesa.'
      ]
    };
  }

  // --- 4. Known scientific facts (returns LOW score) ---
  // Checked last so bad patterns always take priority
  const KNOWN_FACTS: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /el\s+agua\s+(?:hierve|hierbe)\s+a\s+(?:100|cien)\s+(?:grados?|°)\s*(?:celsius|cent[ií]grados?)?\s*(?:a\s+nivel\s+del\s+mar)?/i, label: 'Temperatura de ebullición del agua' },
    { pattern: /la\s+velocidad\s+de\s+la\s+luz\s+(?:es|equivale)\s+(?:a\s+)?(?:299|300)\s*(?:\.?\d*)?\s*(?:mil)?\s*(?:km|kilómetros?)/i, label: 'Velocidad de la luz' },
    { pattern: /la\s+tierra\s+(?:tarda|demora)\s+(?:365|un\s+año)\s+(?:días?\s+)?en\s+(?:girar|orbitar|dar\s+una\s+vuelta)/i, label: 'Período orbital de la Tierra' },
    { pattern: /e\s*=\s*mc\s*[²2]|energía\s+(?:es\s+igual\s+a|equivale\s+a)\s+masa\s+(?:por\s+)?(?:velocidad|c\s*al\s+cuadrado)/i, label: 'Relatividad masa-energía (E=mc²)' },
    { pattern: /la\s+gravedad\s+(?:en\s+la\s+tierra\s+)?(?:es|equivale\s+a)\s+(?:9[,.]8|diez)\s*(?:m\/s|metros\s+por\s+segundo)/i, label: 'Aceleración gravitacional' },
    { pattern: /los\s+(?:seres\s+humanos?|humanos?)\s+(?:respiran?|inhalan?|necesitan?)\s+ox[íi]geno/i, label: 'Necesidad de oxígeno' },
    { pattern: /la\s+fotosíntesis\s+(?:es|convierte|transforma)/i, label: 'Fotosíntesis' },
  ];

  for (const fact of KNOWN_FACTS) {
    if (fact.pattern.test(text)) {
      return {
        triggered: true,
        forceScore: 8,
        severity: 'none',
        category: 'known-scientific-fact',
        claimDescription: fact.label,
        explanation: 'La afirmación corresponde a un hecho científico verificado y ampliamente aceptado.',
        whyImpossible: [],
        evidenceNeeded: []
      };
    }
  }

  return empty;
}
