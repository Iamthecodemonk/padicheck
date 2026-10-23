import { useTrust } from '../contexts/TrustContext';
import { failedAnalyses } from '../data/adminOps';
import { supportTickets } from '../data/adminSupport';
import type { AdminBadgeKey } from '../data/adminModules';

/** Live queue counts for admin navigation. */
export function useAdminBadges(): Record<AdminBadgeKey, number> {
  const { businesses, reports, disputes, reviews, aiFlags } = useTrust();
  return {
    support: supportTickets.filter((t) => t.status === 'open').length,
    failed: failedAnalyses.length,
    verification: businesses.filter((b) => b.verification === 'review').length,
    directory: businesses.filter((b) => b.directory?.status === 'pending').length,
    reports: reports.filter((r) => r.status === 'pending' || r.status === 'review').length,
    disputes: disputes.filter((d) => d.status === 'open' || d.status === 'review').length,
    reviews: reviews.filter((r) => r.status === 'flagged').length,
    ai: aiFlags.filter((f) => f.status === 'pending').length
  };
}