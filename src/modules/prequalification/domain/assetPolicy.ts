import type { AssetType, ClientType } from './types';

export const STANDARD_TERM_MONTHS = [12, 18, 24, 36, 48, 60, 72, 84] as const;
export const HUMAN_VESSEL_TERM_MONTHS = [12, 18, 24, 36] as const;
export const COMPANY_VESSEL_TERM_MONTHS = [36] as const;

export function allowedTermMonths(clientType: ClientType | string, assetType: AssetType | string): readonly number[] {
  if (assetType !== 'embarcacion') return STANDARD_TERM_MONTHS;
  return clientType === 'persona-juridica' ? COMPANY_VESSEL_TERM_MONTHS : HUMAN_VESSEL_TERM_MONTHS;
}

export function isAllowedTerm(clientType: ClientType | string, assetType: AssetType | string, termMonths: number) {
  return allowedTermMonths(clientType, assetType).includes(termMonths);
}
