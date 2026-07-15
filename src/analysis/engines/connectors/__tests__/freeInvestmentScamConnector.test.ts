import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverInvestmentScamEvidence } from '../freeInvestmentScamConnector';

const target = 'https://lpa.web-crewsstats.com/ifwv_v_3_es_lp_wcs/?site=taboolanews.com&campaign_id=48799180&title=La+IA+que+hace+dinero';

test('documents an investment landing domain and CNV checks without calling it a scam', async () => {
  const fetchImpl = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.startsWith('https://rdap.org/domain/')) return new Response(JSON.stringify({
      ldhName: 'WEB-CREWSSTATS.COM', status: ['active'],
      events: [{ eventAction: 'registration', eventDate: '2026-05-01T10:00:00Z' }, { eventAction: 'expiration', eventDate: '2027-05-01T10:00:00Z' }],
      entities: [{ roles: ['registrar'], vcardArray: ['vcard', [['fn', {}, 'text', 'Example Registrar']]] }],
    }), { status: 200 });
    if (url.includes('argentina.gob.ar/cnv/')) return new Response('<html>CNV</html>', { status: 200 });
    return new Response('', { status: 404 });
  };
  const records = await discoverInvestmentScamEvidence(`${target}\nQuiero saber si esa página es real o scam.`, [0], fetchImpl);
  assert.equal(records.length, 3);
  assert.ok(records.some((record) => record.sourceType === 'domain-registration-data'));
  assert.ok(records.some((record) => record.sourceType === 'securities-regulator-cnv' && record.official));
  assert.doesNotMatch(records.map((record) => record.excerpt).join(' '), /es una estafa|es leg[ií]tima/i);
});

test('does not simulate verification when public sources are unavailable', async () => {
  assert.deepEqual(await discoverInvestmentScamEvidence(`${target}\n¿Es scam?`, [0], async () => new Response('', { status: 503 })), []);
});
