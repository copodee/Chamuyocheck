export type HistoryItem = {
  id: string;
  date: string;
  title: string;
  score: number;
  documentType: string;
  query?: string;
  category?: string;
  legalBranch?: string;
  legalJurisdiction?: string;
};

export function saveLocalHistory(item: HistoryItem) {
  if (typeof window === 'undefined') return;
  const current = readLocalHistory();
  const next = [item, ...current.filter((saved) => saved.id !== item.id)].slice(0, 20);
  localStorage.setItem('cc_history', JSON.stringify(next));
}

export function readLocalHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem('cc_history') || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === 'string' && typeof item.title === 'string') : [];
  } catch {
    return [];
  }
}
