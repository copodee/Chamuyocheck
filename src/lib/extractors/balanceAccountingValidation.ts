import type {
  BalanceFieldName,
  BalanceUnit,
  StructuredBalanceExtraction,
  StructuredBalanceField,
} from './structuredBalanceExtractor';

export type BalanceValidationStatus = 'approved' | 'partial' | 'manual_review_required';

export type FieldValidationResult = {
  usableForRatios: boolean;
  status: 'validated' | 'needs_review' | 'missing';
  reasons: string[];
};

export type BalanceValidationResult = {
  extractionStatus: BalanceValidationStatus;
  accountingEquationPassed: boolean | null;
  accountingEquationDifference: number | null;
  accountingEquationRelativeDifference: number | null;
  periodConsistencyPassed: boolean;
  unitConsistencyPassed: boolean;
  orientationConsistencyPassed: boolean;
  validatedFields: number;
  reviewFields: number;
  missingFields: number;
  blockingReasons: string[];
  warnings: string[];
  fieldValidations: Record<BalanceFieldName, FieldValidationResult>;
};

export type AccountingEquationTolerance = {
  relative: number;
  absoluteByUnit: Record<BalanceUnit, number>;
};

export type BalanceValidationOptions = {
  equationTolerance?: Partial<AccountingEquationTolerance> & {
    absoluteByUnit?: Partial<Record<BalanceUnit, number>>;
  };
  minimumFieldConfidence?: number;
  smallEquityRatio?: number;
};

export type BalanceRatioName =
  | 'currentLiquidity'
  | 'debtToAssets'
  | 'debtToEquity'
  | 'roa'
  | 'roe'
  | 'netMargin';

export type RatioAvailability = {
  canCalculate: boolean;
  reason: string | null;
};

export type BalanceRatioAvailability = Record<BalanceRatioName, RatioAvailability>;

const DEFAULT_TOLERANCE: AccountingEquationTolerance = {
  relative: 0.005,
  absoluteByUnit: {
    ars: 1,
    thousands_ars: 1,
    millions_ars: 0.01,
    unknown: 0,
  },
};

const NUMERIC_FIELDS: BalanceFieldName[] = [
  'currentAssets', 'totalAssets', 'currentLiabilities', 'totalLiabilities',
  'equity', 'sales', 'operatingResult', 'netResult', 'cash',
  'tradeReceivables', 'inventories', 'financialDebt',
];

const PRINCIPAL_FIELDS: BalanceFieldName[] = [
  'currentAssets', 'totalAssets', 'currentLiabilities', 'totalLiabilities',
  'equity', 'sales', 'netResult',
];

const APPROVAL_FIELDS: BalanceFieldName[] = [...NUMERIC_FIELDS];
const EQUATION_FIELDS: BalanceFieldName[] = ['totalAssets', 'totalLiabilities', 'equity'];

function uniquePush(target: string[], message: string): void {
  if (!target.includes(message)) target.push(message);
}

function isPresent(field: StructuredBalanceField): field is StructuredBalanceField & { value: number } {
  return field.value != null && Number.isFinite(field.value);
}

function addFieldReason(
  validations: Record<BalanceFieldName, FieldValidationResult>,
  field: BalanceFieldName,
  reason: string,
): void {
  const validation = validations[field];
  uniquePush(validation.reasons, reason);
  validation.usableForRatios = false;
  if (validation.status !== 'missing') validation.status = 'needs_review';
}

function sameKnownPeriod(fields: StructuredBalanceField[]): boolean {
  const periods = fields.map((field) => field.period).filter((period): period is string => period != null);
  return periods.length === fields.length && new Set(periods).size === 1;
}

function sameKnownUnit(fields: StructuredBalanceField[]): boolean {
  return fields.every((field) => field.unit !== 'unknown')
    && new Set(fields.map((field) => field.unit)).size === 1;
}

function resolveTolerance(options?: BalanceValidationOptions): AccountingEquationTolerance {
  return {
    relative: options?.equationTolerance?.relative ?? DEFAULT_TOLERANCE.relative,
    absoluteByUnit: {
      ...DEFAULT_TOLERANCE.absoluteByUnit,
      ...options?.equationTolerance?.absoluteByUnit,
    },
  };
}

export function validateStructuredBalance(
  extraction: StructuredBalanceExtraction,
  options?: BalanceValidationOptions,
): BalanceValidationResult {
  const minimumConfidence = options?.minimumFieldConfidence ?? 0.7;
  const smallEquityRatio = options?.smallEquityRatio ?? 0.01;
  const tolerance = resolveTolerance(options);
  const warnings: string[] = [];
  const blockingReasons: string[] = [];
  const severeAnomalies: string[] = [];
  const fieldValidations = {} as Record<BalanceFieldName, FieldValidationResult>;

  for (const [name, field] of Object.entries(extraction.fields) as Array<[BalanceFieldName, StructuredBalanceField]>) {
    const reasons: string[] = [];
    let usable = field.status === 'validated' && isPresent(field);
    let status = field.status;
    if (field.status === 'missing' || (NUMERIC_FIELDS.includes(name) && !isPresent(field))) {
      usable = false;
      status = 'missing';
      reasons.push('Campo ausente.');
    } else if (field.status !== 'validated') {
      usable = false;
      reasons.push('La extracciÃ³n requiere revisiÃ³n.');
    }
    if (field.extractionMethod === 'text_fallback') {
      usable = false;
      status = 'needs_review';
      reasons.push('Obtenido Ãºnicamente mediante fallback textual.');
    }
    if (NUMERIC_FIELDS.includes(name) && field.unit === 'unknown' && status !== 'missing') {
      usable = false;
      status = 'needs_review';
      reasons.push('Unidad desconocida.');
    }
    if (NUMERIC_FIELDS.includes(name) && !field.period && status !== 'missing') {
      usable = false;
      status = 'needs_review';
      reasons.push('PerÃ­odo no identificado.');
    }
    if (NUMERIC_FIELDS.includes(name) && field.columnType !== 'current_period' && status !== 'missing') {
      usable = false;
      status = 'needs_review';
      reasons.push('La columna no estÃ¡ identificada como perÃ­odo actual.');
    }
    if (NUMERIC_FIELDS.includes(name) && field.confidence == null && status !== 'missing') {
      usable = false;
      status = 'needs_review';
      reasons.push('No existe confianza de extracciÃ³n trazable.');
    } else if (field.confidence != null && field.confidence < minimumConfidence && status !== 'missing') {
      usable = false;
      status = 'needs_review';
      reasons.push('Confianza de extracciÃ³n insuficiente.');
    }
    fieldValidations[name] = { usableForRatios: usable, status, reasons };
  }

  const relevantPages = new Set(NUMERIC_FIELDS
    .map((name) => extraction.fields[name].page)
    .filter((page): page is number => page != null));
  const pageQuality = extraction.pageQuality ?? [];
  const uncertainRelevantPages = pageQuality.filter((page) =>
    relevantPages.has(page.page) && page.orientationStatus === 'uncertain');
  const coveredPages = new Set(pageQuality.map((page) => page.page));
  const missingOrientationPages = [...relevantPages].filter((page) => !coveredPages.has(page));
  const orientationConsistencyPassed =
    uncertainRelevantPages.length === 0 && missingOrientationPages.length === 0;
  if (!orientationConsistencyPassed) {
    uniquePush(blockingReasons, 'Existe una pÃ¡gina contable relevante con orientaciÃ³n incierta o no verificada.');
    uncertainRelevantPages.forEach((page) => {
      NUMERIC_FIELDS.filter((name) => extraction.fields[name].page === page.page)
        .forEach((name) => addFieldReason(fieldValidations, name, 'La pÃ¡gina de origen tiene orientaciÃ³n incierta.'));
    });
    missingOrientationPages.forEach((page) => {
      NUMERIC_FIELDS.filter((name) => extraction.fields[name].page === page)
        .forEach((name) => addFieldReason(fieldValidations, name, 'Falta trazabilidad de orientaciÃ³n para la pÃ¡gina.'));
    });
  }

  const presentNumeric = NUMERIC_FIELDS
    .map((name) => extraction.fields[name])
    .filter((field) => isPresent(field));
  const periodConsistencyPassed = presentNumeric.length > 0 && sameKnownPeriod(presentNumeric);
  if (!periodConsistencyPassed) {
    uniquePush(blockingReasons, 'Los campos numÃ©ricos no tienen un perÃ­odo Ãºnico y confiable.');
    NUMERIC_FIELDS.filter((name) => isPresent(extraction.fields[name]))
      .forEach((name) => addFieldReason(fieldValidations, name, 'PerÃ­odo inconsistente o incierto.'));
  }
  const durations = extraction.fields.fiscalYearDuration;
  if (isPresent(durations) && durations.value !== 12) {
    uniquePush(warnings, `La duraciÃ³n informada del ejercicio es de ${durations.value} meses.`);
  }

  const unitConsistencyPassed = presentNumeric.length > 0 && sameKnownUnit(presentNumeric);
  if (!unitConsistencyPassed) {
    uniquePush(blockingReasons, 'Las unidades son desconocidas o incompatibles entre campos.');
    NUMERIC_FIELDS.filter((name) => isPresent(extraction.fields[name]))
      .forEach((name) => addFieldReason(fieldValidations, name, 'Unidad desconocida o inconsistente.'));
  }

  let accountingEquationPassed: boolean | null = null;
  let accountingEquationDifference: number | null = null;
  let accountingEquationRelativeDifference: number | null = null;
  const equationValues = EQUATION_FIELDS.map((name) => extraction.fields[name]);
  const equationUsable = EQUATION_FIELDS.every((name) => fieldValidations[name].usableForRatios);
  if (equationUsable && equationValues.every(isPresent) && sameKnownUnit(equationValues) && sameKnownPeriod(equationValues)) {
    const [assets, liabilities, equity] = equationValues;
    accountingEquationDifference = assets.value - liabilities.value - equity.value;
    accountingEquationRelativeDifference = assets.value === 0
      ? accountingEquationDifference === 0 ? 0 : null
      : Math.abs(accountingEquationDifference) / Math.abs(assets.value);
    const absoluteTolerance = tolerance.absoluteByUnit[assets.unit];
    const relativeTolerance = Math.abs(assets.value) * tolerance.relative;
    accountingEquationPassed = Math.abs(accountingEquationDifference) <= Math.max(absoluteTolerance, relativeTolerance);
    if (!accountingEquationPassed) {
      const reason = 'La ecuaciÃ³n contable presenta una diferencia significativa.';
      uniquePush(blockingReasons, reason);
      uniquePush(severeAnomalies, reason);
      EQUATION_FIELDS.forEach((name) => addFieldReason(fieldValidations, name, reason));
    }
  }

  const compareSubtotal = (
    child: BalanceFieldName,
    total: BalanceFieldName,
    message: string,
  ): void => {
    const childField = extraction.fields[child];
    const totalField = extraction.fields[total];
    if (isPresent(childField) && isPresent(totalField)
      && sameKnownUnit([childField, totalField]) && sameKnownPeriod([childField, totalField])
      && childField.value > totalField.value) {
      uniquePush(warnings, message);
      uniquePush(severeAnomalies, message);
      addFieldReason(fieldValidations, child, message);
    }
  };
  compareSubtotal('currentAssets', 'totalAssets', 'El activo corriente supera al activo total.');
  compareSubtotal('currentLiabilities', 'totalLiabilities', 'El pasivo corriente supera al pasivo total.');
  compareSubtotal('cash', 'currentAssets', 'Las disponibilidades superan al activo corriente.');
  compareSubtotal('tradeReceivables', 'currentAssets', 'Los crÃ©ditos por ventas superan al activo corriente.');
  compareSubtotal('inventories', 'currentAssets', 'Los inventarios superan al activo corriente.');
  compareSubtotal('financialDebt', 'totalLiabilities', 'La deuda financiera supera al pasivo total.');

  const unusualPositiveFields: BalanceFieldName[] = [
    'currentAssets', 'totalAssets', 'currentLiabilities', 'totalLiabilities',
    'equity', 'sales', 'cash', 'tradeReceivables', 'inventories', 'financialDebt',
  ];
  unusualPositiveFields.forEach((name) => {
    const field = extraction.fields[name];
    if (isPresent(field) && field.value < 0) {
      const reason = `${name} presenta un signo negativo inusual.`;
      uniquePush(warnings, reason);
      uniquePush(severeAnomalies, reason);
      addFieldReason(fieldValidations, name, reason);
    }
  });

  const totalAssets = extraction.fields.totalAssets;
  const equity = extraction.fields.equity;
  if (isPresent(totalAssets) && isPresent(equity) && totalAssets.value !== 0) {
    const equityRatio = Math.abs(equity.value / totalAssets.value);
    if (equity.value >= 0 && equityRatio < smallEquityRatio) {
      const reason = 'El patrimonio neto es anormalmente pequeÃ±o respecto del activo total.';
      uniquePush(warnings, reason);
      addFieldReason(fieldValidations, 'equity', reason);
    }
  }

  const flagExtremeImplicitRatio = (
    numerator: BalanceFieldName,
    denominator: BalanceFieldName,
    limit: number,
    description: string,
  ): void => {
    const numeratorField = extraction.fields[numerator];
    const denominatorField = extraction.fields[denominator];
    if (!isPresent(numeratorField) || !isPresent(denominatorField) || denominatorField.value === 0
      || !sameKnownUnit([numeratorField, denominatorField])
      || !sameKnownPeriod([numeratorField, denominatorField])) return;
    if (Math.abs(numeratorField.value / denominatorField.value) > limit) {
      const reason = `${description} presenta una relaciÃ³n implÃ­cita matemÃ¡ticamente extrema.`;
      uniquePush(warnings, reason);
      uniquePush(severeAnomalies, reason);
      addFieldReason(fieldValidations, numerator, reason);
      addFieldReason(fieldValidations, denominator, reason);
    }
  };
  flagExtremeImplicitRatio('totalLiabilities', 'totalAssets', 100, 'El endeudamiento sobre activo');
  flagExtremeImplicitRatio('netResult', 'totalAssets', 10, 'El resultado sobre activo');
  flagExtremeImplicitRatio('netResult', 'sales', 5, 'El margen neto');

  const positiveValues = NUMERIC_FIELDS.map((name) => ({ name, field: extraction.fields[name] }))
    .filter((item): item is { name: BalanceFieldName; field: StructuredBalanceField & { value: number } } =>
      isPresent(item.field) && Math.abs(item.field.value) > 0)
    .sort((left, right) => Math.abs(left.field.value) - Math.abs(right.field.value));
  if (positiveValues.length >= 4) {
    const median = Math.abs(positiveValues[Math.floor(positiveValues.length / 2)].field.value);
    positiveValues.forEach(({ name, field }) => {
      const magnitude = Math.abs(field.value) / median;
      if (magnitude > 1_000_000 || magnitude < 0.000001) {
        const reason = `${name} tiene una magnitud atÃ­pica respecto de los demÃ¡s campos.`;
        uniquePush(warnings, reason);
        uniquePush(severeAnomalies, reason);
        addFieldReason(fieldValidations, name, reason);
      }
    });
  }

  const repeated = new Map<number, BalanceFieldName[]>();
  positiveValues.forEach(({ name, field }) => {
    const list = repeated.get(field.value) ?? [];
    list.push(name);
    repeated.set(field.value, list);
  });
  for (const names of repeated.values()) {
    if (names.length >= 4) {
      const reason = `Importe idÃ©ntico repetido de forma sospechosa en: ${names.join(', ')}.`;
      uniquePush(warnings, reason);
      names.forEach((name) => addFieldReason(fieldValidations, name, reason));
    }
  }

  const fallbackPrincipals = EQUATION_FIELDS.filter((name) =>
    extraction.fields[name].extractionMethod === 'text_fallback');
  if (fallbackPrincipals.length) {
    uniquePush(blockingReasons, 'Activo, pasivo o patrimonio provienen Ãºnicamente del fallback textual.');
  }
  const missingPrincipals = PRINCIPAL_FIELDS.filter((name) => fieldValidations[name].status === 'missing');
  if (missingPrincipals.length >= 3) {
    uniquePush(blockingReasons, 'Faltan varios campos principales.');
  }
  if (severeAnomalies.length >= 2) {
    uniquePush(blockingReasons, 'Se detectaron varias anomalÃ­as graves simultÃ¡neas.');
  }

  const provisional: BalanceValidationResult = {
    extractionStatus: 'partial',
    accountingEquationPassed,
    accountingEquationDifference,
    accountingEquationRelativeDifference,
    periodConsistencyPassed,
    unitConsistencyPassed,
    orientationConsistencyPassed,
    validatedFields: 0,
    reviewFields: 0,
    missingFields: 0,
    blockingReasons,
    warnings,
    fieldValidations,
  };
  const ratioAvailability = determineBalanceRatioAvailability(extraction, provisional);
  if (!Object.values(ratioAvailability).some((ratio) => ratio.canCalculate)) {
    uniquePush(blockingReasons, 'No existen suficientes campos confiables para calcular indicadores principales.');
  }

  const allApprovalFieldsUsable = APPROVAL_FIELDS.every((name) => fieldValidations[name].usableForRatios);
  const hasBlockingReasons = blockingReasons.length > 0;
  provisional.extractionStatus = hasBlockingReasons
    ? 'manual_review_required'
    : allApprovalFieldsUsable && accountingEquationPassed === true
      ? 'approved'
      : 'partial';
  provisional.validatedFields = Object.values(fieldValidations).filter((field) => field.status === 'validated').length;
  provisional.reviewFields = Object.values(fieldValidations).filter((field) => field.status === 'needs_review').length;
  provisional.missingFields = Object.values(fieldValidations).filter((field) => field.status === 'missing').length;
  return provisional;
}

function ratioDecision(
  extraction: StructuredBalanceExtraction,
  validation: BalanceValidationResult,
  numerator: BalanceFieldName,
  denominator: BalanceFieldName,
  options?: { rejectNegativeDenominator?: boolean; rejectSmallEquity?: boolean },
): RatioAvailability {
  const numeratorValidation = validation.fieldValidations[numerator];
  const denominatorValidation = validation.fieldValidations[denominator];
  if (!numeratorValidation.usableForRatios) {
    return { canCalculate: false, reason: `${numerator} no estÃ¡ validado para ratios.` };
  }
  if (!denominatorValidation.usableForRatios) {
    return { canCalculate: false, reason: `${denominator} no estÃ¡ validado para ratios.` };
  }
  const numeratorField = extraction.fields[numerator];
  const denominatorField = extraction.fields[denominator];
  if (!isPresent(denominatorField) || denominatorField.value === 0) {
    return { canCalculate: false, reason: `${denominator} es cero o estÃ¡ ausente.` };
  }
  if (!sameKnownPeriod([numeratorField, denominatorField])) {
    return { canCalculate: false, reason: 'Los campos pertenecen a perÃ­odos distintos o inciertos.' };
  }
  if (!sameKnownUnit([numeratorField, denominatorField])) {
    return { canCalculate: false, reason: 'Los campos utilizan unidades distintas o desconocidas.' };
  }
  if (options?.rejectNegativeDenominator && denominatorField.value < 0) {
    return { canCalculate: false, reason: `${denominator} es negativo.` };
  }
  if (options?.rejectSmallEquity && Math.abs(denominatorField.value) < Math.abs(numeratorField.value) * 0.01) {
    return { canCalculate: false, reason: 'El patrimonio es demasiado pequeÃ±o para un ratio confiable.' };
  }
  return { canCalculate: true, reason: null };
}

export function determineBalanceRatioAvailability(
  extraction: StructuredBalanceExtraction,
  validation: BalanceValidationResult,
): BalanceRatioAvailability {
  return {
    currentLiquidity: ratioDecision(extraction, validation, 'currentAssets', 'currentLiabilities'),
    debtToAssets: ratioDecision(extraction, validation, 'totalLiabilities', 'totalAssets'),
    debtToEquity: ratioDecision(extraction, validation, 'totalLiabilities', 'equity', {
      rejectNegativeDenominator: true,
      rejectSmallEquity: true,
    }),
    roa: ratioDecision(extraction, validation, 'netResult', 'totalAssets'),
    roe: ratioDecision(extraction, validation, 'netResult', 'equity', {
      rejectNegativeDenominator: true,
      rejectSmallEquity: true,
    }),
    netMargin: ratioDecision(extraction, validation, 'netResult', 'sales'),
  };
}

