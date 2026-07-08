export type HistoryItem = {
  id: string;
  date: string;
  title: string;
  score: number;
  documentType: string;
};

export function saveLocalHistory(item: HistoryItem) {
  if (typeof window === 'undefined') return;
  const current = JSON.parse(localStorage.getItem('cc_history') || '[]');
  const next = [item, ...current].slice(0, 20);
  localStorage.setItem('cc_history', JSON.stringify(next));
}

export function readLocalHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return [];
  return JSON.parse(localStorage.getItem('cc_history') || '[]');
}
