/**
 * Trust API client (mock). Every screen goes through these functions so the mock can be
 * swapped for real `fetch` calls to the PadiCheck API without touching UI components.
 */
import { entityTypeById } from '../data/entityTypes';
import type { Business, EntityType, TrustEntity } from '../types/trust';

export type ApiErrorCode = 'network' | 'rate_limited' | 'unavailable' | 'unauthorized' | 'forbidden';

export class ApiError extends Error {
  constructor(public code: ApiErrorCode, message: string, public retryAfter?: number) {
    super(message);
  }
}

const RATE_LIMIT = 6;
const WINDOW_MS = 60_000;
const recentCalls: number[] = [];

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

function guard() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new ApiError('network', 'You’re offline. Checks need a connection.');
  const now = Date.now();
  while (recentCalls.length && now - recentCalls[0] > WINDOW_MS) recentCalls.shift();
  if (recentCalls.length >= RATE_LIMIT) {
    throw new ApiError('rate_limited', 'You’ve run a lot of checks in a short time.', Math.ceil((WINDOW_MS - (now - recentCalls[0])) / 1000));
  }
  recentCalls.push(now);
}

const digits = (s: string) => s.replace(/\D/g, '');
const norm = (s: string) => s.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');

export function validateCheckInput(type: EntityType, raw: string): string | null {
  const input = raw.trim();
  if (!input) return 'Enter something to check';
  switch (type) {
    case 'phone':{
        const d = digits(input);
        return d.length < 10 || d.length > 14 ? 'Enter a full phone number, including the network prefix' : null;
      }
    case 'website':
    case 'listing':
      return /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(input) ? null : 'Enter a valid web address, like example.com';
    case 'social':
      return /^@?[\w.]{2,30}$/.test(input) || /^(https?:\/\/)?[\w-]+(\.[\w-]+)+\/\S+/.test(input) ? null : 'Enter an @username or a profile link';
    case 'person':
      return input.split(/\s+/).filter(Boolean).length < 2 ? 'Enter a full name, ideally with a phone number or email' : null;
    default:
      return input.length < 3 ? 'Enter at least 3 characters' : null;
  }
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = h * 31 + s.charCodeAt(i) | 0;
  return Math.abs(h);
}

function displayName(type: EntityType, input: string) {
  if (type === 'phone') {
    const d = digits(input);
    const local = d.startsWith('234') ? d.slice(3) : d.replace(/^0/, '');
    return `+234 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`.trim();
  }
  if (type === 'website' || type === 'listing') return norm(input);
  if (type === 'social') return input.startsWith('@') ? input : `@${norm(input).split('/').pop()}`;
  return input.trim();
}

/** A first-time check with little data: honest, low-confidence result. */
function synthesize(type: EntityType, input: string): TrustEntity {
  const h = hash(norm(input) + type);
  const score = 45 + h % 40;
  const meta = entityTypeById(type);
  return {
    id: `e-${type}-${h.toString(36)}`,
    type,
    name: displayName(type, input),
    identifier: norm(input),
    subtitle: `${meta?.label ?? 'Entity'} · first time checked on PadiCheck`,
    score,
    confidence: 'Low',
    verification: 'unverified',
    lastChecked: new Date().toISOString(),
    facts: [
    { label: 'Previous PadiCheck checks', value: 'None — this is the first', source: 'verified' },
    { label: 'Public footprint', value: h % 2 ? 'Some public mentions found' : 'Very little public information', source: 'public' }],

    signals: [
    { source: 'reports', positive: true, text: 'No user reports found' },
    { source: 'ai', positive: h % 3 !== 0, text: h % 3 === 0 ? 'Some wording matches common scam scripts' : 'No common scam patterns detected' },
    { source: 'warning', positive: false, text: 'Limited history — treat this score as provisional' }],

    factors: [
    { key: 'identity', score: score - 5, note: '' },
    { key: 'reports', score: 85, note: '' },
    { key: 'history', score: 30 + h % 30, note: '' },
    { key: 'ai', score: 50 + h % 35, note: '' }],

    unresolvedReports: 0,
    totalReports: 0,
    recommendation:
    score >= 75 ? 'Proceed with normal precautions.' : 'Proceed with caution. Ask for more proof of identity and avoid paying upfront.'
  };
}

export function entityFromBusiness(b: Business): TrustEntity {
  const verified = b.verification === 'verified';
  return {
    id: b.entityId ?? `e-biz-${b.slug}`,
    type: 'business',
    name: b.name,
    identifier: b.regNumber,
    subtitle: `${b.category} · ${b.location}`,
    score: b.score,
    confidence: verified ? 'High' : 'Medium',
    verification: verified ? 'verified' : b.verification === 'suspended' ? 'unverified' : 'partial',
    lastChecked: b.lastVerifiedAt ?? new Date().toISOString(),
    facts: [
    { label: 'Registration', value: b.regNumber, source: verified ? 'verified' : 'public' },
    { label: 'Website', value: b.website, source: 'public' },
    { label: 'Phone', value: b.phone, source: 'public' },
    { label: 'Location', value: b.location, source: 'public' },
    { label: 'PadiCheck verification', value: verified ? `${b.tier} since ${new Date(b.verifiedAt ?? '').getFullYear()}` : 'Not verified', source: 'verified' }],

    signals: [
    verified ?
    { source: 'verified', positive: true, text: 'Verified by PadiCheck — documents reviewed' } :
    { source: 'warning', positive: false, text: 'This business has not completed PadiCheck verification' },
    { source: 'reports', positive: false, text: 'Has an open report under review' }],

    factors: [
    { key: 'identity', score: b.score + 4, note: '' },
    { key: 'business', score: verified ? 92 : 60, note: '' },
    { key: 'reports', score: 62, note: '' },
    { key: 'reviews', score: 74, note: '' }],

    unresolvedReports: 1,
    totalReports: 1,
    recommendation: verified ? 'Generally trusted.' : 'Proceed with caution until the business is verified.',
    businessSlug: b.slug
  };
}

export async function runTrustCheck(type: EntityType, input: string, known: TrustEntity[]): Promise<TrustEntity | null> {
  guard();
  await wait(2600);
  const n = norm(input);
  const d = digits(input);
  if (/^(0+|unknown|test-none)$/.test(n) || type === 'phone' && /^0{6,}/.test(d)) return null;
  const match = known.find(
    (e) =>
    e.type === type && (
    norm(e.identifier) === n || norm(e.name) === n || d.length >= 10 && digits(e.identifier).endsWith(d.slice(-10)) || norm(e.name).includes(n))
  );
  return match ? { ...match, lastChecked: new Date().toISOString() } : synthesize(type, input);
}

export async function refreshEntity(entity: TrustEntity): Promise<TrustEntity> {
  guard();
  await wait(1200);
  return { ...entity, previousScore: entity.score, lastChecked: new Date().toISOString() };
}

/** Generic mutation call used by forms (reports, disputes, reviews, payments). */
export async function submit<T>(payload: T, ms = 900): Promise<T> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new ApiError('network', 'You’re offline. Try again when you’re connected.');
  await wait(ms);
  return payload;
}