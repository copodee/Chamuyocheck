import assert from 'node:assert/strict';
import test from 'node:test';
import { BcraCreditProvider } from '../providers/bcraProvider';
import { CreditProviderError } from '../providers/creditProvider';

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

test('reintenta una respuesta temporal 503 del BCRA', async () => {
  let currentAttempts = 0;
  const fetcher = async (url: string | URL | Request) => {
    const path = String(url);
    if (path.endsWith('/Deudas/30715602691')) {
      currentAttempts += 1;
      if (currentAttempts === 1) return new Response(null, { status: 503 });
      return new Response(JSON.stringify({
        results: {
          denominacion: 'IMOOVE S.R.L.',
          periodos: [{ periodo: '202606', entidades: [{ entidad: 'Banco A', situacion: 1, monto: 11 }] }],
        },
      }), { status: 200 });
    }
    return new Response(null, { status: 404 });
  };

  const result = await new BcraCreditProvider(
    fetcher as typeof fetch,
    'https://test.local',
    [0, 0],
  ).getCreditReport('30715602691');

  assert.equal(currentAttempts, 2);
  assert.equal(result.current[0].debtAmount, 11_000);
  assert.equal(result.denomination, 'IMOOVE S.R.L.');
});

test('conserva el resultado actual si falla temporalmente una consulta secundaria', async () => {
  const fetcher = async (url: string | URL | Request) => {
    const path = String(url);
    if (path.endsWith('/Deudas/30715602691')) {
      return new Response(JSON.stringify({
        results: {
          denominacion: 'IMOOVE S.R.L.',
          periodos: [{ periodo: '202606', entidades: [{ entidad: 'Banco A', situacion: 1, monto: 11 }] }],
        },
      }), { status: 200 });
    }
    if (path.includes('Historicas')) return new Response(null, { status: 503 });
    return new Response(null, { status: 404 });
  };

  const result = await new BcraCreditProvider(
    fetcher as typeof fetch,
    'https://test.local',
    [0],
  ).getCreditReport('30715602691');

  assert.equal(result.current.length, 1);
  assert.equal(result.history.length, 0);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /historial/i);
});

test('devuelve un mensaje claro si la consulta principal sigue indisponible', async () => {
  const fetcher = async () => new Response(null, { status: 503 });
  const provider = new BcraCreditProvider(fetcher as typeof fetch, 'https://test.local', [0]);

  await assert.rejects(
    provider.getCreditReport('30715602691'),
    (error: unknown) => {
      assert.ok(error instanceof CreditProviderError);
      assert.equal(error.retryable, true);
      assert.match(error.message, /temporalmente ocupado/i);
      return true;
    },
  );
});
