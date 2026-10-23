import type { AdminSettings, AuditEntry, Campaign, DataSource, NotificationTemplate } from '../types/admin';

export const initialAudit: AuditEntry[] = [
{ id: 'al-7', actor: 'Tunde Bakare', category: 'credits', action: 'Added 3 credits to Kwame Mensah', detail: 'Refund for failed check', at: '2026-10-03T08:02:00' },
{ id: 'al-6', actor: 'Ngozi Obi', category: 'support', action: 'Replied to T-503', at: '2026-10-02T20:02:00' },
{ id: 'al-5', actor: 'Ngozi Obi', category: 'content', action: 'Saved draft of “How credits work”', at: '2026-10-01T11:00:00' },
{ id: 'al-4', actor: 'Tunde Bakare', category: 'users', action: 'Suspended Chidi Eze', detail: 'Chargeback abuse', at: '2026-09-28T17:10:00' },
{ id: 'al-3', actor: 'System', category: 'platform', action: 'Enabled failover for Google Vision OCR', detail: 'Automatic', at: '2026-09-28T09:44:00' },
{ id: 'al-2', actor: 'Ife Lawal', category: 'pricing', action: 'Changed Standard package price', detail: '₦4,500 → ₦5,000', at: '2026-09-25T12:00:00' },
{ id: 'al-1', actor: 'Tunde Bakare', category: 'team', action: 'Invited Zainab Musa as Content editor', at: '2026-09-24T09:30:00' }];


export const initialDataSources: DataSource[] = [
{ id: 'ds-sec', name: 'SEC Nigeria register', kind: 'Government register', coverage: 'Nigeria', status: 'ok', lastSync: '2026-10-03T07:40:00', records: 4120, frequency: 'Daily' },
{ id: 'ds-cac', name: 'CAC company search', kind: 'Company registry', coverage: 'Nigeria', status: 'ok', lastSync: '2026-10-03T09:00:00', records: 3_200_000, frequency: 'Hourly' },
{ id: 'ds-price', name: 'Marketplace price index', kind: 'Price data', coverage: 'NG, GH, KE', status: 'ok', lastSync: '2026-10-03T06:00:00', records: 1_200_000, frequency: 'Daily' },
{ id: 'ds-rent', name: 'Property rent index', kind: 'Price data', coverage: 'Lagos, Abuja, Accra, Nairobi', status: 'warn', lastSync: '2026-09-30T06:00:00', records: 86_400, frequency: 'Daily' },
{ id: 'ds-jobs', name: 'Verified employers list', kind: 'Employer data', coverage: 'NG, GH', status: 'ok', lastSync: '2026-10-02T22:00:00', records: 18_300, frequency: 'Daily' },
{ id: 'ds-scam', name: 'Scam report feed', kind: 'Community reports', coverage: 'All regions', status: 'off', lastSync: '2026-09-26T10:00:00', records: 52_900, frequency: 'Hourly' }];


export const initialTemplates: NotificationTemplate[] = [
{ id: 'nt-analysis', name: 'Analysis completed', trigger: 'When a check finishes', channels: ['push'], enabled: true, essential: true },
{ id: 'nt-research', name: 'Deep research completed', trigger: 'When long research finishes', channels: ['push', 'email'], enabled: true, essential: true },
{ id: 'nt-payment', name: 'Payment received', trigger: 'After a successful payment', channels: ['push', 'email'], enabled: true, essential: true },
{ id: 'nt-low', name: 'Credits running low', trigger: 'Balance falls below the threshold', channels: ['push'], enabled: true, essential: false },
{ id: 'nt-support', name: 'Support reply', trigger: 'When an agent replies', channels: ['push', 'email'], enabled: true, essential: true },
{ id: 'nt-jobs', name: 'New job matches', trigger: 'Weekly, when new matches appear', channels: ['push'], enabled: true, essential: false },
{ id: 'nt-tips', name: 'Weekly safety tips', trigger: 'Every Monday', channels: ['email'], enabled: false, essential: false }];


export const initialCampaigns: Campaign[] = [
{
  id: 'cp-2',
  title: 'Job & Talent matching is here',
  body: 'Tell PadiCheck what you’re good at and get matched to verified employers — free.',
  audience: 'all',
  channels: ['push'],
  status: 'sent',
  at: '2026-10-01T09:00:00',
  reach: 48210,
  by: 'Amara Nwosu'
},
{
  id: 'cp-1',
  title: 'Fake PS5 sellers on Instagram',
  body: 'We’re seeing a rise in deposit-first PS5 offers. Check the seller before you pay.',
  audience: 'nigeria',
  channels: ['push', 'email'],
  status: 'sent',
  at: '2026-09-22T12:00:00',
  reach: 31840,
  by: 'Tunde Bakare'
}];


export const audienceOptions: {id: Campaign['audience'];label: string;size: number;}[] = [
{ id: 'all', label: 'Everyone', size: 52400 },
{ id: 'lowCredits', label: 'Low on credits', size: 6120 },
{ id: 'inactive', label: 'Inactive 30+ days', size: 9880 },
{ id: 'nigeria', label: 'Nigeria', size: 34100 },
{ id: 'ghana', label: 'Ghana', size: 9800 },
{ id: 'kenya', label: 'Kenya', size: 8500 }];


export const initialSettings: AdminSettings = {
  workspaceName: 'PadiCheck',
  supportEmail: 'help@padicheck.com',
  allowSignups: true,
  signupBonus: 5,
  lowCreditThreshold: 5,
  maintenanceMode: false,
  maintenanceMessage: 'PadiCheck is getting an upgrade. Checks will be back shortly.',
  require2fa: true,
  sessionHours: 12,
  ipAllowlist: '',
  fileRetentionDays: 30
};