import type { CreditReport } from '../domain/types';

export interface CreditProvider {
  readonly id: string;
  getCreditReport(subjectId: string): Promise<CreditReport>;
}

export class CreditProviderError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid-id' | 'not-found' | 'unavailable' | 'bad-response',
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'CreditProviderError';
  }
}
