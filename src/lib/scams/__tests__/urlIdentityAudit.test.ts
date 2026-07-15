import test from 'node:test';
import assert from 'node:assert/strict';
import { auditUrlIdentity, registrableDomain, summarizePublicUrl } from '../urlIdentityAudit';

test('conserva la entidad real en dominios argentinos con com.ar', () => {
  assert.equal(registrableDomain('www.bancoprovincia.com.ar'), 'bancoprovincia.com.ar');
  assert.equal(registrableDomain('simulador.bna.com.ar'), 'bna.com.ar');
});

test('separa el medio publicitario del dominio realmente analizado', () => {
  const url = 'https://lpa.web-crewsstats.com/oferta?site_domain=taboolanews.com&campaign_id=42&thumbnail=https%3A%2F%2Fcdn.example%2Ffoto.png';
  const audit = auditUrlIdentity(url, url, [url]);
  assert.equal(audit?.requestedDomain, 'web-crewsstats.com');
  assert.equal(audit?.finalDomain, 'web-crewsstats.com');
  assert.deepEqual(audit?.publisherDomains, ['taboolanews.com']);
  assert.deepEqual(audit?.embeddedDestinationDomains, []);
  assert.match(audit?.analysisText || '', /No se consideran el operador financiero ni el destino final/);
  assert.doesNotMatch(audit?.analysisText || '', /campaign_id=|thumbnail=/);
});

test('identifica una redirección efectiva a otro operador y destinos incluidos en parámetros', () => {
  const source = 'https://tracker.example/click?redirect=https%3A%2F%2Foferta.example%2Falta';
  const final = 'https://oferta.example/alta';
  const audit = auditUrlIdentity(source, final, [source, final]);
  assert.equal(audit?.crossDomainRedirect, true);
  assert.equal(audit?.redirectCount, 1);
  assert.deepEqual(audit?.embeddedDestinationDomains, ['oferta.example']);
  assert.match(audit?.analysisText || '', /no coincide con el dominio inicial/);
});

test('resume una URL sin publicar parámetros ni fragmentos', () => {
  const summary = summarizePublicUrl('https://ejemplo.com/oferta?campaign_id=123&token=secreto#paso');
  assert.equal(summary, 'https://ejemplo.com/oferta (parámetros omitidos)');
  assert.doesNotMatch(summary, /campaign_id|token|secreto|paso/);
});
