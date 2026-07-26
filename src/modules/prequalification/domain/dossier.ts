import type { PrequalificationResult } from './types';

export type EconomicProfile =
  | 'employee'
  | 'monotributista'
  | 'responsable-inscripto'
  | 'legal-entity';

export type ContactData = {
  fullName: string;
  businessName?: string;
  contactRole?: string;
  address: string;
  city: string;
  province: string;
  email: string;
  mobile: string;
  preferredChannel: 'email' | 'mobile';
  dataConsent: boolean;
  contactConsent: boolean;
  accuracyDeclaration: boolean;
};

export type EconomicInputs = {
  profile: EconomicProfile;
  activity: string;
  activityCategory?: 'professional-services' | 'fintech' | 'commerce' | 'production' | 'transport' | 'other';
  activitySeniorityMonths: number;
  declaredMonthlyDebtService: number;
  proposedMonthlyCanon: number;
  employeeNetIncome?: number;
  declaredMonthlyNetIncome?: number;
  documentedMonthlyIncome?: number;
  hasEmploymentIncome?: boolean;
  additionalEmploymentNetIncome?: number;
  hasMonotributoIncome?: boolean;
  additionalMonotributoNetIncome?: number;
  monthlySales?: number[];
  declaredOperatingMargin?: number;
  requestedFinancing?: number;
  proposedAdvancePercent?: number;
  proposedAdvanceAmount?: number;
  computableNetWorth?: number;
  existingComputableFinancing?: number;
  qualifyingGuarantee?: 'none' | 'sgr-public-fund';
};

export type RegulatoryExposureAssessment = {
  applicable: boolean;
  computableNetWorth: number | null;
  existingComputableFinancing: number;
  requestedFinancing: number;
  totalExposure: number;
  exposureToNetWorthRatio: number | null;
  basicMarginAvailable: number | null;
  status: 'not-applicable' | 'basic-margin' | 'complementary-margin' | 'guaranteed-special-margin' | 'outside-regulatory-margin' | 'missing-data';
  label: string;
  conditions: string[];
};

export type ExtractedBalance = {
  activity?: string | null;
  closingDate: string | null;
  periodStartDate?: string | null;
  periodMonths?: number | null;
  statementKind?: 'annual' | 'interim' | 'unknown';
  currencyBasis?: 'homogeneous' | 'nominal' | 'unknown';
  amountScale?: 1 | 1000 | 1000000;
  statementScope?: 'consolidated' | 'separate' | 'individual' | 'unknown';
  assuranceLevel?: 'audit' | 'limited-review' | 'unknown';
  currentAssets: number | null;
  nonCurrentAssets: number | null;
  currentLiabilities: number | null;
  nonCurrentLiabilities: number | null;
  equity: number | null;
  sales: number | null;
  grossProfit: number | null;
  operatingProfit: number | null;
  netProfit: number | null;
  financialDebt: number | null;
  cash: number | null;
  inventory?: number | null;
  tradeReceivables?: number | null;
  costOfSales?: number | null;
  interestExpense?: number | null;
  depreciationAndAmortization?: number | null;
  totalAssets?: number | null;
  totalLiabilities?: number | null;
  ebitda?: number | null;
  extractionConfidence: number;
  missingFields: string[];
};

export type CorporateFinancialAssessment = {
  sector: string;
  sectorLabel: string;
  sectorObservations: string[];
  workingCapital: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  cashRatio: number | null;
  debtToEquity: number | null;
  liabilitiesToEquity: number | null;
  netMargin: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  returnOnAssets: number | null;
  returnOnEquity: number | null;
  financialDebtToSales: number | null;
  assetTurnover: number | null;
  inventoryTurnover: number | null;
  receivablesTurnover: number | null;
  interestCoverage: number | null;
  status: 'strong' | 'adequate' | 'review' | 'weak' | 'insufficient-data';
  score: number | null;
  observations: string[];
};

export type CorporateEvolutionAssessment = {
  currentClosingDate: string | null;
  previousClosingDate: string | null;
  salesChange: number | null;
  equityChange: number | null;
  netProfitChange: number | null;
  currentRatioChange: number | null;
  liabilitiesToEquityChange: number | null;
  trend: 'improving' | 'stable' | 'deteriorating' | 'insufficient-data';
  observations: string[];
};

export type EconomicAssessment = {
  score: number;
  confidence: 'declarativa' | 'parcialmente respaldada' | 'documental';
  normalizedMonthlyIncome: number | null;
  declaredMonthlyIncome: number | null;
  documentedMonthlyIncome: number | null;
  declaredDocumentedDifference: number | null;
  declaredDocumentedDifferenceRatio: number | null;
  totalMonthlyCommitments: number | null;
  installmentToIncomeRatio: number | null;
  canonCoverage: number | null;
  totalCommitmentCoverage: number | null;
  requestedFinancingToSales: number | null;
  requestedFinancingToAssets: number | null;
  maximumPrudentCanon: number | null;
  status: 'compatible' | 'conditional' | 'manual-review' | 'not-compatible';
  reasons: string[];
  conditions: string[];
  balance?: ExtractedBalance;
  corporateFinancials?: CorporateFinancialAssessment;
  corporateEvolution?: CorporateEvolutionAssessment;
  regulatoryExposure: RegulatoryExposureAssessment;
};

export type DossierDocument = {
  id: string;
  stage: 2 | 3;
  kind: string;
  name: string;
  size: number;
  pages?: number;
  extractionConfidence?: number;
  extractedText?: string;
  storagePath?: string;
  status: 'read' | 'uploaded' | 'needs-review';
};

export type ComplianceDeclarations = {
  pepStatus: 'no' | 'yes' | 'related';
  pepDetail?: string;
  obligedSubject: boolean;
  fundsLawfulOrigin: boolean;
  ownAccount: boolean;
  taxResidenceArgentina: boolean;
  foreignTaxResidences?: string;
  administratorMayRequestEvidence: boolean;
};

export type PrequalificationDossier = {
  caseId: string;
  caseNumber: string;
  stage: 1 | 2 | 3;
  contact?: ContactData;
  economicInputs?: EconomicInputs;
  economicAssessment?: EconomicAssessment;
  documents: DossierDocument[];
  stage1Result: PrequalificationResult;
  stage3Decision?: 'ready' | 'conditional' | 'additional-guarantees' | 'more-information' | 'not-compatible';
  compliance?: ComplianceDeclarations;
  responseEmail?: string;
  administratorEmail?: string;
  emailProvider?: 'resend' | 'amazon-ses' | 'smtp' | 'pending';
};
