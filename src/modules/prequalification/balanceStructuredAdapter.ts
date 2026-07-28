import { detectAccountingColumns } from '../../lib/extractors/accountingPdfStructure';
import {
  extractStructuredBalanceData,
  type BalanceFieldName,
  type StructuredBalanceExtraction,
} from '../../lib/extractors/structuredBalanceExtractor';
import {
  normalizePdfDocumentOrientation,
} from '../../lib/extractors/pdfOrientationNormalization';
import type { StructuredPdfDocument } from '../../lib/extractors/browserPdfStructure';
import {
  integrateStructuredBalancePrequalification,
  type BalancePrequalificationIntegration,
} from './balancePrequalificationIntegration';
import type { EconomicInputs, ExtractedBalance } from './domain/dossier';

export const STRUCTURED_BALANCE_EXTRACTOR_VERSION = 'structured-balance-v1';

export type AccountingFieldTrace = {
  status: 'validated' | 'needs_review' | 'missing';
  authorized: boolean;
  page: number | null;
  rowIndex: number | null;
  period: string | null;
  source: 'pdfjs' | 'ocr' | null;
  confidence: number | null;
  extractionMethod: 'structured' | 'text_fallback' | null;
};

export type BalanceAccountingControl = {
  extractorVersion: typeof STRUCTURED_BALANCE_EXTRACTOR_VERSION;
  extractionStatus: 'approved' | 'partial' | 'manual_review_required';
  automaticPrequalificationBlocked: boolean;
  blockingReasons: string[];
  authorizedFields: BalanceFieldName[];
  ratios: BalancePrequalificationIntegration['ratios'];
  trace: Partial<Record<BalanceFieldName, AccountingFieldTrace>>;
};

export type StructuredBalanceProcessingResult = {
  balance: ExtractedBalance;
  extraction: StructuredBalanceExtraction;
  integration: BalancePrequalificationIntegration;
  control: BalanceAccountingControl;
};

const PRODUCTIVE_FIELDS: Partial<Record<BalanceFieldName, keyof ExtractedBalance>> = {
  currentAssets: 'currentAssets',
  totalAssets: 'totalAssets',
  currentLiabilities: 'currentLiabilities',
  totalLiabilities: 'totalLiabilities',
  equity: 'equity',
  sales: 'sales',
  operatingResult: 'operatingProfit',
  netResult: 'netProfit',
  cash: 'cash',
  tradeReceivables: 'tradeReceivables',
  inventories: 'inventory',
  financialDebt: 'financialDebt',
};

function scaleFor(extraction: StructuredBalanceExtraction): 1 | 1000 | 1000000 {
  const units = Object.values(extraction.fields)
    .filter(field => field.value != null)
    .map(field => field.unit);
  if (units.includes('millions_ars')) return 1000000;
  if (units.includes('thousands_ars')) return 1000;
  return 1;
}

export function adaptStructuredBalanceToExtractedBalance(
  extraction: StructuredBalanceExtraction,
  integration = integrateStructuredBalancePrequalification(extraction),
): ExtractedBalance {
  const validation = integration.validation;
  const amountScale = scaleFor(extraction);
  const result: ExtractedBalance = {
    closingDate: null,
    periodMonths: null,
    statementKind: 'unknown',
    currencyBasis: 'unknown',
    amountScale,
    statementScope: 'unknown',
    assuranceLevel: 'unknown',
    currentAssets: null,
    nonCurrentAssets: null,
    currentLiabilities: null,
    nonCurrentLiabilities: null,
    equity: null,
    sales: null,
    grossProfit: null,
    operatingProfit: null,
    netProfit: null,
    financialDebt: null,
    cash: null,
    inventory: null,
    tradeReceivables: null,
    costOfSales: null,
    interestExpense: null,
    depreciationAndAmortization: null,
    totalAssets: null,
    totalLiabilities: null,
    ebitda: null,
    extractionConfidence: 0,
    missingFields: [],
  };

  const authorizedConfidences: number[] = [];
  for (const [fieldName, productiveName] of Object.entries(PRODUCTIVE_FIELDS) as Array<
    [BalanceFieldName, keyof ExtractedBalance]
  >) {
    const field = extraction.fields[fieldName];
    const authorized = !integration.automaticPrequalificationBlocked
      && validation?.fieldValidations[fieldName]?.usableForRatios === true;
    if (authorized && field.value != null) {
      (result as Record<string, unknown>)[productiveName] = field.value * amountScale;
      if (field.confidence != null) authorizedConfidences.push(field.confidence);
    } else {
      (result as Record<string, unknown>)[productiveName] = null;
      result.missingFields.push(fieldName);
    }
  }

  const closingDate = extraction.fields.closingDate;
  if (!integration.automaticPrequalificationBlocked
    && validation?.fieldValidations.closingDate?.status === 'validated') {
    result.closingDate = closingDate.rawValue;
  }
  const duration = extraction.fields.fiscalYearDuration;
  if (!integration.automaticPrequalificationBlocked
    && validation?.fieldValidations.fiscalYearDuration?.status === 'validated'
    && duration.value != null) {
    result.periodMonths = duration.value;
    result.statementKind = duration.value === 12 ? 'annual' : 'interim';
  }
  result.extractionConfidence = authorizedConfidences.length
    ? Math.round(authorizedConfidences.reduce((sum, value) => sum + value, 0)
      / authorizedConfidences.length * 100)
    : 0;
  return result;
}

export function buildBalanceAccountingControl(
  extraction: StructuredBalanceExtraction,
  integration: BalancePrequalificationIntegration,
): BalanceAccountingControl {
  const validation = integration.validation!;
  const authorizedFields = (Object.keys(extraction.fields) as BalanceFieldName[])
    .filter(name => validation.fieldValidations[name].usableForRatios);
  return {
    extractorVersion: STRUCTURED_BALANCE_EXTRACTOR_VERSION,
    extractionStatus: validation.extractionStatus,
    automaticPrequalificationBlocked: integration.automaticPrequalificationBlocked,
    blockingReasons: [...validation.blockingReasons],
    authorizedFields,
    ratios: integration.ratios,
    trace: Object.fromEntries((Object.entries(extraction.fields) as Array<
      [BalanceFieldName, StructuredBalanceExtraction['fields'][BalanceFieldName]]
    >).map(([name, field]) => [name, {
      status: validation.fieldValidations[name].status,
      authorized: validation.fieldValidations[name].usableForRatios,
      page: field.page,
      rowIndex: field.rowIndex,
      period: field.period,
      source: field.source,
      confidence: field.confidence,
      extractionMethod: field.extractionMethod,
    }])),
  };
}

export function processStructuredBalance(
  document: StructuredPdfDocument,
  fallbackText: string,
): StructuredBalanceProcessingResult {
  const orientation = normalizePdfDocumentOrientation(document);
  const accountingStructure = detectAccountingColumns(orientation);
  const extraction = extractStructuredBalanceData(document, accountingStructure, orientation, fallbackText);
  const integration = integrateStructuredBalancePrequalification(extraction);
  return {
    balance: adaptStructuredBalanceToExtractedBalance(extraction, integration),
    extraction,
    integration,
    control: buildBalanceAccountingControl(extraction, integration),
  };
}

export function isBalanceAccountingControl(value: unknown): value is BalanceAccountingControl {
  if (!value || typeof value !== 'object') return false;
  const control = value as Partial<BalanceAccountingControl>;
  const authorizedFields = control.authorizedFields as BalanceFieldName[] | undefined;
  const trace = control.trace as BalanceAccountingControl['trace'] | undefined;
  const authorizedTraceIsValid = authorizedFields?.every(field => {
    const item = trace?.[field];
    if (!item || !item.authorized || item.status !== 'validated'
      || item.extractionMethod !== 'structured'
      || (item.source !== 'pdfjs' && item.source !== 'ocr')
      || item.confidence == null || item.confidence < 0.7) return false;
    return ['closingDate', 'fiscalYearDuration', 'currency', 'statementUnit'].includes(field)
      || item.period != null;
  }) === true;
  return control.extractorVersion === STRUCTURED_BALANCE_EXTRACTOR_VERSION
    && ['approved', 'partial', 'manual_review_required'].includes(String(control.extractionStatus))
    && typeof control.automaticPrequalificationBlocked === 'boolean'
    && Array.isArray(control.blockingReasons)
    && Array.isArray(control.authorizedFields)
    && control.authorizedFields.every(field => field in PRODUCTIVE_FIELDS || field === 'closingDate'
      || field === 'fiscalYearDuration' || field === 'currency' || field === 'statementUnit')
    && authorizedTraceIsValid;
}

export function sanitizeExtractedBalanceWithControl(
  balance: ExtractedBalance | undefined,
  control: BalanceAccountingControl | undefined,
): ExtractedBalance | undefined {
  if (!balance || !control || !isBalanceAccountingControl(control)) return balance;
  if (control.automaticPrequalificationBlocked || control.extractionStatus === 'manual_review_required') {
    return undefined;
  }
  const allowed = new Set(control.authorizedFields);
  const sanitized = { ...balance, missingFields: [...balance.missingFields] };
  for (const [fieldName, productiveName] of Object.entries(PRODUCTIVE_FIELDS) as Array<
    [BalanceFieldName, keyof ExtractedBalance]
  >) {
    if (!allowed.has(fieldName)) {
      (sanitized as Record<string, unknown>)[productiveName] = null;
      if (!sanitized.missingFields.includes(fieldName)) sanitized.missingFields.push(fieldName);
    }
  }
  return sanitized;
}

export function sanitizeBalanceDerivedEconomicInputs(
  inputs: EconomicInputs,
  balance: ExtractedBalance | undefined,
  control: BalanceAccountingControl | undefined,
  hasIndependentDebtDocument: boolean,
): EconomicInputs {
  if (!control) return inputs;
  return {
    ...inputs,
    computableNetWorth: control.authorizedFields.includes('equity')
      ? balance?.equity || 0 : 0,
    existingComputableFinancing: hasIndependentDebtDocument
      ? inputs.existingComputableFinancing
      : control.authorizedFields.includes('financialDebt')
        ? balance?.financialDebt || 0 : 0,
  };
}
