import assert from 'node:assert/strict';
import test from 'node:test';
import { readLocalHistory, removeLocalHistoryItem, saveLocalHistory } from '../localHistory';

function installStorage(initial = '') {
  const values = new Map<string, string>();
  if (initial) values.set('cc_history', initial);
  Object.defineProperty(globalThis, 'window', { configurable: true, value: globalThis });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
}

test('history persists the query context and replaces a duplicate id', () => {
  installStorage();
  saveLocalHistory({ id: 'case-1', date: '21/7/2026', title: 'Primero', score: 50, documentType: 'Texto', query: 'consulta original', category: 'finance-credit' });
  saveLocalHistory({ id: 'case-1', date: '21/7/2026', title: 'Actualizado', score: 60, documentType: 'Texto', query: 'consulta actualizada', category: 'finance-credit' });
  const history = readLocalHistory();
  assert.equal(history.length, 1);
  assert.equal(history[0].title, 'Actualizado');
  assert.equal(history[0].query, 'consulta actualizada');
});

test('history fails closed when local storage is malformed', () => {
  installStorage('{broken');
  assert.deepEqual(readLocalHistory(), []);
});

test('history removes only the selected analysis', () => {
  installStorage();
  saveLocalHistory({ id: 'case-1', date: '', title: 'Uno', score: 10, documentType: 'Texto' });
  saveLocalHistory({ id: 'case-2', date: '', title: 'Dos', score: 20, documentType: 'Texto' });
  const remaining = removeLocalHistoryItem('case-1');
  assert.deepEqual(remaining.map((item) => item.id), ['case-2']);
});
