import type { Business, Review } from '../types/trust';

/** A business appears in Explore Businesses only with an approved, unexpired listing. */
export function isListed(b: Business, now = Date.now()): boolean {
  const d = b.directory;
  return Boolean(d && d.status === 'active' && (!d.expiresAt || new Date(d.expiresAt).getTime() > now));
}

/** Public profile is available for listed or verification-reviewed businesses. */
export function hasPublicProfile(b: Business): boolean {
  return isListed(b) || b.verification !== 'none' && b.verification !== 'rejected';
}

export function ratingFor(businessId: string, reviews: Review[]) {
  const list = reviews.filter((r) => r.businessId === businessId && r.status === 'published');
  const avg = list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0;
  return { avg, count: list.length };
}

export function slugify(name: string): string {
  return name.
  toLowerCase().
  replace(/&/g, 'and').
  replace(/[^a-z0-9]+/g, '-').
  replace(/^-|-$/g, '').
  slice(0, 48);
}

export const YEAR_MS = 365 * 86_400_000;