import assert from 'node:assert/strict';
import { test } from 'node:test';
import { specialistAdapter } from '../src/adapters/specialist.js';
import { specialistConfig } from '../src/adapters/specialist-config.js';
import type { Investigation } from '../src/modules/investigations/types.js';

const phone = '+2348012345678';
const row = (context: 'phone' | 'business' | 'property' | 'job', extra = {}): Investigation => ({ investigation_type: context === 'phone' ? 'phone_lookup' : context === 'business' ? 'company_research' : 'general_research',
  input_data: { check_context: context, verification: { business_name: 'Example Ltd', registration_number: 'RC123456', country_code: 'NG', address: 'Example Street, Lagos', ...extra },
    targets: [{ entity_type: 'other', canonical_name: phone, identifiers: [{ identifier_type: 'phone', value: phone }] }] }, user_prompt: 'Public test' } as Investigation);
const authorized = async () => {};
const twilio = { PHONE_LOOKUP_ENABLED: 'true', TWILIO_ACCOUNT_SID: 'AC' + '1'.repeat(32), TWILIO_AUTH_TOKEN: 'private-test-token' };

test('paid providers default off and never send HTTP requests without activation', async () => {
  const adapter = specialistAdapter({}, async () => { throw new Error('Unexpected paid call'); });
  for (const context of ['phone', 'business', 'property'] as const) {
    const checks = await adapter.run(row(context), authorized);
    assert.equal(checks[0]!.status, 'not_configured');
    assert.equal(checks[0]!.checked_at, null);
  }
  assert.throws(() => specialistConfig({ PHONE_LOOKUP_ENABLED: 'true' }), /requires/);
  assert.throws(() => specialistConfig({ BUSINESS_LOOKUP_ENABLED: 'true' }), /requires/);
  assert.throws(() => specialistConfig({ PROPERTY_LOCATION_ENABLED: 'true' }), /requires/);
  assert.throws(() => specialistConfig({ PHONE_LOOKUP_ENABLED: 'yes' }), /true or false/);
});

test('Twilio basic lookup uses header credentials, excludes premium fields and minimizes results', async () => {
  const adapter = specialistAdapter(twilio, async (input, options) => {
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://lookups.twilio.com');
    assert.equal(url.searchParams.has('Fields'), false);
    assert.ok(!url.toString().includes('private-test-token'));
    assert.equal(options?.redirect, 'error');
    assert.match((options?.headers as Record<string, string>).Authorization!, /^Basic /);
    return Response.json({ valid: true, phone_number: phone, country_code: 'NG', caller_name: 'DO_NOT_DISCLOSE', identity_match: { name: 'DO_NOT_DISCLOSE' } });
  });
  const check = (await adapter.run(row('phone'), authorized))[0]!;
  assert.equal(check.status, 'valid_number');
  assert.match(check.summary, /does not confirm/);
  assert.ok(!JSON.stringify(check).includes('DO_NOT_DISCLOSE'));
});

test('premium line intelligence requires an explicit flag; mismatched numbers fail closed', async () => {
  const adapter = specialistAdapter({ ...twilio, TWILIO_LOOKUP_LINE_TYPE_ENABLED: 'true' }, async input => {
    assert.equal(new URL(String(input)).searchParams.get('Fields'), 'line_type_intelligence');
    return Response.json({ valid: true, phone_number: phone, country_code: 'NG', line_type_intelligence: { carrier_name: 'Test carrier', type: 'mobile' } });
  });
  assert.ok((await adapter.run(row('phone'), authorized))[0]!.facts.some(fact => fact.label === 'Carrier'));
  const mismatch = specialistAdapter(twilio, async () => Response.json({ valid: true, phone_number: '+2348099999999' }));
  assert.equal((await mismatch.run(row('phone'), authorized))[0]!.status, 'unavailable');
});

test('Dojah matches only returned RC identity fields and never exposes directors or raw errors', async () => {
  const env = { BUSINESS_LOOKUP_ENABLED: 'true', BUSINESS_LOOKUP_PROVIDER: 'dojah', DOJAH_APP_ID: 'test-app', DOJAH_SECRET_KEY: 'private-cac-key' };
  let returnedNumber = 'RC123456'; let count = 0;
  const adapter = specialistAdapter(env, async (input, options) => {
    count++; const url = new URL(String(input)); assert.equal(url.pathname, '/api/v1/kyc/cac');
    assert.equal(url.searchParams.get('rc_number'), '123456');
    assert.equal((options?.headers as Record<string, string>).AppId, 'test-app');
    assert.ok(!url.toString().includes('private-cac-key'));
    return Response.json({ entity: { rc_number: returnedNumber, company_name: 'Example Ltd', address: 'Lagos', directors: [{ name: 'DO_NOT_DISCLOSE' }] } });
  });
  const check = (await adapter.run(row('business'), authorized))[0]!;
  assert.equal(check.status, 'record_matched'); assert.ok(!JSON.stringify(check).includes('DO_NOT_DISCLOSE'));
  returnedNumber = 'RC987654'; assert.equal((await adapter.run(row('business'), authorized))[0]!.status, 'record_mismatch');
  const before = count;
  assert.equal((await adapter.run(row('business', { registration_number: 'BN123456' }), authorized))[0]!.status, 'needs_input');
  assert.equal(count, before);
});

test('OpenCorporates name search remains a possible match and missing coverage is explicit', async () => {
  const env = { BUSINESS_LOOKUP_ENABLED: 'true', BUSINESS_LOOKUP_PROVIDER: 'opencorporates', OPENCORPORATES_API_KEY: 'private-oc-key' };
  let companies: unknown[] = [{ company: { name: 'Example Ltd', company_number: '123456', jurisdiction_code: 'ng' } }];
  const adapter = specialistAdapter(env, async (input, options) => {
    assert.equal(new URL(String(input)).pathname, '/v0.4/companies/search');
    assert.equal((options?.headers as Record<string, string>)['X-API-TOKEN'], 'private-oc-key');
    assert.ok(!String(input).includes('private-oc-key'));
    return Response.json({ results: { companies } });
  });
  assert.equal((await adapter.run(row('business', { registration_number: '' }), authorized))[0]!.status, 'possible_matches');
  companies = [];
  const missing = (await adapter.run(row('business', { registration_number: '' }), authorized))[0]!;
  assert.equal(missing.status, 'not_found'); assert.match(missing.summary, /does not prove/);
});

test('property matching uses Maps header credentials and never certifies title', async () => {
  const adapter = specialistAdapter({ PROPERTY_LOCATION_ENABLED: 'true', GOOGLE_MAPS_API_KEY: 'private-maps-key' }, async (input, options) => {
    assert.equal(new URL(String(input)).hostname, 'geocode.googleapis.com');
    assert.equal((options?.headers as Record<string, string>)['X-Goog-Api-Key'], 'private-maps-key');
    assert.ok(!String(input).includes('private-maps-key'));
    assert.equal((options?.headers as Record<string, string>)['X-Goog-FieldMask'], 'results.placeId');
    return Response.json({ results: [{ placeId: 'ChIJTest', formattedAddress: 'DO_NOT_CACHE_GOOGLE_ADDRESS', location: { latitude: 6.5, longitude: 3.3 } }] });
  });
  const check = (await adapter.run(row('property'), authorized))[0]!;
  assert.equal(check.status, 'location_found'); assert.match(check.summary, /title.*remain unverified/);
  assert.ok(!JSON.stringify(check).includes('DO_NOT_CACHE_GOOGLE_ADDRESS'));
  assert.match(check.source_url, /query_place_id=ChIJTest/);
});

test('authorization failures propagate and contracts never enter external identity checks', async () => {
  let calls = 0;
  const adapter = specialistAdapter(twilio, async () => { calls++; return Response.json({}); });
  await assert.rejects(adapter.run(row('phone'), async () => { throw new Error('permission revoked'); }), /permission revoked/);
  assert.equal(calls, 0);
  assert.deepEqual(await adapter.run({ ...row('phone'), investigation_type: 'contract_review' }, authorized), []);
  assert.equal(calls, 0);
  const outage = specialistAdapter(twilio, async () => new Response('SECRET_PROVIDER_ERROR', { status: 503 }));
  const result = await outage.run(row('phone'), authorized);
  assert.equal(result[0]!.status, 'unavailable'); assert.ok(!JSON.stringify(result).includes('SECRET_PROVIDER_ERROR'));
});
