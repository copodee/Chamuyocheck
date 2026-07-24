export type ClientType = 'persona-humana' | 'persona-juridica';

export type AssetType =
  | 'automotor-0km'
  | 'automotor-usado'
  | 'maquinaria'
  | 'equipo'
  | 'inmueble'
  | 'otro';

export type PrequalificationStatus =
  | 'prequalified'
  | 'conditional'
  | 'manual-review'
  | 'not-prequalified';

export type CreditPosition = {
  entity: string;
  period: string;
  situation: number;
  debtAmount: number;
  daysPastDue: number;
  underReview: boolean;
  judicialProcess: boolean;
};

export type RejectedCheck = {
  bank: string;
  rejectionDate: string;
  amount: number;
  paidDate: string | null;
  finePaidDate: string | null;
};

export type CreditReport = {
  provider: string;
  subjectId: string;
  denomination: string | null;
  current: CreditPosition[];
  history: CreditPosition[];
  rejectedChecks: RejectedCheck[];
  fetchedAt: string;
  warnings: string[];
};

export type PrequalificationRequest = {
  cuit: string;
  clientType: ClientType;
  assetValue: number;
  advance?: number;
  termMonths: number;
  assetType: AssetType;
};

export type PaymentCapacity = {
  status: 'not-estimable';
  explanation: string;
  requestedExposure: number;
  advanceRatio: number;
};

export type PrequalificationResult = {
  status: PrequalificationStatus;
  score: number;
  confidence: 'alta' | 'media' | 'baja';
  riskLevel: 'bajo' | 'medio' | 'alto' | 'muy alto' | 'sin datos';
  totalDebt: number;
  creditorCount: number;
  maximumSituation: number | null;
  currentSituation: number | null;
  rejectedChecks: number;
  currentPositions: Array<{
    entity: string;
    period: string;
    situation: number;
    debtAmount: number;
    daysPastDue: number;
    refinancedOrObserved: boolean;
  }>;
  paymentCapacity: PaymentCapacity;
  conditions: string[];
  reasons: string[];
  history: Array<{ period: string; maximumSituation: number; totalDebt: number }>;
  provider: string;
  evaluatedAt: string;
  modelVersion: string;
};
