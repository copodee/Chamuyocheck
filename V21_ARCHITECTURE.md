# ChamuyoCheck V21 Architecture: Semantic Claim Analysis Pipeline

## Table of Contents

1. [Overview](#overview)
2. [Problem Statement](#problem-statement)
3. [Claim Type Detection (ClaimNature)](#claim-type-detection)
4. [Knowledge Domain Routing](#knowledge-domain-routing)
5. [Specialist Selection & Execution](#specialist-selection--execution)
6. [Scoring Semantics](#scoring-semantics)
7. [External Verification Policy](#external-verification-policy)
8. [Report Intelligence Engine](#report-intelligence-engine)
9. [UI Label Mapping](#ui-label-mapping)
10. [Confidence Model](#confidence-model)
11. [Migration Plan](#migration-plan)
12. [Test Strategy](#test-strategy)
13. [Risks](#risks)
14. [Final Recommendation](#final-recommendation)

---

## Overview

### Current Architecture (V20)
```
TEXT / DOCUMENT
↓
Keyword-based pattern matching
↓
Domain routing (heuristic, sometimes isolated keywords)
↓
Specialist engine
↓
Score (0-100)
↓
UI Report
```

**Problem**: System classifies by presence of keywords, not by understanding what kind of statement is being made.

### Proposed Architecture (V21)
```
TEXT / DOCUMENT
↓
Claim Extraction (sentence/clause boundaries)
↓
[SEMANTIC] Claim Type Detection (fact/opinion/prediction/promise/etc.)
↓
[CONTEXTUAL] Knowledge Domain Routing (independent of nature)
↓
[INTELLIGENT] Specialist Selection (nature + domain → specialist)
↓
[SEMANTIC] External Verification Policy (based on nature + domain)
↓
[NATURE-AWARE] Claim Scoring (scoring rules adapt to nature)
↓
[AGGREGATED] Document Scoring (respect claim hierarchy)
↓
[REPORT INTELLIGENCE] Generate domain- and nature-specific content
↓
UI Report (precise labels, separated confidence, clear explanation)
```

### Key Design Principle

**Claim Nature and Knowledge Domain are independent dimensions.**

A claim has:
- **One primary nature** (what kind of statement it is)
- **One primary domain** (what topic it's about)
- **Optional secondary natures and domains**

This separation enables:
- "Prediction + Finance" (e.g., "Bitcoin will rise")
- "Opinion + Public Policy" (e.g., "Public spending is wasteful")
- "Extraordinary Claim + Public Claims" (e.g., "Aliens landed in Buenos Aires")
- "Advertisement + Health" (e.g., "Buy this supplement and lose weight")

---

## Problem Statement

### Current Failures

| Input | Current Behavior | Correct Behavior |
|-------|-----------------|------------------|
| "Bitcoin va a subir." | Treated as general content; keyword triggers finance routing loosely | Prediction + Finance; acknowledge uncertainty; require future verification |
| "La salud pública necesita más inversión." | Treated as health content (word "salud") | Opinion + Public Policy + Health Policy; recognize subjective stance |
| "Messi fue el mejor jugador del Mundial." | Routed to history/sports; scored as fact | Opinion + History/Sports; evaluate subjective framing |
| "Messi ganó el Mundial 2022." | Routed to history/sports correctly | Fact + History/Sports; verify historical record |
| "Se vio un OVNI ayer sobre Córdoba." | May route to science or public-claims ambiguously | Extraordinary Claim + Testimony + Public Claims + Science; require exceptional evidence |
| "Comprá este suplemento y vas a adelgazar." | Generic health pattern matching | Advertisement + Promise + Health; evaluate guarantee language; identify omitted conditions |
| "El agua hierve a 100 °C a nivel del mar." | Treated as generic science | Fact + Science; verify physical constants |
| "Bitcoin va a duplicarse mañana con seguridad." | Finance prediction with keyword boost | Prediction + Promise + Finance; high chamuyo (manipulative certainty) |
| "¿Puede un hombre quedar embarazado mediante hormonas?" | May trigger health routing | Question + Biology Health; score the premise, not the act of asking |
| "Creo que esta película es mala." | Vague routing | Opinion + Culture/Entertainment; evaluate subjective harm and context |

**Common Pattern**: System relies on isolated keywords rather than semantic understanding of statement structure.

---

## Claim Type Detection

### ClaimNature Type Definition

```typescript
type ClaimNature = 
  | 'fact'                  // Verifiable or falsifiable statement about reality
  | 'opinion'               // Subjective evaluation or belief
  | 'prediction'            // Statement about future events
  | 'recommendation'        // Suggestion or advice
  | 'question'              // Information-seeking query
  | 'extraordinary-claim'   // Claims of extreme/impossible events
  | 'advertisement'         // Marketing or promotional content
  | 'promise'               // Guarantee or commitment (often within advertisement)
  | 'rumor'                 // Unverified claim attributed to others
  | 'testimony'             // First-hand witness account
  | 'statistic'             // Quantified factual claim (often cherry-picked)
  | 'legal-assertion'       // Claims about law, contracts, or rights
  | 'financial-offer'       // Explicit investment or money opportunity
  | 'mixed'                 // Multiple natures in single claim
  | 'unknown';              // Unable to determine nature
```

### ClaimNatureResult Type Definition

```typescript
type ClaimNatureResult = {
  primaryNature: ClaimNature;
  secondaryNatures: ClaimNature[];
  confidence: number;  // 0.0-1.0
  factualVerifiability: 
    | 'currently-verifiable'      // Can be checked now
    | 'future-verifiable'         // Can only be checked later
    | 'subjective'                // Inherently subjective
    | 'requires-external-source'  // Needs external data
    | 'not-applicable';           // Not a statement about reality
  linguisticSignals: string[];    // e.g., ["future-tense", "absolute-language", "guarantee"]
  reason: string;                 // Explanation of detection
};
```

### Detection Principles (NOT Keyword-Only)

#### 1. Fact
**Definition**: A statement asserting something is or was true about reality.

**Detection Signals**:
- Present or past tense
- Assertion of existence, occurrence, or property
- No subjective evaluation markers
- No future modality
- No modal uncertainty ("may", "might", "could")

**Examples**:
```
"El agua hierve a 100 °C a nivel del mar."
→ primaryNature: fact
→ linguisticSignals: ["present-tense", "physical-constant", "verifiable"]
→ factualVerifiability: currently-verifiable

"Messi ganó el Mundial 2022."
→ primaryNature: fact
→ linguisticSignals: ["past-tense", "event-claim", "historical"]
→ factualVerifiability: currently-verifiable
```

#### 2. Opinion
**Definition**: A statement of subjective evaluation, belief, or judgment.

**Detection Signals**:
- Evaluative adjectives ("mejor", "peor", "bueno", "malo", "hermoso", "horrible")
- Explicit opinion markers ("creo que", "opino que", "me parece")
- Subjective framing of objective facts
- Absence of measurable basis
- Cannot be contradicted by facts alone

**Examples**:
```
"Messi fue el mejor jugador del Mundial."
→ primaryNature: opinion
→ linguisticSignals: ["superlative-adjective", "subjective-evaluation"]
→ factualVerifiability: subjective

"La salud pública necesita más inversión."
→ primaryNature: opinion
→ secondaryNatures: recommendation
→ linguisticSignals: ["necessity-claim", "policy-evaluation", "normative"]
→ factualVerifiability: subjective

"Esta película es mala."
→ primaryNature: opinion
→ linguisticSignals: ["evaluative-adjective", "subjective"]
→ factualVerifiability: subjective
```

#### 3. Prediction
**Definition**: A statement about future occurrence, outcome, or state.

**Detection Signals**:
- Future tense ("va a", "será", "mañana", "próximo")
- Conditional framing
- Temporal markers (dates, time horizons)
- Basis for prediction (often weak or absent)
- Inherently uncertain until outcome occurs

**Examples**:
```
"Bitcoin va a subir."
→ primaryNature: prediction
→ linguisticSignals: ["future-tense", "no-basis"]
→ factualVerifiability: future-verifiable

"Messi ganará el próximo Mundial."
→ primaryNature: prediction
→ linguisticSignals: ["future-tense", "sports-event"]
→ factualVerifiability: future-verifiable

"El gobierno va a cambiar la ley el mes próximo."
→ primaryNature: prediction
→ linguisticSignals: ["future-tense", "government-action"]
→ factualVerifiability: future-verifiable
```

#### 4. Recommendation
**Definition**: Advice or suggestion for action.

**Detection Signals**:
- Imperative mood ("comprá", "haz", "investiga")
- Hortative subjunctive ("deberías", "podrías")
- "Should", "must", "should not"
- Implied benefit or risk reduction
- May include criteria for suitability

**Examples**:
```
"Comprá Bitcoin ahora."
→ primaryNature: recommendation
→ secondaryNatures: financial-offer, promise
→ linguisticSignals: ["imperative", "urgency"]

"Deberías verificar esta información."
→ primaryNature: recommendation
→ linguisticSignals: ["hortative", "epistemic-warrant"]
```

#### 5. Question
**Definition**: Information-seeking utterance.

**Detection Signals**:
- Interrogative mood
- Ends with "?"
- Seeks confirmation or information
- Often contains implicit premise

**Scoring Principle**: Score the **premise**, not the act of asking.

**Examples**:
```
"¿Puede un hombre quedar embarazado mediante hormonas?"
→ primaryNature: question
→ implicitPremise: "Some claim men can become pregnant through hormones"
→ factualVerifiability: currently-verifiable
→ [Score the biological premise, not the question structure]

"¿Es legal este contrato?"
→ primaryNature: question
→ implicitPremise: "Uncertainty about contract legality"
→ factualVerifiability: requires-external-source
```

#### 6. Extraordinary Claim
**Definition**: Assertion of impossible, extremely unlikely, or scientifically unsupported event.

**Detection Signals**:
- Combines ordinary language with impossible entities
- Supernatural or extinct elements presented as current
- Violates established physical law
- Extraordinary specificity (location, time, witnesses) without corroboration
- Often includes testimony or eyewitness framing

**Examples**:
```
"Se vieron extraterrestres ayer en Córdoba."
→ primaryNature: extraordinary-claim
→ secondaryNatures: testimony, public-event
→ linguisticSignals: ["eyewitness-framing", "recent-timeframe", "location-specific", "alien-entity"]
→ factualVerifiability: requires-external-source
→ [Requires exceptional evidence to verify]

"Un hombre quedó embarazado."
→ primaryNature: extraordinary-claim
→ linguisticSignals: ["biological-impossibility"]
→ factualVerifiability: currently-verifiable
→ [False by biological definition]
```

#### 7. Advertisement
**Definition**: Content designed to promote product, service, or person for commercial or reputational gain.

**Detection Signals**:
- Commercial entity or product named
- Persuasive language
- Emotional appeals
- Omitted downsides or costs
- Call to action ("compra", "invierte", "descarga")
- Urgency markers
- Often combines with promise

**Examples**:
```
"Comprá este suplemento y vas a adelgazar."
→ primaryNature: advertisement
→ secondaryNatures: promise, health-claim
→ linguisticSignals: ["product-name", "call-to-action", "guarantee", "omitted-conditions"]
→ factualVerifiability: currently-verifiable
```

#### 8. Promise
**Definition**: Explicit guarantee or commitment about outcome.

**Detection Signals**:
- Certainty language ("garantizo", "seguro", "100%", "definitivamente")
- Measurable outcome
- Commitment to specific result
- Often found within advertising
- Rarely includes risk disclosure
- May be illegal (false advertising)

**Examples**:
```
"Bitcoin va a duplicarse mañana con seguridad."
→ primaryNature: prediction + promise
→ linguisticSignals: ["future-tense", "guarantee-language", "certainty"]
→ factualVerifiability: future-verifiable
→ [High manipulation score due to false certainty]

"Este producto cura el cáncer."
→ primaryNature: promise + health-claim
→ linguisticSignals: ["absolute-guarantee", "medical-claim", "omitted-evidence"]
```

#### 9. Rumor
**Definition**: Unverified claim attributed to others without direct evidence.

**Detection Signals**:
- Attribution to unnamed/vague sources ("dicen que", "me dijeron", "según")
- Lack of official confirmation
- Often sensational
- Distinguishable from verified testimony
- May be second or third-hand

**Examples**:
```
"Dicen que el gobierno oculta información."
→ primaryNature: rumor
→ linguisticSignals: ["unattributed-source", "accusation", "no-evidence"]
→ factualVerifiability: requires-external-source

"Me dijeron que va a haber un golpe de estado."
→ primaryNature: rumor + prediction
→ linguisticSignals: ["unattributed-source", "future-tense"]
```

#### 10. Testimony
**Definition**: First-hand account of witnessed or experienced event.

**Detection Signals**:
- First-person ("vi", "escuché", "experimenté")
- Describes specific sensory experience
- Often includes details (time, place, people)
- Distinguishable from official records
- Credibility depends on witness source

**Examples**:
```
"Ayer vi un OVNI sobre Córdoba."
→ primaryNature: extraordinary-claim + testimony
→ linguisticSignals: ["first-person", "past-tense", "specific-location", "alien-entity"]
→ factualVerifiability: requires-external-source
```

#### 11. Statistic
**Definition**: Quantified factual claim, often cherry-picked or misrepresented.

**Detection Signals**:
- Numerical claim ("90%", "3 millones", "el 50%")
- Citation (often absent or vague)
- Often lacks context
- May be accurate but misleading
- Requires source verification

**Examples**:
```
"El 90% de los pacientes se recuperan con este tratamiento."
→ primaryNature: statistic
→ linguisticSignals: ["quantified", "medical-claim"]
→ factualVerifiability: requires-external-source
→ [Requires: original study, sample size, conditions, timeframe]
```

#### 12. Legal Assertion
**Definition**: Claim about law, contracts, rights, or legal procedures.

**Detection Signals**:
- Legal terminology ("ilegal", "derecho", "contrato", "cláusula", "ley")
- Reference to jurisdiction
- Often presented as fact or obligation
- Requires professional verification
- Misunderstanding common (laypeople vs. lawyers)

**Examples**:
```
"No es legal exigir el pago del CFT."
→ primaryNature: legal-assertion + fact
→ linguisticSignals: ["legal-terminology", "claim-of-illegality"]
→ factualVerifiability: requires-external-source
→ [Requires: applicable law, jurisdiction, consultation with lawyer]

"Este contrato es ilegal."
→ primaryNature: legal-assertion
→ linguisticSignals: ["legal-terminology", "absolute-claim"]
```

#### 13. Financial Offer
**Definition**: Explicit proposal for monetary investment or transaction.

**Detection Signals**:
- Offer of returns ("gana", "invierte", "renta")
- Money amounts
- Investment vehicle named
- Promise of profit or income
- Time horizon
- Risk disclosure (often absent)

**Examples**:
```
"Invierte $1000 y gana $2000 en 30 días."
→ primaryNature: financial-offer
→ secondaryNatures: promise, advertisement
→ linguisticSignals: ["money-amounts", "time-horizon", "return-guarantee"]

"Comprá Bitcoin y duplica tu inversión."
→ primaryNature: financial-offer + promise
```

#### 14. Mixed
**Definition**: Claim combining multiple natures within single sentence.

**Detection Principle**: Extract each component, analyze separately.

**Examples**:
```
"Creo que Bitcoin va a subir y deberías comprar ahora."
→ primaryNature: mixed
→ components:
  - opinion
  - prediction
  - recommendation

"El gobierno va a cambiar la ley, lo cual es injusto."
→ primaryNature: mixed
→ components:
  - prediction (government action)
  - opinion (injustice claim)
```

---

## Knowledge Domain Routing

### KnowledgeDomain Type Definition

```typescript
type KnowledgeDomain =
  | 'mathematics'         // Arithmetic, algebra, geometry, logic
  | 'science'             // Physics, chemistry, astronomy, general science
  | 'biology-health'      // Medicine, disease, anatomy, health conditions
  | 'finance'             // Money, investment, banking, cryptocurrency
  | 'economics'           // Markets, inflation, employment, GDP, macro
  | 'history-sports'      // Historical events, sports events and records
  | 'technology'          // Software, hardware, internet, AI, apps
  | 'legal'               // Law, contracts, rights, procedures
  | 'public-policy'       // Government decisions, regulations, public programs
  | 'public-claims'       // News events, government actions, public records
  | 'advertising-scams'   // Promotional, pyramid schemes, false promises
  | 'politics'            // Political ideology, politicians, parties, campaigns
  | 'culture'             // Entertainment, arts, media, subjective preferences
  | 'general'             // No specific domain detected
  | 'unknown';            // Unable to determine
```

### Key Principle: Independence from Claim Nature

**Domain is determined by TOPIC, not by statement type.**

| Claim | Nature | Domain |
|-------|--------|--------|
| "Bitcoin exists." | Fact | Finance |
| "Bitcoin will rise." | Prediction | Finance |
| "I think Bitcoin will rise." | Opinion/Prediction | Finance |
| "Bitcoin will double tomorrow." | Prediction + Promise | Finance |
| "Buy Bitcoin now." | Recommendation | Finance + Advertising |

**Router must never say**:
- "This looks like a prediction, so it's not finance" (wrong)
- "This is an advertisement, so domain is advertising" (wrong - domain is advertising-scams; finance is still relevant)

### Routing Process

#### Step 1: Extract Entities
- Named entities (Bitcoin, Messi, Argentina, WHO)
- Temporal references ("mañana", "ayer", "2022")
- Geographic references (locations, countries)
- Numeric values and units
- Domain-specific terminology

#### Step 2: Match Domain Indicators (Multiple, Independent Signals)
- **NOT**: "If word 'Bitcoin' found, route to finance" (keyword-only)
- **YES**: "If financial entity + transaction language + outcome framing → finance"

#### Step 3: Evaluate Domain Confidence
- High: Multiple strong indicators converge
- Medium: Some indicators present, some ambiguous
- Low: Unclear or conflicting signals

#### Step 4: Select Primary and Secondary Domains
- Primary: Highest confidence, most relevant
- Secondary: Supporting or secondary topics

### Routing Precedence Rules

1. **Never decide domain based on single keyword.**
2. **Combine entity recognition + linguistic context.**
3. **Extraordinary claims require both extraordinary entity AND recent/location context.**
4. **Domain routing independent of claim nature.**
5. **Multiple domains possible; secondary domains should be respected.**

### Routing Examples

**Example 1: "Bitcoin va a subir."**
```
Entities: Bitcoin (financial entity)
Temporal: future (va a)
Indicators:
  - "Bitcoin" → financial entity
  - future tense + no basis → prediction pattern
  - currency/investment context
Domain: finance
Confidence: 0.95
Secondary: economics
Reason: Financial instrument + price prediction context
```

**Example 2: "La salud pública necesita más inversión."**
```
Entities: "salud pública" (public health entity)
Indicators:
  - "salud" in topic/policy context (NOT medical symptom)
  - "necesita" → necessity claim
  - "inversión" → economic/policy context
Domain: public-policy
Confidence: 0.90
Secondary: economics, health-policy
Reason: Policy evaluation + public sector + investment language
```

**Example 3: "Se vio un OVNI ayer sobre Córdoba."**
```
Entities: OVNI (extraordinary entity), Córdoba (location), ayer (past)
Indicators:
  - "vio" → testimony/eyewitness
  - "ayer" + "sobre [location]" → recent public event
  - OVNI (extraordinary entity)
Domain: public-claims
Confidence: 0.85
Secondary: science (UFO classification)
Reason: Recent extraordinary event + location + testimony framing
```

**Example 4: "Messi fue el mejor jugador del Mundial."**
```
Entities: Messi (athlete), Mundial (sports event)
Indicators:
  - Messi reference → sports domain
  - "mejor" → evaluative adjective
  - "fue" → past tense
  - superlative → subjective evaluation
Domain: history-sports
Confidence: 0.90
Nature detected: opinion (best player is subjective)
Reason: Sports entity + superlative evaluation
```

---

## Specialist Selection & Execution

### SpecialistContext Type Definition

```typescript
type SpecialistContext = {
  claimText: string;
  nature: ClaimNatureResult;
  primaryDomain: KnowledgeDomain;
  secondaryDomains: KnowledgeDomain[];
  extractedEntities: {
    named: string[];       // Named entities
    temporal: string[];    // Time references
    geographic: string[];  // Locations
    numeric: Array<{ value: number; unit?: string }>;
  };
  temporalContext?: {
    tense: 'past' | 'present' | 'future';
    specificity: 'vague' | 'relative' | 'absolute';
  };
  geographicContext?: {
    locations: string[];
    specificity: 'country' | 'region' | 'city' | 'precise';
  };
  sourceAvailable: boolean;
};
```

### Specialist Selection Matrix

**Select specialists based on nature + domain combination, not all specialists.**

| Nature + Domain | Specialist Engine | Notes |
|-----------------|------------------|-------|
| Fact + Math | MathKnowledgeEngine | Verify arithmetic, logic |
| Fact + Science | ScienceKnowledgeEngine | Verify physics, constants |
| Fact + History-Sports | HistorySportsEngine | Verify events, records |
| Prediction + Finance | FinancePredictionEngine | Evaluate basis, certainty |
| Prediction + Science | ScientificPredictionEngine | Evaluate methodology |
| Opinion + Public-Policy | PublicPolicyOpinionEngine | Evaluate framing, evidence |
| Opinion + Culture | CultureOpinionEngine | Acknowledge subjectivity |
| Extraordinary-Claim + Public-Claims | ExtraordinaryPublicClaimEngine | Require exceptional evidence |
| Promise + Health | HealthPromiseEngine | Evaluate medical claims, guarantees |
| Promise + Finance | FinancialPromiseEngine | Identify false guarantees |
| Advertisement + Health | HealthAdvertisingEngine | Evaluate health claims + disclosure |
| Recommendation + Finance | FinancialAdviceEngine | Evaluate conflicts of interest |
| Question + Biology-Health | HealthQuestionEngine | Score premise, not question |
| Legal-Assertion + Legal | LegalVerificationEngine | Verify jurisdiction, law |
| Rumor + Politics | PoliticalRumorEngine | Require corroboration |
| Testimony + Public-Claims | PublicEventTestimonyEngine | Corroborate with records |

### Specialist Contract

Each specialist receives **SpecialistContext** and returns:

```typescript
type SpecialistResult = {
  domain: KnowledgeDomain;
  applicable: boolean;
  confidence: number;     // 0.0-1.0
  verdict: string;        // 'supported', 'contradicted', 'extraordinary-unverified', etc.
  recommendedScore?: number;  // Base score before aggregation
  minimumScore?: number;      // Floor score if evidence weak
  reason: string;
  suggestedVerification: ExternalVerificationPlan;
};
```

### Execution Rules

1. **Only run specialists for primary + secondary domains.**
2. **Do not run all specialists on all claims.**
3. **Do not run irrelevant domain's specialist just because keyword matched in early phase.**
4. **Irrelevant scoring dimensions do not affect final score.**

---

## Scoring Semantics

### Core Scoring Principle

**Scoring scale 0-100 preserved, but scoring rules adapt to claim nature.**

```
0 = very little chamuyo (very trustworthy, well-supported, low manipulation)
100 = extreme chamuyo (false, contradicted, manipulative, dangerous)
```

### Scoring by Nature

#### Fact
**Goal**: Evaluate support, contradiction, evidence, consistency.

**Scoring Dimensions**:
- Evidence quality (0-40 points)
- Internal consistency (0-20 points)
- Contradiction by established knowledge (0-40 points)

**Scoring Rules**:
- Supported fact with evidence → 0-20
- Unsupported fact (requires verification) → 30-50
- Contradicted fact → 70-100
- Extraordinary fact without evidence → 85-100

**Examples**:
```
"El agua hierve a 100 °C a nivel del mar."
→ Score: 0-10 (well-established scientific fact)

"Bitcoin existe."
→ Score: 0-15 (verifiable fact, publicly known)

"Bitcoin ganó el Nobel de Física."
→ Score: 95-100 (false/contradicted)
```

#### Prediction
**Goal**: Evaluate certainty, basis, time horizon, risk, manipulation.

**Scoring Rules**:
- Prediction with explicit uncertainty → 0-30
- Prediction without basis → 40-70
- Prediction with false certainty → 70-100
- **NEVER** label prediction as currently verified or false

**Key**: Acknowledge inherent uncertainty; distinguish between honest forecasting and manipulative false certainty.

**Examples**:
```
"Bitcoin va a subir."
→ Nature: prediction
→ Score: 40-60 (uncertain, no basis)
→ Label: "Predicción especulativa"
→ DO NOT SAY: "Contenido sólido y confiable"
→ DO SAY: "Predicción no verificable en el presente"

"Bitcoin va a duplicarse mañana con seguridad."
→ Nature: prediction + promise
→ Score: 80-95 (false certainty = manipulation)
→ Label: "Predicción con garantía falsa"
→ Reason: Certainty language contradicts inherent uncertainty
```

#### Opinion
**Goal**: Evaluate framing, manipulation, harm potential, certainty, context.

**Scoring Rules**:
- Subjective opinion without harm → 0-25
- Opinion with manipulative framing → 30-70
- Opinion presenting itself as fact → 40-80
- Absolute accusatory framing → 50-80

**Key**: Do NOT score opinion as "false" merely for being subjective. Evaluate harm and manipulation, not truth-value.

**Examples**:
```
"Creo que Bitcoin va a subir."
→ Nature: opinion/prediction
→ Score: 35-55 (subjective prediction, lower than absolute claim)
→ DO NOT SAY: "False or unverifiable"
→ DO SAY: "Subjective prediction based on personal belief"

"El gobierno definitivamente está robando a todos."
→ Nature: opinion/accusation
→ Score: 60-80 (absolute framing of subjective accusation)
→ Reason: Accusatory framing without evidence
→ DO NOT SAY: "Verified conspiracy"
→ DO SAY: "Accusation without public evidence"
```

#### Recommendation
**Goal**: Evaluate evidence, suitability, risk disclosure, conflicts of interest.

**Scoring Rules**:
- Evidence-based recommendation → 0-20
- Recommendation without evidence → 40-60
- Recommendation with hidden conflicts → 60-80
- Dangerous recommendation → 80-100

**Examples**:
```
"Deberías verificar esta información."
→ Nature: recommendation
→ Score: 0-10 (prudent advice)

"Invierte en este esquema de referidos."
→ Nature: recommendation + financial-offer
→ Score: 85-95 (pyramid scheme = dangerous)
```

#### Advertisement
**Goal**: Evaluate promises, urgency, guarantees, omitted conditions.

**Scoring Rules**:
- Clear disclosure + reasonable claims → 10-30
- Omitted conditions + limited disclosure → 40-70
- False guarantees + urgency language → 80-100

**Examples**:
```
"Comprá este suplemento" (no claims)
→ Score: 0-15 (advertising only, no false claims)

"Comprá este suplemento y vas a adelgazar."
→ Score: 70-90 (guarantee without conditions, medical claim without evidence)
→ Reason: omitted factors, no individual variation, no clinical evidence
```

#### Promise
**Goal**: Evaluate feasibility, measurability, guarantee language, manipulation.

**Scoring Rules**:
- Realistic, measurable promise with disclosure → 20-40
- Exaggerated promise → 60-80
- Impossible promise (false guarantee) → 85-100

**Examples**:
```
"Bitcoin va a duplicarse mañana con seguridad."
→ Nature: prediction + promise
→ Score: 85-95 (extreme certainty about unknowable future)

"Duplica tus resultados en 30 días o dinero de vuelta."
→ Score: 60-85 (money-back guarantee can reduce score, but "doubles" is vague/exaggerated)
```

#### Extraordinary Claim
**Goal**: Require exceptional evidence; absent evidence → high score.

**Scoring Rules**:
- Extraordinary claim without evidence → 85-100
- Extraordinary claim with weak testimony only → 80-95
- Extraordinary claim with corroborated evidence → 60-85
- Never assume ordinary evidence suffices

**Examples**:
```
"Se vieron extraterrestres ayer en Córdoba."
→ Score: 90-98 (no evidence, no corroboration, no official record)

"Un hombre quedó embarazado mediante hormonas."
→ Score: 95-100 (biologically impossible without surgery)
```

#### Rumor
**Goal**: Require corroboration; distinguish from verified claim.

**Scoring Rules**:
- Unattributed rumor → 60-80
- Attributed rumor with no corroboration → 70-85
- Rumor later corroborated → score as fact (0-70)

**Examples**:
```
"Dicen que el gobierno oculta información."
→ Score: 75-90 (unattributed accusation)
→ Label: "Rumor sin verificación"
```

#### Testimony
**Goal**: Distinguish first-hand from verified; require corroboration for public events.

**Scoring Rules**:
- Testimony to private experience → 0-40 (subjective, can't verify)
- Testimony to public event → require corroboration (0-95 depending on verification)
- Extraordinary testimony → 85-100 without corroboration

**Examples**:
```
"Vi a Messi jugar en el partido de ayer."
→ Score: 10-20 (verifiable, can confirm attendance)

"Ayer vi un OVNI sobre Córdoba."
→ Score: 90-98 (extraordinary, requires corroboration)
```

#### Legal Assertion
**Goal**: Require professional verification; distinguish from opinion about law.

**Scoring Rules**:
- Correct legal statement verified by lawyer → 0-20
- Legal opinion without professional basis → 50-80
- False legal claim (e.g., "something is illegal" when it isn't) → 80-100

**Examples**:
```
"La ley fue publicada en el Boletín Oficial en 2020."
→ Score: 0-10 (verifiable public record)

"No es legal exigir el pago del CFT."
→ Score: 75-90 (layered misunderstanding of law; requires professional clarification)
```

---

## External Verification Policy

### Verification Necessity by Nature + Domain

**Define what CAN be verified locally vs. what MUST be verified externally.**

#### Always Require External Verification

- Recent news events (< 1 year)
- Current prices, rates, exchange values
- Current officeholders, government positions
- Ongoing elections or votes
- Recent versions of software/technology
- Market predictions or financial markets
- Public health alerts (< 1 month)
- Recent political decisions
- Breaking news
- Public official statements
- Current law (enactments < 2 years)
- Recent celebrity news

#### Can Use Local Reasoning

- Basic arithmetic (2 + 2 = 4)
- Fundamental physics (gravity exists)
- Stable historical facts (> 20 years old, well-documented)
- Internal contradictions (A and not-A in same text)
- Impossible biological premises (men cannot naturally become pregnant)
- Unfalsifiable statements (circular logic)
- Subjective evaluation (cannot be contradicted by fact)

#### Depends on Specificity + Recency

- Sports statistics: if specific, require verification; if general, local reasoning
- Historical dates: if vague, local reasoning; if specific, may require verification
- Election results: always require external verification
- Scientific claims: if foundational knowledge, local; if novel, external
- Medical claims: if diagnosis/treatment, always external

### ExternalVerificationPlan Type Definition

```typescript
type ExternalVerificationPlan = {
  required: boolean;
  reason: string;  // Why external verification is needed
  suggestedSourceTypes: string[];  // e.g., ['news', 'government-records', 'scientific-journals']
  minimumIndependentSources: number;  // e.g., 2, 3, 5
  recencyRequired: boolean;  // True if source must be recent
  jurisdictionalRelevance?: string;  // e.g., 'Argentina', 'UNESCO'
  officialSourceRequired?: boolean;  // True if only official sources count
};
```

### Verification Examples

**Example 1: Recent Public Event**
```
Claim: "Se vieron extraterrestres ayer en Córdoba."
ExternalVerificationPlan: {
  required: true,
  reason: "Extraordinary claim about recent public event requires corroboration",
  suggestedSourceTypes: ["news", "government-records", "eyewitness-media", "official-reports"],
  minimumIndependentSources: 2,
  recencyRequired: true,
  officialSourceRequired: false  // News + independent sources sufficient
}
```

**Example 2: Current Law**
```
Claim: "No es legal exigir el pago del CFT."
ExternalVerificationPlan: {
  required: true,
  reason: "Legal assertion requires current law verification",
  suggestedSourceTypes: ["legal-database", "government-law-repository", "lawyer"],
  minimumIndependentSources: 1,
  recencyRequired: true,
  officialSourceRequired: true,
  jurisdictionalRelevance: "Argentina"
}
```

**Example 3: Basic Arithmetic**
```
Claim: "2 + 2 = 5."
ExternalVerificationPlan: {
  required: false,
  reason: "Arithmetic can be verified by local calculation"
}
```

**Example 4: Prediction**
```
Claim: "Bitcoin va a subir mañana."
ExternalVerificationPlan: {
  required: false,  // Cannot verify until future occurs
  reason: "Future prediction cannot be verified until outcome occurs",
  suggestedSourceTypes: ["market-data"],
  recencyRequired: false  // Verification only after event
}
```

### Critical Rules

**DO NOT**:
- Claim external verification occurred when it did not
- Fake sources or citations
- Imply corroboration without genuine sources
- Hide unverified parts behind verified parts

**DO**:
- Explicitly state when external verification is needed
- List sources if actually consulted
- Separate verified from unverified components
- State confidence about external verification status

---

## Report Intelligence Engine

### Purpose

Generate domain- and nature-specific content rather than generic templates.

**Current Problem**: Report always says "Contenido sólido y confiable" or similar generic phrases regardless of nature.

**New Approach**: Content changes based on ClaimNature + KnowledgeDomain.

### ReportContext Type Definition

```typescript
type ReportContext = {
  claimNature: ClaimNatureResult;
  domain: KnowledgeDomain;
  verdict: string;  // 'supported', 'contradicted', 'extraordinary-unverified', 'unknown'
  score: number;    // 0-100
  routingConfidence: number;  // 0.0-1.0
  externalVerificationPlan: ExternalVerificationPlan;
  detectedEvidence: string[];
  missingEvidence: string[];
  linguisticSignals: string[];
  specialistReasoning: string;
  decisiveClaim: string;  // Most important piece
};
```

### Report Structure

Each nature + domain combination generates specific sections:

#### Executive Summary
- **For Fact**: State what is claimed, evidence status, verification result
- **For Prediction**: State what is predicted, basis, time horizon, inherent uncertainty
- **For Opinion**: Acknowledge subjectivity, state framing, evaluate rationality
- **For Recommendation**: Evaluate basis, identify assumptions, assess risk
- **For Advertisement**: Identify product, evaluate claims vs. disclosure
- **For Question**: State premise, evaluate premise truthfulness
- **For Extraordinary Claim**: State what is claimed, explain why exceptional evidence required, evidence status
- **For Rumor**: State what is alleged, indicate lack of corroboration, recommend verification

#### Strengths (Evidence Supporting Claim)
- What the claim got right
- What verifiable elements exist
- Positive framing or honest elements

#### Weaknesses (Gaps or Issues)
- Missing evidence
- Contradictory evidence
- Unsupported assumptions
- Omitted conditions
- Logical fallacies

#### Risks
- If accepted without verification
- Specific to nature and domain
- For predictions: opportunity cost
- For promises: financial/health risk
- For opinions: manipulation risk
- For rumors: spread/credibility risk

#### Evidence Needed
- Specific types (not generic)
- Number of independent sources required
- Time sensitivity
- Official vs. public sources
- Expertise level required (lawyer, doctor, etc.)

#### Confidence Breakdown
- Routing confidence: Was the domain correctly identified?
- Specialist confidence: How sure is the specialist engine?
- Evidence confidence: How reliable are sources?
- Overall: Synthesis

#### Recommendation
- Action for user (verify with X, consult Y, investigate Z)
- Context-specific
- Not generic "always be skeptical"

### Nature-Specific Report Examples

#### Example 1: Extraordinary Claim + Public Claims
```
Input: "Se vieron extraterrestres ayer en Córdoba."

Executive Summary:
"This claim describes an extraordinary public event—alien sighting with specific location and 
recent timeframe. Extraordinary claims require exceptional evidence to be credible. No official 
records, corroborating reports, or independent verification found."

Strengths:
- Includes specific location (Córdoba)
- Includes specific timeframe (ayer/yesterday)
- Describes concrete event (sighted, location described)

Weaknesses:
- No official record from authorities
- No media coverage
- No independent witness corroboration
- Extraordinary entity (aliens) without prior contact or evidence
- No images, video, or physical evidence

Evidence Needed:
1. Independent eyewitness accounts (minimum 2-3)
2. Official government/military records (if captured on sensor)
3. Media coverage or scientific investigation
4. Physical evidence (debris, landing site)

Risk:
HIGH - Accepting unverified extraordinary claims can lead to misinformation spread, 
false beliefs about first contact, potential panic.

Confidence:
- Routing: HIGH (clearly an extraordinary public event)
- Evidence: VERY LOW (no corroboration found)
- Overall: Requires external verification before acceptance

Recommendation:
Check local news archives for Córdoba, Argentina (date: yesterday).
If multiple independent sources report same event → significant story.
If no reports found → likely unverified claim or misidentification.
```

#### Example 2: Prediction + Finance
```
Input: "Bitcoin va a subir."

Executive Summary:
"This is a financial prediction without stated basis. Predictions are inherently uncertain 
and cannot be evaluated as true or false in the present. The claim lacks specificity about 
timeframe, magnitude, or justification."

Strengths:
- Specific asset (Bitcoin)
- Directional claim (up, not ambiguous)

Weaknesses:
- No stated basis or reasoning
- No timeframe specified (days? months? years?)
- No magnitude specified (1% up or 100% up?)
- Uses simplistic "will" without uncertainty language
- No acknowledgment of market volatility

Evidence Needed:
- Analyst reasoning or model
- Historical precedent or pattern
- Macroeconomic context
- Market fundamentals

Risk:
MEDIUM - If someone invests based on this unsupported prediction, opportunity cost 
or financial loss likely.

DO NOT SAY:
- "Contenido sólido y confiable"
- "True or false"

DO SAY:
- "Predicción especulativa sin base"
- "Inherently uncertain until outcome occurs"

Confidence:
- Routing: HIGH (clearly finance/prediction)
- Specialist: LOW (insufficient basis)
- Evidence: NOT APPLICABLE (future event)
- Overall: Prediction awaiting outcome; uncertainty is appropriate

Recommendation:
Do not treat as financial advice. Bitcoin market fundamentals, adoption trends, 
regulatory environment, and macroeconomic factors determine actual price movement.
```

#### Example 3: Opinion + Public Policy
```
Input: "La salud pública necesita más inversión."

Executive Summary:
"This is a subjective opinion about public spending priorities. The claim is not 
factually false or true; it expresses a value judgment. Evaluation focuses on 
reasonableness of framing, not truth-value."

Strengths:
- Identifies a policy area (public health)
- Uses clear language (needs investment)
- Acknowledges public benefit

Weaknesses:
- No data on current spending levels
- No comparison to other countries
- No specific areas identified for investment
- No fiscal context (budget constraints, alternatives)
- Assumes "more" is always better

Evidence Useful (for context, not "truth"):
- Current public health spending (% GDP)
- Health outcomes comparisons
- Public health challenge data
- Fiscal constraints

Risk:
LOW - This is a reasonable policy position, not a false claim.

DO NOT SAY:
- "False opinion"
- "Contradicted by fact"

DO SAY:
- "Subjective policy position"
- "Reasonable given certain assumptions"
- "Depends on fiscal priorities and alternatives"

Confidence:
- Routing: HIGH (clearly policy + health)
- Opinion framing: REASONABLE (well-formed position)
- Evidence base: INCOMPLETE (no supporting data provided)
- Overall: Legitimate policy view; fuller analysis requires context

Recommendation:
Research current public health spending, health outcome data, and alternative 
budget priorities in Argentina to evaluate this position fully.
```

#### Example 4: Advertisement + Promise + Health
```
Input: "Comprá este suplemento y vas a adelgazar."

Executive Summary:
"This is a health-related advertisement combining a product recommendation with 
an explicit guarantee about weight loss. The guarantee lacks conditions, individual 
variation, and medical evidence."

Strengths:
- Specific product mentioned
- Specific outcome mentioned (weight loss)
- Clear call to action

Weaknesses:
- Absolute guarantee ("vas a") without conditions
- No mention of diet, exercise, or medical supervision
- No time frame for results
- No clinical studies or evidence cited
- Omits that weight loss requires caloric deficit
- Omits that results vary by individual
- Likely lacks regulatory disclaimer

Evidence Needed:
- Clinical trial data (FDA, EMA, ANMAT standards)
- Peer-reviewed publication
- Regulatory approval and evidence summary
- Manufacturer claims vs. actual evidence

Risk:
HIGH - False health claim can delay legitimate treatment, cause financial loss, 
encourage unsafe practices.

DO SAY:
- "Publicidad con garantía de salud no verificada"
- "Falta evidencia médica"
- "Cláusulas omitidas (dieta, ejercicio, variación individual)"

Confidence:
- Routing: HIGH (clearly advertisement + health)
- Specialist: MEDIUM (health claim detected, evidence not found)
- Evidence: VERY LOW (no medical support)
- Overall: Requires regulatory verification before purchase

Recommendation:
Consult healthcare provider or registered nutritionist before purchasing. 
Request clinical evidence from manufacturer. Check regulatory approvals (ANMAT in Argentina).
```

---

## UI Label Mapping

### Principle

**Never show generic "Contenido general" when a more precise nature/domain pair is available.**

Generate user-facing labels that accurately reflect what was detected.

### Label Matrix

| Claim Nature | Domain | Primary Label (Spanish) | Secondary Context |
|--------------|--------|------------------------|-------------------|
| Fact | Mathematics | "Afirmación matemática" | Verify calculation |
| Fact | Science | "Afirmación científica verificable" | Consult scientific sources |
| Fact | History-Sports | "Hecho histórico / deportivo" | Verify historical record |
| Fact | Biology-Health | "Hecho médico / biológico" | Requires medical source |
| Fact | Finance | "Hecho financiero" | Verify current data |
| Fact | Legal | "Afirmación jurídica" | Requires legal source |
| Prediction | Finance | "Predicción financiera" | Acknowledge uncertainty |
| Prediction | Science | "Predicción científica" | Depends on methodology |
| Prediction | Politics | "Predicción política" | Inherently uncertain |
| Prediction | General | "Predicción especulativa" | No basis provided |
| Opinion | Public-Policy | "Opinión sobre política pública" | Subjective evaluation |
| Opinion | Politics | "Opinión política" | Acknowledge perspective |
| Opinion | Culture | "Opinión sobre entretenimiento" | Subjective preference |
| Opinion | Finance | "Opinión sobre inversión" | Not financial advice |
| Opinion | General | "Opinión subjetiva" | Respect subjectivity |
| Recommendation | Finance | "Recomendación de inversión" | Evaluate conflicts of interest |
| Recommendation | Health | "Recomendación de salud" | Consult healthcare provider |
| Recommendation | General | "Consejo o recomendación" | Evaluate evidence basis |
| Question | Biology-Health | "Pregunta de biología o salud" | Score the premise |
| Question | Legal | "Pregunta jurídica" | Score the premise |
| Question | General | "Pregunta informativa" | Score the premise |
| Extraordinary-Claim | Public-Claims | "Afirmación extraordinaria / evento público" | Requires exceptional evidence |
| Extraordinary-Claim | Science | "Afirmación científica extraordinaria" | Violates established science |
| Extraordinary-Claim | General | "Afirmación extraordinaria" | Requires exceptional evidence |
| Advertisement | Health | "Publicidad con afirmación de salud" | Verify medical claims |
| Advertisement | Finance | "Publicidad de inversión" | Evaluate promises |
| Advertisement | General | "Anuncio o publicidad" | Identify omitted conditions |
| Promise | Health | "Garantía de salud" | Verify feasibility |
| Promise | Finance | "Garantía financiera" | Evaluate claim |
| Promise | General | "Promesa o garantía" | Identify false certainty |
| Rumor | Politics | "Rumor político" | Requires corroboration |
| Rumor | General | "Rumor o información no verificada" | Requires sources |
| Testimony | Public-Claims | "Testimonio de evento público" | Corroborate with records |
| Testimony | General | "Relato o testimonio" | Consider source credibility |
| Statistic | Finance | "Estadística financiera" | Verify source and context |
| Statistic | Health | "Estadística médica" | Verify study details |
| Statistic | General | "Dato o estadística" | Request source |
| Legal-Assertion | Legal | "Afirmación jurídica" | Consult lawyer |
| Legal-Assertion | General | "Afirmación legal" | Requires legal source |
| Financial-Offer | Finance | "Oferta de inversión" | Evaluate terms carefully |
| Financial-Offer | General | "Propuesta de dinero" | Identify risks |
| Mixed | (Multiple) | "(Nature 1) + (Nature 2)" | Analyze each component |

---

## Confidence Model

### Problem with Current Approach

**Single "Confianza: Media/Alta" is ambiguous.**

Could mean:
- We're confident the domain is correct, but evidence is weak
- We're confident the evidence, but routing is ambiguous
- We're confident about part of it, but not all

### Proposed Separation

```typescript
type AnalysisConfidence = {
  routingConfidence: number;      // 0.0-1.0
  specialistConfidence: number;   // 0.0-1.0
  evidenceConfidence: number;     // 0.0-1.0
  overallConfidence: number;      // 0.0-1.0
  explanation: string;
};
```

#### Routing Confidence
- Did we correctly identify the domain?
- Were signals clear or ambiguous?
- High: Multiple converging indicators
- Low: Ambiguous or conflicting signals

**Example**:
```
"Se vio un OVNI ayer sobre Córdoba."
→ Routing confidence: 0.95 (extraordinary claim + public-claims very clear)

"Bitcoin necesita regulación."
→ Routing confidence: 0.85 (could be finance or public-policy; somewhat ambiguous)
```

#### Specialist Confidence
- Did the specialist have clear evidence/reasoning?
- Was the verdict definitive or uncertain?
- High: Specialist found strong evidence
- Low: Specialist found conflicting evidence or uncertainty

**Example**:
```
"2 + 2 = 5."
→ Specialist confidence: 0.99 (arithmetic definitively contradicted)

"Bitcoin va a subir."
→ Specialist confidence: 0.3 (no basis, pure speculation)
```

#### Evidence Confidence
- How reliable are the sources/evidence?
- Is evidence direct or indirect?
- High: Authoritative sources, direct evidence
- Low: Rumors, inference, single source

**Example**:
```
"The Earth orbits the sun."
→ Evidence confidence: 0.99 (centuries of observation, scientific consensus)

"Dicen que el gobierno oculta información."
→ Evidence confidence: 0.1 (rumor, unattributed)
```

#### Overall Confidence
- Synthesis of above three
- What can user rely on?
- High: Can trust this analysis
- Low: User should verify independently

**Example**:
```
"Se vio un OVNI ayer sobre Córdoba."
→ Routing confidence: 0.95 (right domain)
→ Specialist confidence: 0.4 (extraordinary without evidence)
→ Evidence confidence: 0.05 (no corroboration)
→ Overall: 0.15 (requires verification)
→ Explanation: "Alta certeza sobre el dominio, pero evidencia muy baja. 
              Afirmación extraordinaria sin corroboración requiere verificación externa."
```

### UI Presentation

**Instead of**: "Confianza: Media"

**Show**: 
```
┌─────────────────────────────────────┐
│ Análisis de Confianza               │
├─────────────────────────────────────┤
│ Clasificación: Alta (0.95)          │
│ Evidencia: Muy baja (0.05)          │
│ Especialista: Baja (0.4)            │
│ Confianza General: Muy baja (0.15)  │
├─────────────────────────────────────┤
│ Explicación:                        │
│ La afirmación fue clasificada       │
│ correctamente como evento público   │
│ extraordinario. Sin embargo, no hay │
│ corroboración de fuentes oficiales. │
│ Se requiere verificación externa.   │
└─────────────────────────────────────┘
```

---

## Migration Plan

### Phased Approach: 6 Phases

Each phase independently testable, avoids breaking production.

#### Phase 1: Add ClaimNature Detection (Non-Breaking)
**Duration**: 2 weeks
**Output**: ClaimNature analysis without changing scores

Changes:
- Implement ClaimNatureDetector engine
- Integrate into claimFirstPipeline (add to AnalyzedClaim.nature field)
- Output nature detection to logs, not UI
- Do NOT change scoring or domain routing
- Add regression tests for nature detection (verify detection without score impact)

Rollback: Remove nature field from AnalyzedClaim; revert claimFirstPipeline

Testing:
- Nature detection accuracy on 40+ test cases
- No change to existing test scores
- Regression suite must pass identically to V20

#### Phase 2: Connect ClaimNature to KnowledgeRouter (Non-Breaking)
**Duration**: 2 weeks
**Output**: Domain routing aware of nature, but no scoring changes

Changes:
- Pass ClaimNatureResult to knowledgeRouter
- Add nature-aware routing rules (e.g., prediction = different indicators)
- Log routing decisions showing nature influence
- Do NOT change specialist selection or scoring
- Do NOT change UI labels

Rollback: Remove nature parameter from router; restore keyword-only routing

Testing:
- Verify routing confidence increases when nature + domain align
- Verify routing confidence decreases when nature suggests secondary domain
- Regression suite must pass identically to V20

#### Phase 3: Update Scoring for Prediction + Opinion (Score Changes)
**Duration**: 3 weeks
**Output**: Predictions and opinions scored differently

Changes:
- Create PredictionSpecialist (separate from generic domain specialists)
- Modify scoring rules: predictions never labeled as "verified fact"
- Modify scoring rules: opinions scored on manipulation/framing, not truth-value
- Update specialist context to receive ClaimNatureResult
- Update regression tests for prediction/opinion cases

Rollback: Restore V20 scoring logic; disable nature-aware specialists

Testing:
- Comprehensive test suite for prediction scoring (40+ cases)
- Verify predictions never show false certainty
- Verify opinions never show contradiction with facts alone
- Update regression suite; expect score changes only for prediction/opinion

#### Phase 4: Implement Report Intelligence Engine (Output Only)
**Duration**: 3 weeks
**Output**: Nature- and domain-specific report content

Changes:
- Create ReportIntelligenceEngine
- Implement report templates for each nature + domain pair
- Remove hardcoded generic phrases
- Connect to ReportContext
- Leave scoring and routing unchanged

Rollback: Restore generic report templates

Testing:
- Verify report content matches nature + domain
- Verify no generic "Contenido general" labels
- Manual review of 20+ generated reports

#### Phase 5: Update UI Labels and Confidence Fields (UI Only)
**Duration**: 2 weeks
**Output**: New labels and separated confidence display

Changes:
- Update page.tsx to use new label mapping
- Implement separated confidence fields (routing, specialist, evidence, overall)
- Preserve score and score explanation
- Add confidence breakdown explanation
- No backend changes needed

Rollback: Restore generic labels and single confidence field

Testing:
- Verify labels correct for routing/domain pairs
- Verify confidence fields display correctly
- Mobile and desktop layouts preserved
- No API changes

#### Phase 6: Expand External Verification Integration (Optional, Future)
**Duration**: TBD
**Output**: Actual external verification where available

Changes:
- Integrate with news APIs for public claims
- Integrate with government APIs for legal/policy
- Integrate with data providers for finance
- Do NOT fake verification; only report actual results

Rollback: Disable external verification; use local reasoning

---

## Test Strategy

### Test Categories

#### Category 1: Nature Detection (40+ cases)
Verify ClaimNatureDetector identifies nature correctly.

**Finance Domain Tests**:
```typescript
test('Bitcoin exists - fact', {
  input: 'Bitcoin existe.',
  expectedNature: 'fact',
  expectedDomain: 'finance',
  expectedVerifiability: 'currently-verifiable'
});

test('Bitcoin will rise - prediction', {
  input: 'Bitcoin va a subir.',
  expectedNature: 'prediction',
  expectedDomain: 'finance',
  expectedVerifiability: 'future-verifiable'
});

test('I think Bitcoin will rise - opinion/prediction', {
  input: 'Creo que Bitcoin va a subir.',
  expectedNature: 'opinion',
  expectedSecondaryNature: 'prediction',
  expectedDomain: 'finance',
  expectedVerifiability: 'subjective'
});

test('Bitcoin will double tomorrow with certainty - prediction/promise', {
  input: 'Bitcoin va a duplicarse mañana con seguridad.',
  expectedNature: 'prediction',
  expectedSecondaryNature: 'promise',
  expectedDomain: 'finance',
  expectedVerifiability: 'future-verifiable'
});

test('Buy Bitcoin now before it is too late - recommendation/advertisement', {
  input: 'Comprá Bitcoin ahora antes de que sea tarde.',
  expectedNature: 'recommendation',
  expectedSecondaryNature: 'advertisement',
  expectedDomain: 'finance',
  expectedVerifiability: 'not-applicable'
});
```

**Health Domain Tests**:
```typescript
test('Fever is a symptom - fact', {
  input: 'La fiebre es un síntoma.',
  expectedNature: 'fact',
  expectedDomain: 'biology-health'
});

test('Public health needs more funding - opinion', {
  input: 'La salud pública necesita más inversión.',
  expectedNature: 'opinion',
  expectedSecondaryNature: 'recommendation',
  expectedDomain: 'public-policy',  // NOT biology-health
  languageSignals: ['policy-evaluation', 'normative']
});

test('Ministry increased health budget - fact', {
  input: 'El Ministerio de Salud aumentó el presupuesto.',
  expectedNature: 'fact',
  expectedDomain: 'public-claims'
});

test('This supplement cures cancer - promise/advertisement', {
  input: 'Este suplemento cura el cáncer.',
  expectedNature: 'promise',
  expectedSecondaryNature: 'advertisement',
  expectedDomain: 'biology-health',
  expectedVerifiability: 'requires-external-source'
});

test('Buy this supplement and lose weight - advertisement/promise', {
  input: 'Comprá este suplemento y vas a adelgazar.',
  expectedNature: 'advertisement',
  expectedSecondaryNature: 'promise',
  expectedDomain: 'biology-health'
});
```

**Sports Domain Tests**:
```typescript
test('Messi won World Cup 2022 - fact', {
  input: 'Messi ganó el Mundial 2022.',
  expectedNature: 'fact',
  expectedDomain: 'history-sports'
});

test('Messi was the best player - opinion', {
  input: 'Messi fue el mejor jugador del Mundial.',
  expectedNature: 'opinion',
  expectedDomain: 'history-sports',
  linguisticSignals: ['superlative-adjective']
});

test('Messi will win next World Cup - prediction', {
  input: 'Messi ganará el próximo Mundial.',
  expectedNature: 'prediction',
  expectedDomain: 'history-sports'
});
```

**Politics Domain Tests**:
```typescript
test('Government published decree - fact', {
  input: 'El gobierno publicó el decreto.',
  expectedNature: 'fact',
  expectedDomain: 'public-claims'
});

test('I think government is wrong - opinion', {
  input: 'Creo que el gobierno está equivocado.',
  expectedNature: 'opinion',
  expectedDomain: 'politics'
});

test('Government will lose elections - prediction', {
  input: 'El gobierno va a perder las elecciones.',
  expectedNature: 'prediction',
  expectedDomain: 'politics'
});

test('They say government hides information - rumor', {
  input: 'Dicen que el gobierno oculta información.',
  expectedNature: 'rumor',
  expectedDomain: 'politics'
});
```

**Science Domain Tests**:
```typescript
test('Water boils at 100C at sea level - fact', {
  input: 'El agua hierve a 100 °C a nivel del mar.',
  expectedNature: 'fact',
  expectedDomain: 'science',
  expectedVerifiability: 'currently-verifiable'
});

test('Aliens will be discovered tomorrow - prediction', {
  input: 'Mañana descubrirán vida extraterrestre.',
  expectedNature: 'prediction',
  expectedDomain: 'science'
});

test('Aliens were seen yesterday in Córdoba - extraordinary claim + testimony', {
  input: 'Se vieron extraterrestres ayer en Córdoba.',
  expectedNature: 'extraordinary-claim',
  expectedSecondaryNature: 'testimony',
  expectedDomain: 'public-claims',
  expectedSecondaryDomain: 'science',
  expectedVerifiability: 'requires-external-source'
});
```

**Legal Domain Tests**:
```typescript
test('Law was published in Official Gazette - fact', {
  input: 'La ley fue publicada en el Boletín Oficial.',
  expectedNature: 'fact',
  expectedDomain: 'public-claims'  // OR legal (depends on context)
});

test('This contract is illegal - legal assertion', {
  input: 'Este contrato es ilegal.',
  expectedNature: 'legal-assertion',
  expectedDomain: 'legal',
  expectedVerifiability: 'requires-external-source'
});

test('I think this law is unjust - opinion', {
  input: 'Creo que esta ley es injusta.',
  expectedNature: 'opinion',
  expectedDomain: 'politics'  // OR legal (depends on context)
});

test('Law will change next month - prediction', {
  input: 'La ley cambiará el mes próximo.',
  expectedNature: 'prediction',
  expectedDomain: 'legal'
});
```

**Question Domain Tests**:
```typescript
test('Can men become pregnant through hormones - question', {
  input: '¿Puede un hombre quedar embarazado mediante hormonas?',
  expectedNature: 'question',
  expectedDomain: 'biology-health',
  implicitPremise: 'Possibility of male pregnancy with hormones',
  scorePremise: true  // Score the premise, not the question
});

test('Is this contract legal - question', {
  input: '¿Es legal este contrato?',
  expectedNature: 'question',
  expectedDomain: 'legal'
});
```

#### Category 2: Domain Routing (20+ cases)
Verify domain routing works independently of nature.

#### Category 3: Scoring by Nature (30+ cases)
Verify scoring rules adapt to nature correctly.

**Prediction Scoring**:
```typescript
test('Prediction without basis scores 40-60, not labeled as true/false', {
  input: 'Bitcoin va a subir.',
  expectedScoreRange: [40, 60],
  shouldNotLabel: 'verified|true|false',
  shouldLabel: 'prediction|speculative'
});

test('Prediction with false certainty scores 70-95', {
  input: 'Bitcoin va a duplicarse mañana con seguridad.',
  expectedScoreRange: [70, 95],
  reason: 'False certainty about unknowable future'
});
```

**Opinion Scoring**:
```typescript
test('Subjective opinion scores 0-25 without harm', {
  input: 'Creo que Bitcoin va a subir.',
  expectedScoreRange: [0, 30],
  shouldNotLabel: 'false|contradicted'
});

test('Accusatory opinion without evidence scores 60-80', {
  input: 'El gobierno definitivamente está robando a todos.',
  expectedScoreRange: [60, 80],
  reason: 'Absolute accusatory framing without evidence'
});
```

#### Category 4: Report Content (Manual Review)
Verify report content matches nature + domain.

#### Category 5: UI Labels (Visual)
Verify labels display correctly for nature + domain pairs.

#### Category 6: External Verification Status
Verify external verification plan correct and explicit.

---

## Risks

### Risk 1: Regex Explosion
**Description**: ClaimNature detection adds many new patterns; hard to maintain.
**Mitigation**:
- Use semantic features + pattern combination (not regex alone)
- Centralize pattern definitions
- Add pattern test suite
- Document intended coverage for each pattern

### Risk 2: Keyword-Only Routing Persists
**Description**: Domain routing still relies on isolated keywords.
**Mitigation**:
- Enforce multi-signal routing in code review
- Unit tests verify no single-keyword routing
- Regression tests catch keyword-only false positives

### Risk 3: Exact Sentence Hardcoding
**Description**: Test cases become exact-match hardcodes instead of semantic understanding.
**Mitigation**:
- Vary sentence structure in tests
- Include paraphrases of same claim
- Mark tests as semantic vs. regex-specific

### Risk 4: Circular Scoring Logic
**Description**: Score affects nature detection or vice versa; feedback loop.
**Mitigation**:
- Enforce unidirectional flow: text → nature → domain → specialist → score
- Unit tests verify each stage independently
- No specialist feeds back into nature detection

### Risk 5: Tests Copy Production Rules
**Description**: Test expectations match code exactly, no independent verification.
**Mitigation**:
- Write tests before implementation
- Have domain expert (non-engineer) review test expectations
- Compare results to human judgment
- Maintain separate spec document

### Risk 6: Unsupported Legal Conclusions
**Description**: Legal assertions claimed without actual lawyer review.
**Mitigation**:
- DO NOT claim legal verification without professional review
- Explicitly state "requires lawyer" in output
- Never say "is legal" or "is illegal" without source
- Include disclaimer for all legal assertions

### Risk 7: Fake External Verification
**Description**: System claims external verification without actually consulting sources.
**Mitigation**:
- Explicitly state whether actual verification occurred
- Never imply corroboration without citing source
- Include verification plan, not verification result (until actually done)
- Clear separation: what we verified vs. what we know is unverified

### Risk 8: Overconfidence
**Description**: System assigns high confidence when actual confidence should be low.
**Mitigation**:
- Separate confidence dimensions
- Confidence cannot exceed evidence available
- Prediction confidence never high (future is uncertain)
- Extraordinary claim confidence never high (exceptional evidence needed)

### Risk 9: Generic Reports
**Description**: New report intelligence engine still produces generic phrases.
**Mitigation**:
- Template per nature + domain pair
- Code review checks for generic language
- Test report content manually
- Include specific evidence gaps, not "needs evidence"

### Risk 10: Dilution of Severe Claims
**Description**: Lowering prediction scores makes dangerous promises less visible.
**Mitigation**:
- Predictions with money/health stakes still score high
- Promise + prediction combination still high
- False certainty language itself raises score
- Context matters: "market goes up" (low) vs. "guaranteed returns" (high)

### Risk 11: Contradictory Outputs
**Description**: Report says "Contenido sólido y confiable" AND "no lo trataría como verdadero".
**Mitigation**:
- Automated check: cannot have contradictory statements
- Report generation validates logical consistency
- Nature-specific report templates avoid contradictions
- Code review enforces consistency rules

---

## Final Recommendation

### Proposed File Structure

```
src/analysis/
├── engines/
│   ├── claimNatureDetector.ts          # NEW: ClaimNature detection
│   ├── knowledgeRouter.ts              # MODIFIED: add nature awareness
│   ├── specialists/
│   │   ├── predictionSpecialist.ts     # NEW: handles all predictions
│   │   ├── opinionSpecialist.ts        # NEW: handles all opinions
│   │   ├── ...existing specialists...
│   ├── reportIntelligenceEngine.ts     # NEW: nature-specific reports
│   ├── externalVerificationPolicy.ts   # NEW: verification plan logic
│   └── __tests__/
│       ├── claimNatureDetector.test.ts # NEW: 40+ nature tests
│       ├── ...existing tests...
├── types/
│   ├── claimNature.ts                  # NEW: ClaimNature + ClaimNatureResult types
│   ├── knowledgeDomain.ts              # MODIFIED: add new domains
│   ├── specialist.ts                   # MODIFIED: add SpecialistContext
│   └── report.ts                       # MODIFIED: add ReportContext, AnalysisConfidence
app/
├── api/
│   └── analyze/
│       └── route.ts                    # MODIFIED: use new architecture
├── page.tsx                            # MODIFIED: display new labels + confidence
└── components/
    └── report/
        └── ReportDisplay.tsx           # MODIFIED: display nature-specific content
```

### Implementation Order

1. **Types Layer** (Week 1)
   - Define ClaimNature, ClaimNatureResult, KnowledgeDomain, ReportContext, AnalysisConfidence types
   - No logic, just type definitions
   - No score/output changes
   - PR for review

2. **Detection Layer** (Weeks 2-3)
   - Implement ClaimNatureDetector
   - Unit tests for 40+ cases
   - Add to claimFirstPipeline (Phase 1)
   - Regression suite must pass identically

3. **Routing Update** (Weeks 4-5)
   - Modify knowledgeRouter to accept ClaimNatureResult
   - Add nature-aware routing signals
   - Phase 2: non-breaking, logs only

4. **Specialist Expansion** (Weeks 6-8)
   - Create PredictionSpecialist, OpinionSpecialist
   - Update existing specialists with SpecialistContext
   - Phase 3: Modify scoring rules for prediction/opinion
   - Regression suite update: expect score changes for prediction/opinion only

5. **Report Engine** (Weeks 9-11)
   - Implement ReportIntelligenceEngine
   - Create templates for each nature + domain pair
   - Phase 4: Integrate into claimFirstPipeline output
   - Manual review of 20+ generated reports

6. **UI Update** (Weeks 12-13)
   - Update page.tsx with new labels (use label matrix)
   - Implement confidence breakdown display
   - Update API response format
   - Phase 5: UI changes only, no backend changes

7. **External Verification** (Future)
   - Integrate with external APIs
   - Only if sources actually available
   - Do NOT fake verification

### Expected Impact

**Positive**:
- Predictions no longer mislabeled as verified facts
- Opinions no longer scored as contradicted by facts alone
- Domain routing more accurate (nature-aware)
- Reports specific to claim type, not generic
- Confidence fields transparent
- Severe claims (promises + false certainty) still high score
- Health/finance promises properly flagged

**Score Changes**:
- Honest predictions: lower (no longer forced high)
- Opinions: more varied (framing-dependent, not false/true)
- Promises with false certainty: still high (preserved)
- Extraordinary claims without evidence: still high (preserved)

**Regression Suite**:
- V20 tests (60): 100% passing (no change)
- V21 tests (40+ nature): new passing tests
- Total: 100+ test cases
- Score changes only in prediction/opinion categories

### Migration Risks

**High Risk**:
- User confusion with new confidence fields
- Score changes for predictions may affect business logic
- Report content changes may not match expectations

**Mitigation**:
- Gradual rollout with feature flags
- Parallel testing (V20 vs. V21)
- User survey on new labels/confidence
- Runbook for score change impacts

### Rollback Plan

**Phase 1-2 Rollback**: Disable nature detection, restore keyword-only routing (15 minutes)
**Phase 3 Rollback**: Restore V20 scoring rules (30 minutes)
**Phase 4 Rollback**: Restore generic report templates (15 minutes)
**Phase 5 Rollback**: Restore generic labels and single confidence field (15 minutes)

---

## Definition of Done

### V21 Architecture Implementation Complete When:

✓ Claim nature detected **before** domain routing (unidirectional flow)
✓ Predictions **never** shown as verified fact or false (inherent uncertainty acknowledged)
✓ Opinions **never** treated as factual contradiction (subjectivity respected)
✓ Domain **never** determined by single isolated keyword (multi-signal routing)
✓ Report content specific to nature + domain (no generic "Contenido general")
✓ No irrelevant domain's scoring dimensions affect final score
✓ External verification status **explicitly** stated (verified vs. unverified)
✓ Confidence fields separated (routing, specialist, evidence, overall)
✓ All 60 V20 regression tests passing identically
✓ All 40+ V21 nature detection tests passing
✓ All 30+ V21 scoring-by-nature tests passing
✓ Report intelligence engine generating nature-specific content
✓ UI labels using precise nature + domain mapping
✓ No contradictory output statements
✓ Tests verify semantics, not regex matches alone
✓ Code review checklist completed

---

## Open Design Decisions

### 1. Hybrid Nature Representation
**Question**: Should secondary natures be parallel or hierarchical?
- Current Proposal: parallel (primaryNature, secondaryNatures array)
- Alternative: Hierarchy (nature tree)
- Impact: Secondary natures don't affect score, only routing

### 2. Confidence Aggregation
**Question**: How to combine three confidence dimensions into overall?
- Current Proposal: Weighted geometric mean (avoid arithmetic mean inflation)
- Alternative: Minimum of three (pessimistic)
- Alternative: Custom weights per domain
- Impact: Affects user perception of analysis reliability

### 3. Domain vs. Topic Labels
**Question**: Should UI distinguish "domain" from "topic" labels?
- Current Proposal: Single label for nature + domain pair
- Alternative: Show domain separately ("Finance - Prediction")
- Alternative: Show nature separately ("Prediction - Bitcoin")
- Impact: UI clarity vs. label length

### 4. External Verification Scope
**Question**: What counts as "external verification"?
- Current Proposal: Verified against actual sources (news, government, scientific database)
- Alternative: Include inference from established knowledge
- Alternative: Only official/authoritative sources
- Impact: Scope of what system can claim as verified

### 5. Extraordinary Claim Threshold
**Question**: What evidence threshold for extraordinary claims?
- Current Proposal: Always high score (85-100) unless corroborated
- Alternative: Depends on claim specificity (location + time = lower threshold)
- Alternative: Depends on domain (scientific extraordinary ≠ political rumor)
- Impact: Scoring distribution for unusual claims

### 6. Opinion Scoring Range
**Question**: What's appropriate score range for subjective opinions?
- Current Proposal: 0-30 baseline, up to 80 with manipulation
- Alternative: Always low score (opinions not "chamuyo")
- Alternative: Always moderate score (subjective uncertainty)
- Impact: User understanding of opinion scoring

### 7. Future Tense Language
**Question**: How to distinguish prediction from promise?
- Current Proposal: "will" + no commitment = prediction; "will" + guarantee language = promise
- Alternative: All future claims scored as predictions
- Alternative: Context-dependent (finance = always promise-like)
- Impact: Promise detection accuracy

---

**End of V21_ARCHITECTURE.md**
