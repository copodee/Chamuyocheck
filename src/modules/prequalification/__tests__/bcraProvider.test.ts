import assert from 'node:assert/strict';
import test from 'node:test';
import { BcraCreditProvider } from '../providers/bcraProvider';

test('normaliza deuda BCRA expresada en miles de pesos', async () => {
  const fetcher = async (url: string | URL | Request) => {
    const path = String(url);
    const results = path.includes('Historicas')
      ? { periodos: [{ periodo: '202605', entidades: [{ entidad: 'Banco A', situacion: 2, monto: 12 }] }] }
      : path.includes('ChequesRechazados')
        ? { causales: [] }
        : { identificacion: 30712345677, denominacion: 'Empresa', periodos: [{ periodo: '202606', entidades: [{ entidad: 'Banco A', situacion: 1, monto: 10, diasAtrasoPago: 0 }] }] };
    return new Response(JSON.stringify({ results }), { status: 200 });
  };
  const result = await new BcraCreditProvider(fetcher as typeof fetch, 'https://test.local').getCreditReport('30712345671');
  assert.equal(result.current[0].debtAmount, 10_000);
  assert.equal(result.history[0].situation, 2);
  assert.equal(result.denomination, 'Empresa');
});
