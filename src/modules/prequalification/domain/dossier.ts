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
  activitySeniorityMonths: number;
  declaredMonthlyDebtService: number;
  proposedMonthlyCanon: number;
  employeeNetIncome?: number;
  hasEmploymentIncome?: boolean;
  additionalEmploymentNetIncome?: number;
  monthlySales?: number[];
  declaredOperatingMargin?: number;
};

export type ExtractedBalance = {
  closingDate: string | null;
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
  extractionConfidence: number;
  missingFields: string[];
};

export type EconomicAssessment = {
  score: number;
  confidence: 'declarativa' | 'parcialmente respaldada' | 'documental';
  normalizedMonthlyIncome: number | null;
  totalMonthlyCommitments: number | null;
  installmentToIncomeRatio: number | null;
  canonCoverage: number | null;
  maximumPrudentCanon: number | null;
  status: 'compatible' | 'conditional' | 'manual-review' | 'not-compatible';
  reasons: string[];
  conditions: string[];
  balance?: ExtractedBalance;
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
