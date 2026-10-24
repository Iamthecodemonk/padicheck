import type { Investigation } from '../modules/investigations/types.js';
import type { SpecialistCheck } from '../modules/research/specialist-types.js';
import { specialistConfig } from './specialist-config.js';

const clean = (value: unknown, max = 500): string => typeof value === 'string' ? value.trim().slice(0, max) : '';
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const nameKey = (value: string) => value.normalize('NFKC').toUpperCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const numberKey = (value: string) => value.toUpperCase().replace(/[\s-]/g, '').replace(/^RC/, '');
class ProviderFailure extends Error {}

async function json(url: string, headers: Record<string, string>, transport: typeof fetch): Promise<Record<string, unknown>> {
  let response: Response;
  try { response = await transport(url, { headers, redirect: 'error', signal: AbortSignal.timeout(12000) }); }
  catch { throw new ProviderFailure('provider_unavailable'); }
  if (!response.ok) { await response.body?.cancel(); throw new ProviderFailure('provider_unavailable'); }
  const reader = response.body?.getReader();
  if (!reader) throw new ProviderFailure('invalid_provider_response');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) { const next = await reader.read(); if (next.done) break; size += next.value.length;
      if (size > 256 * 1024) throw new ProviderFailure('invalid_provider_response'); chunks.push(next.value); }
    return record(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  } catch { throw new ProviderFailure('invalid_provider_response'); }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

// Configured only by the operator. No credentials, raw provider responses or
// subscriber identity records are returned to the browser or stored as sources.
export function specialistAdapter(env: NodeJS.ProcessEnv = process.env, transport: typeof fetch = fetch) {
  const config = specialistConfig(env);
  const signature = JSON.stringify(config);
  const make = (kind: SpecialistCheck['kind'], provider: string, source_url: string): SpecialistCheck => ({ kind, provider, source_url,
    status: 'not_configured', checked_at: null, summary: 'This verification service is not configured. Public-source research is separate.', facts: [] });
  async function phone(row: Investigation, authorize: () => Promise<unknown>): Promise<SpecialistCheck> {
    const check = make('phone', 'Twilio Lookup', 'https://www.twilio.com/docs/lookup/quickstart');
    const value = row.input_data.targets?.flatMap(target => target.identifiers ?? []).find(id => id.identifier_type === 'phone')?.value || '';
    if (!/^\+[1-9]\d{7,14}$/.test(value)) return { ...check, status: 'needs_input', summary: 'Enter one phone number in international format.' };
    check.facts = [{ label: 'Input format', value: 'International format accepted; network validity and ownership are not established.' }];
    if (!config.phoneEnabled) return check;
    await authorize();
    const url = new URL('https://lookups.twilio.com/v2/PhoneNumbers/' + encodeURIComponent(value));
    if (config.lineType) url.searchParams.set('Fields', 'line_type_intelligence');
    const data = await json(url.toString(), { Authorization: 'Basic ' + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64') }, transport);
    if (typeof data.valid !== 'boolean' || clean(data.phone_number) !== value) throw new ProviderFailure('invalid_provider_response');
    const line = record(data.line_type_intelligence);
    const facts = [{ label: 'Number', value }, { label: 'Provider validity', value: data.valid ? 'Valid number' : 'Invalid number' }];
    for (const [label, entry] of [['Country', data.country_code], ['Carrier', line.carrier_name], ['Line type', line.type]]) if (clean(entry)) facts.push({ label: String(label), value: clean(entry) });
    return { ...check, status: data.valid ? 'valid_number' : 'invalid_number', checked_at: new Date().toISOString(), facts,
      summary: data.valid ? 'Twilio reports this number as valid. This does not confirm its owner, current activity or trustworthiness.' : 'Twilio reports this number as invalid.' };
  }
  async function business(row: Investigation, authorize: () => Promise<unknown>): Promise<SpecialistCheck> {
    const input = row.input_data.verification ?? {};
    const provider = config.businessProvider === 'dojah' ? 'Dojah CAC lookup' : config.businessProvider === 'opencorporates' ? 'OpenCorporates' : 'Business registry';
    const check = make('business', provider, config.businessProvider === 'opencorporates' ? 'https://opencorporates.com/' : 'https://icrp.cac.gov.ng/public-search/');
    const target = row.input_data.targets?.find(target => target.entity_type === 'business');
    const name = clean(input.business_name || input.employer_name || target?.canonical_name, 200);
    const registration = clean(input.registration_number || target?.identifiers?.find(id => id.identifier_type === 'registration_number')?.value, 80);
    if (!config.businessEnabled) return check;
    if (!name && !registration) return { ...check, status: 'needs_input', summary: 'Provide a legal business name and preferably its registration number.' };
    await authorize();
    if (config.businessProvider === 'dojah') {
      if ((input.country_code || 'NG') !== 'NG' || !/^(?:RC[ -]?)?\d{1,12}$/i.test(registration)) return { ...check, status: 'needs_input', summary: 'This CAC adapter requires a Nigerian RC company number. BN/IT records need a supported provider route or manual registry review.' };
      const url = new URL('https://api.dojah.io/api/v1/kyc/cac');
      url.searchParams.set('rc_number', numberKey(registration));
      if (name) url.searchParams.set('company_name', name);
      const data = await json(url.toString(), { AppId: env.DOJAH_APP_ID!, Authorization: env.DOJAH_SECRET_KEY! }, transport);
      if (data.error) throw new ProviderFailure('provider_unavailable');
      const entity = record(data.entity);
      if (!clean(entity.company_name) || !clean(entity.rc_number)) throw new ProviderFailure('invalid_provider_response');
      const numberMatches = numberKey(clean(entity.rc_number)) === numberKey(registration);
      const nameMatches = !!name && nameKey(name) === nameKey(clean(entity.company_name));
      const facts = [{ label: 'Registry name', value: clean(entity.company_name) }, { label: 'Registration number', value: clean(entity.rc_number) }];
      for (const [label, value] of [['Registered address', entity.address], ['Registration date', entity.date_of_registration]]) if (clean(value)) facts.push({ label: String(label), value: clean(value) });
      return { ...check, checked_at: new Date().toISOString(), facts, status: !numberMatches ? 'record_mismatch' : nameMatches ? 'record_matched' : 'record_found',
        summary: !numberMatches ? 'The provider returned a different registration number. This is not a registry match.' : nameMatches ? 'The supplied name and RC number match the provider record. Registration does not establish trustworthiness or ownership of this website.' : 'A registration record was returned. Compare the legal name with the business you are dealing with.' };
    }
    const jurisdiction = (input.jurisdiction_code || input.country_code?.toLowerCase() || 'ng').toLowerCase();
    if (!/^[a-z]{2}(?:_[a-z0-9]{1,20})?$/.test(jurisdiction)) return { ...check, status: 'needs_input', summary: 'Provide a supported registry jurisdiction.' };
    const url = registration ? new URL(`https://api.opencorporates.com/v0.4/companies/${encodeURIComponent(jurisdiction)}/${encodeURIComponent(registration)}`) : new URL('https://api.opencorporates.com/v0.4/companies/search');
    if (!registration) { url.searchParams.set('q', name); url.searchParams.set('jurisdiction_code', jurisdiction); url.searchParams.set('per_page', '5'); }
    const data = await json(url.toString(), { 'X-API-TOKEN': env.OPENCORPORATES_API_KEY! }, transport);
    const results = record(data.results);
    const candidates = registration ? [record(results.company)] : Array.isArray(results.companies) ? results.companies.slice(0, 5).map(item => record(record(item).company)) : null;
    if (!candidates || candidates.some(candidate => !clean(candidate.name) || !clean(candidate.company_number))) throw new ProviderFailure('invalid_provider_response');
    if (!candidates.length) return { ...check, status: 'not_found', checked_at: new Date().toISOString(), summary: 'No record was returned by this provider. Registry coverage may be incomplete; this does not prove the business is unregistered.' };
    const first = candidates[0]!;
    const numberMatches = registration && clean(first.company_number).toUpperCase() === registration.toUpperCase() && clean(first.jurisdiction_code) === jurisdiction;
    return { ...check, checked_at: new Date().toISOString(), status: !registration ? 'possible_matches' : !numberMatches ? 'record_mismatch' : name && nameKey(name) === nameKey(clean(first.name)) ? 'record_matched' : 'record_found',
      summary: registration ? 'Compare the returned registry name and number with the supplied business. A registration record does not establish trustworthiness.' : 'Possible company records were returned by name. Select and independently confirm the correct legal entity before treating it as a match.',
      facts: candidates.map(candidate => ({ label: 'Registry record', value: `${clean(candidate.name)} — ${clean(candidate.company_number)} (${clean(candidate.jurisdiction_code)})` })) };
  }
  async function property(row: Investigation, authorize: () => Promise<unknown>): Promise<SpecialistCheck> {
    const check = make('property', 'Google Maps Geocoding', 'https://developers.google.com/maps/documentation/geocoding/geocoding');
    if (!config.propertyEnabled) return { ...check, summary: 'Location lookup is not configured. Property ownership and title are not verified.' };
    const address = clean(row.input_data.verification?.address, 500);
    if (!address) return { ...check, status: 'needs_input', summary: 'Provide the property address. Location matching does not verify ownership or title.' };
    await authorize();
    const url = new URL('https://geocode.googleapis.com/v4/geocode/address/' + encodeURIComponent(address));
    if (row.input_data.verification?.country_code) url.searchParams.set('regionCode', row.input_data.verification.country_code);
    const data = await json(url.toString(), { 'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY!,
      'X-Goog-FieldMask': 'results.placeId' }, transport);
    if (!Array.isArray(data.results)) throw new ProviderFailure('invalid_provider_response');
    if (!data.results.length) return { ...check, checked_at: new Date().toISOString(), status: 'not_found', summary: 'No location was returned. This does not determine whether the property exists or who owns it.' };
    const results = data.results.slice(0, 3).map(record);
    if (results.some(item => !clean(item.placeId, 2048))) throw new ProviderFailure('invalid_provider_response');
    return { ...check, status: results.length === 1 ? 'location_found' : 'possible_matches', checked_at: new Date().toISOString(),
      summary: results.length === 1 ? 'A location was returned for this address. Ownership, land title, agent authority and the listing itself remain unverified.' : 'Multiple locations were returned. Confirm the exact address before proceeding; ownership and title remain unverified.',
      // Store only user-supplied address and place IDs, which are exempt from
      // Google's content-caching restrictions. No geocoded address/coordinates.
      source_url: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address) + '&query_place_id=' + encodeURIComponent(clean(results[0]!.placeId, 2048)),
      facts: [{ label: 'Submitted address', value: address }, ...results.map(item => ({ label: 'Google Maps place ID', value: clean(item.placeId, 2048) }))] };
  }
  return { signature, async run(row: Investigation, authorize: () => Promise<unknown>): Promise<SpecialistCheck[]> {
    if (row.investigation_type === 'contract_review') return [];
    const kind = row.input_data.check_context;
    const calls: Array<{ kind: SpecialistCheck['kind']; action: () => Promise<SpecialistCheck> }> = [];
    if (row.investigation_type === 'phone_lookup' || kind === 'phone') calls.push({ kind: 'phone', action: () => phone(row, authorize) });
    if (row.investigation_type === 'company_research' || kind === 'business' || (kind === 'job' || row.investigation_type === 'job_search') && row.input_data.verification?.employer_name) calls.push({ kind: 'business', action: () => business(row, authorize) });
    if (kind === 'property') calls.push({ kind: 'property', action: () => property(row, authorize) });
    const checks: SpecialistCheck[] = [];
    for (const call of calls) {
      // Authorization errors propagate; they must not be hidden as outages.
      await authorize();
      try { checks.push(await call.action()); }
      catch (error) {
        if (!(error instanceof ProviderFailure)) throw error;
        checks.push({ ...make(call.kind, call.kind === 'phone' ? 'Twilio Lookup' : call.kind === 'property' ? 'Google Maps Geocoding' : config.businessProvider === 'dojah' ? 'Dojah CAC lookup' : 'OpenCorporates', call.kind === 'phone' ? 'https://www.twilio.com/docs/lookup/quickstart' : call.kind === 'property' ? 'https://developers.google.com/maps/documentation/geocoding/geocoding' : 'https://icrp.cac.gov.ng/public-search/'), status: 'unavailable', summary: 'The provider could not complete this check. No verification decision was made.' });
      }
    }
    if (kind === 'job' || row.investigation_type === 'job_search') checks.push({ ...make('job', 'Employer corroboration', 'https://consumer.ftc.gov/articles/job-scams'), status: 'needs_input',
      summary: 'A company record or public job listing does not confirm a recruiter or offer. Compare the official careers page and confirm directly with the employer through established contact details.',
      facts: [{ label: 'Employer', value: clean(row.input_data.verification?.employer_name) || 'Not supplied' },
        { label: 'Official website supplied by user', value: clean(row.input_data.verification?.official_website) || 'Not supplied' },
        { label: 'Employer confirmation', value: 'Not independently confirmed' }] });
    return checks;
  } };
}
