import { ApiError } from '../../errors.js';
import { entityTypes, identifierTypes, investigationTypes, type CreateInvestigation, type IdentifierInput } from './types.js';

export const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const createSchema = { type: 'object', additionalProperties: false,
  required: ['investigation_type', 'user_prompt'], properties: {
    expected_credit_cost: {type:'integer',minimum:0,maximum:100000},
    investigation_type: { type: 'string', enum: investigationTypes },
    title: { type: 'string', minLength: 1, maxLength: 200 },
    user_prompt: { type: 'string', minLength: 1, maxLength: 10000 },
    input_data: { type: 'object', additionalProperties: false, properties: {
      check_context: { type: 'string', enum: ['business', 'phone', 'property', 'job', 'shopping', 'freelance', 'person', 'social', 'listing'] },
      verification: { type: 'object', additionalProperties: false, properties: {
        business_name: { type: 'string', minLength: 1, maxLength: 200 },
        employer_name: { type: 'string', minLength: 1, maxLength: 200 },
        registration_number: { type: 'string', minLength: 1, maxLength: 80 },
        country_code: { type: 'string', pattern: '^[A-Z]{2}$' },
        jurisdiction_code: { type: 'string', pattern: '^[a-z]{2}(_[a-z0-9]{1,20})?$' },
        address: { type: 'string', minLength: 1, maxLength: 500 },
        official_website: { type: 'string', minLength: 1, maxLength: 2048 },
      } },
      urls: { type: 'array', maxItems: 10, items: { type: 'string', maxLength: 2048 } },
      media_ids: { type: 'array', maxItems: 10, uniqueItems: true, items: { type: 'string', format: 'uuid' } },
      targets: { type: 'array', maxItems: 10, items: { type: 'object', additionalProperties: false,
        required: ['entity_type', 'canonical_name'], properties: {
          entity_type: { type: 'string', enum: entityTypes },
          canonical_name: { type: 'string', minLength: 1, maxLength: 200 },
          target_role: { type: 'string', enum: ['primary', 'candidate', 'comparison'] },
          identifiers: { type: 'array', maxItems: 10, items: { type: 'object', additionalProperties: false,
            required: ['identifier_type', 'value'], properties: {
              identifier_type: { type: 'string', enum: identifierTypes },
              value: { type: 'string', minLength: 1, maxLength: 2048 },
            } } },
        } } },
    } },
  } };

export function normalizeUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname || value.length > 2048) throw new Error();
    url.hash = '';
    return url.toString();
  } catch { throw new ApiError(400, 'invalid_url', 'Supply an HTTP or HTTPS URL without embedded credentials'); }
}

export function normalizeIdentifier(identifier: IdentifierInput): string {
  const value = identifier.value.trim();
  if (!value) throw new ApiError(400, 'invalid_identifier', 'Identifier must not be blank');
  switch (identifier.identifier_type) {
    case 'phone': {
      const phone = value.replace(/[\s().-]/g, '');
      if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new ApiError(400, 'invalid_phone', 'Phone numbers require an international country code');
      return phone;
    }
    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new ApiError(400, 'invalid_email', 'Identifier email is invalid');
      return value.toLowerCase();
    case 'url': case 'social_profile': return normalizeUrl(value);
    case 'domain': {
      if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value)) throw new ApiError(400, 'invalid_domain', 'Supply a domain name without a scheme or path');
      return value.toLowerCase();
    }
    default: return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ');
  }
}

export function normalizeCreate(body: CreateInvestigation): CreateInvestigation & { input_data: NonNullable<CreateInvestigation['input_data']> & Required<Pick<NonNullable<CreateInvestigation['input_data']>, 'urls' | 'media_ids' | 'targets'>> } {
  const prompt = body.user_prompt.trim();
  if (!prompt || (body.title !== undefined && !body.title.trim())) throw new ApiError(400, 'invalid_investigation', 'Title and prompt must not be blank');
  const input = { ...(body.input_data ?? {}) };
  const contextType = { phone: 'phone_lookup', business: 'company_research', job: 'job_search' } as const;
  if (input.check_context && input.check_context in contextType && contextType[input.check_context as keyof typeof contextType] !== body.investigation_type ||
      input.check_context && ['property','shopping','freelance','person','social','listing'].includes(input.check_context) && !['general_research','web_analysis'].includes(body.investigation_type)) {
    throw new ApiError(400, 'invalid_check_context', 'Check context must match the investigation type');
  }
  if (input.verification?.official_website) input.verification = { ...input.verification, official_website: normalizeUrl(input.verification.official_website) };
  const urls = [...new Set((input.urls ?? []).map(normalizeUrl))];
  const mediaIds = [...new Set((input.media_ids ?? []).map(id => id.toLowerCase()))];
  const targets = (input.targets ?? []).map(target => {
    if (!target.canonical_name.trim()) throw new ApiError(400, 'invalid_target', 'Target name must not be blank');
    const seen = new Set<string>();
    const identifiers = (target.identifiers ?? []).filter(identifier => {
      const key = `${identifier.identifier_type}:${normalizeIdentifier(identifier)}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).map(identifier => ({ ...identifier, value: identifier.value.trim() }));
    return { ...target, canonical_name: target.canonical_name.trim(), identifiers };
  });
  if (body.investigation_type === 'contract_review' && !mediaIds.length) throw new ApiError(400, 'document_required', 'Contract reviews require an uploaded document');
  if (body.investigation_type === 'web_analysis' && !urls.length) throw new ApiError(400, 'url_required', 'Website analysis requires a URL');
  if (body.investigation_type === 'phone_lookup' && !targets.some(target => target.identifiers.some(identifier => identifier.identifier_type === 'phone'))) {
    throw new ApiError(400, 'phone_required', 'Phone lookup requires a target with a phone identifier');
  }
  return { ...body, title: body.title?.trim(), user_prompt: prompt,
    input_data: { urls, media_ids: mediaIds, targets, ...(input.check_context ? { check_context: input.check_context } : {}), ...(input.verification ? { verification: input.verification } : {}) } };
}
