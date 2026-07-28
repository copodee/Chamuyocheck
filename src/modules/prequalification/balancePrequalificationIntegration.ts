import {
  determineBalanceRatioAvailability,
  validateStructuredBalance,
  type BalanceRatioName,
  type BalanceValidationResult,
  type RatioAvailability,
} from '../../lib/extractors/balanceAccountingValidation';
import type {
  BalanceFieldName,
  StructuredBalanceExtraction,
  StructuredBalanceField,
} from '../../lib/extractors/structuredBalanceExtractor';

export type VisibleBalanceRatio = RatioAvailability & {
  value: number | null;
  displayValue: string;
};

export type VisibleAccountingField = {
  id: BalanceFieldName;
  name: string;
  interpretedValue: string;
  status: 'validated' | 'needs_review' | 'missing';
  period: string | null;
  unit: string;
  page: number | null;
  source: 'PDF.js' | 'OCR' | 'No disponible';
  confidence: string;
  extractionMethod: 'Estructurada' | 'Fallback textual' | 'No disponible';
  validationReasons: string[];
};

export type AccountingQualityPresentation = {
  title: 'Calidad de la información contable';
  generalStatusLabel: 'Aprobada para análisis' | 'Análisis parcial' | 'Revisión manual requerida';
  validatedFields: number;
  reviewFields: number;
  missingFields: number;
  accountingEquation: string;
  periodConsistency: string;
  unitConsistency: string;
  orientationConsistency: string;
  warnings: string[];
  blockingReasons: string[];
  fields: VisibleAccountingField[];
};

export type BalancePrequalificationIntegration = {
  mode: 'structured' | 'legacy';
  structuredIntegrationApplied: boolean;
  useLegacyFlow: boolean;
  automaticPrequalificationBlocked: boolean;
  canContinueWithFinancialAnalysis: boolean;
  userMessage: string | null;
  documentationQualityStatus: 'approved' | 'partial' | 'manual_review_required' | 'not_assessed';
  financialRiskStatus: 'not_evaluated';
  financialRiskReason: string;
  validation: BalanceValidationResult | null;
  ratios: Record<BalanceRatioName, VisibleBalanceRatio> | null;
  qualityPresentation: AccountingQualityPresentation | null;
};

const FIELD_LABELS: Record<BalanceFieldName, string> = {
  currentAssets: 'Activo corriente',
  totalAssets: 'Activo total',
  currentLiabilities: 'Pasivo corriente',
  totalLiabilities: 'Pasivo total',
  equity: 'Patrimonio neto',
  sales: 'Ventas',
  operatingResult: 'Resultado operativo',
  netResult: 'Resultado neto',
  cash: 'Disponibilidades',
  tradeReceivables: 'Créditos por ventas',
  inventories: 'Inventarios',
  financialDebt: 'Deuda financiera',
  closingDate: 'Fecha de cierre',
  fiscalYearDuration: 'Duración del ejercicio',
  currency: 'Moneda',
  statementUnit: 'Unidad de presentación',
};

const UNIT_LABELS: Record<StructuredBalanceField['unit'], string> = {
  ars: 'Pesos',
  thousands_ars: 'Miles de pesos',
  millions_ars: 'Millones de pesos',
  unknown: 'No identificada',
};

const RATIO_CALCULATIONS: Record<BalanceRatioName, {
  numerator: BalanceFieldName;
  denominator: BalanceFieldName;
}> = {
  currentLiquidity: { numerator: 'currentAssets', denominator: 'currentLiabilities' },
  debtToAssets: { numerator: 'totalLiabilities', denominator: 'totalAssets' },
  debtToEquity: { numerator: 'totalLiabilities', denominator: 'equity' },
  roa: { numerator: 'netResult', denominator: 'totalAssets' },
  roe: { numerator: 'netResult', denominator: 'equity' },
  netMargin: { numerator: 'netResult', denominator: 'sales' },
};

function statusLabel(status: BalanceValidationResult['extractionStatus']): AccountingQualityPresentation['generalStatusLabel'] {
  if (status === 'approved') return 'Aprobada para análisis';
  if (status === 'partial') return 'Análisis parcial';
  return 'Revisión manual requerida';
}

function interpretedValue(field: StructuredBalanceField): string {
  if (field.rawValue != null && field.value == null) return field.rawValue;
  if (field.value == null) return 'No disponible';
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 4 }).format(field.value);
}

function visibleField(
  id: BalanceFieldName,
  field: StructuredBalanceField,
  validation: BalanceValidationResult['fieldValidations'][BalanceFieldName],
): VisibleAccountingField {
  return {
    id,
    name: FIELD_LABELS[id],
    interpretedValue: interpretedValue(field),
    status: validation.status,
    period: field.period,
    unit: UNIT_LABELS[field.unit],
    page: field.page,
    source: field.source === 'pdfjs' ? 'PDF.js' : field.source === 'ocr' ? 'OCR' : 'No disponible',
    confidence: field.confidence == null
      ? 'No disponible'
      : `${Math.round(field.confidence * 100)}%`,
    extractionMethod: field.extractionMethod === 'structured'
      ? 'Estructurada'
      : field.extractionMethod === 'text_fallback'
        ? 'Fallback textual'
        : 'No disponible',
    validationReasons: [...validation.reasons],
  };
}

function calculateAuthorizedRatios(
  extraction: StructuredBalanceExtraction,
  validation: BalanceValidationResult,
  blocked: boolean,
): Record<BalanceRatioName, VisibleBalanceRatio> {
  const availability = determineBalanceRatioAvailability(extraction, validation);
  return Object.fromEntries(
    (Object.entries(availability) as Array<[BalanceRatioName, RatioAvailability]>).map(([name, decision]) => {
      const effectiveDecision = blocked
        ? {
          canCalculate: false,
          reason: validation.blockingReasons[0]
            ?? 'La precalificación automática está bloqueada por la calidad documental.',
        }
        : decision;
      if (!effectiveDecision.canCalculate) {
        return [name, {
          ...effectiveDecision,
          value: null,
          displayValue: 'No disponible',
        }];
      }
      const definition = RATIO_CALCULATIONS[name];
      const numerator = extraction.fields[definition.numerator].value;
      const denominator = extraction.fields[definition.denominator].value;
      const value = numerator != null && denominator != null && denominator !== 0
        ? numerator / denominator
        : null;
      return [name, value == null
        ? {
          canCalculate: false,
          reason: 'Los datos validados no permiten completar el cálculo.',
          value: null,
          displayValue: 'No disponible',
        }
        : {
          canCalculate: true,
          reason: null,
          value,
          displayValue: new Intl.NumberFormat('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          }).format(value),
        }];
    }),
  ) as Record<BalanceRatioName, VisibleBalanceRatio>;
}

function qualityPresentation(
  extraction: StructuredBalanceExtraction,
  validation: BalanceValidationResult,
): AccountingQualityPresentation {
  const fieldEntries = Object.entries(extraction.fields) as Array<[BalanceFieldName, StructuredBalanceField]>;
  return {
    title: 'Calidad de la información contable',
    generalStatusLabel: statusLabel(validation.extractionStatus),
    validatedFields: validation.validatedFields,
    reviewFields: validation.reviewFields,
    missingFields: validation.missingFields,
    accountingEquation: validation.accountingEquationPassed == null
      ? 'No comprobable'
      : validation.accountingEquationPassed ? 'Consistente' : 'Inconsistente',
    periodConsistency: validation.periodConsistencyPassed ? 'Consistente' : 'Incierto o inconsistente',
    unitConsistency: validation.unitConsistencyPassed ? 'Consistente' : 'Desconocida o inconsistente',
    orientationConsistency: validation.orientationConsistencyPassed ? 'Verificada' : 'Revisión requerida',
    warnings: [...validation.warnings],
    blockingReasons: [...validation.blockingReasons],
    fields: fieldEntries.map(([id, field]) => visibleField(id, field, validation.fieldValidations[id])),
  };
}

export function integrateStructuredBalancePrequalification(
  extraction?: StructuredBalanceExtraction | null,
): BalancePrequalificationIntegration {
  if (!extraction) {
    return {
      mode: 'legacy',
      structuredIntegrationApplied: false,
      useLegacyFlow: true,
      automaticPrequalificationBlocked: false,
      canContinueWithFinancialAnalysis: true,
      userMessage: null,
      documentationQualityStatus: 'not_assessed',
      financialRiskStatus: 'not_evaluated',
      financialRiskReason: 'No se evaluó calidad documental estructurada; se conserva el flujo anterior.',
      validation: null,
      ratios: null,
      qualityPresentation: null,
    };
  }

  const validation = validateStructuredBalance(extraction);
  const blocked = validation.extractionStatus === 'manual_review_required';
  const ratios = calculateAuthorizedRatios(extraction, validation, blocked);
  const hasAvailableRatio = Object.values(ratios).some((ratio) => ratio.canCalculate);
  return {
    mode: 'structured',
    structuredIntegrationApplied: true,
    useLegacyFlow: false,
    automaticPrequalificationBlocked: blocked,
    canContinueWithFinancialAnalysis: !blocked && hasAvailableRatio,
    userMessage: blocked
      ? 'Información insuficiente para precalificar automáticamente'
      : validation.extractionStatus === 'partial'
        ? 'Análisis parcial: algunos indicadores no están disponibles por información faltante o en revisión.'
        : 'La información contable está aprobada para análisis.',
    documentationQualityStatus: validation.extractionStatus,
    financialRiskStatus: 'not_evaluated',
    financialRiskReason: blocked
      ? 'La calidad documental impide evaluar el riesgo financiero automáticamente.'
      : 'La calidad documental no constituye por sí misma un resultado financiero.',
    validation,
    ratios,
    qualityPresentation: qualityPresentation(extraction, validation),
  };
}
