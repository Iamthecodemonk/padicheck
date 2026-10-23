import type { AppNotification, NotificationCategory } from '../types/trust';

export const notificationCategoryLabels: Record<NotificationCategory, string> = {
  check: 'Check completed',
  report: 'Report updates',
  dispute: 'Dispute updates',
  verification: 'Business verification',
  subscription: 'Subscription',
  payment: 'Payments',
  security: 'Security',
  score: 'Trust Score changes',
  saved: 'Saved check updates'
};

export const initialNotifications: AppNotification[] = [
{ id: 'n-1', category: 'score', title: 'Score dropped for cheap-iphones-ng.shop', body: 'Now 24 (High Risk), down from 31 after new reports.', at: '2026-10-03T18:06:00', read: false, to: '/report/e-web-cheap-iphones' },
{ id: 'n-2', category: 'report', title: 'Your report is under review', body: 'RP-20418 · A moderator is reviewing your evidence.', at: '2026-10-03T08:30:00', read: false, to: '/my-reports' },
{ id: 'n-3', category: 'security', title: 'New sign-in on Chrome, Windows', body: 'Lagos, Nigeria. If this wasn’t you, secure your account.', at: '2026-10-02T21:14:00', read: false, to: '/account/security' },
{ id: 'n-4', category: 'dispute', title: 'Dispute DS-1042 needs nothing from you', body: 'We’ve asked the reporter to confirm delivery details.', at: '2026-09-30T09:00:00', read: true, to: '/business/reports' },
{ id: 'n-5', category: 'payment', title: 'Payment received', body: 'Plus · monthly — ₦2,500.', at: '2026-09-12T10:01:00', read: true, to: '/account/billing' },
{ id: 'n-6', category: 'saved', title: 'Lekki Prime Homes was re-verified', body: 'Verification renewed until September 2027.', at: '2026-09-14T10:00:00', read: true, to: '/report/e-biz-lekki-prime' }];