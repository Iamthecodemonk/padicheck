import type { AdminRoleDef, PermissionKey, TeamMember } from '../types/admin';

export interface PermissionMeta {
  key: PermissionKey;
  label: string;
  hint: string;
  group: 'People' | 'Trust' | 'Money' | 'Platform' | 'Content' | 'Governance';
}

export const permissionCatalog: PermissionMeta[] = [
{ key: 'viewAnalytics', label: 'View analytics', hint: 'Dashboards and reports', group: 'People' },
{ key: 'manageUsers', label: 'Manage users', hint: 'Suspend accounts, revoke sessions', group: 'People' },
{ key: 'replySupport', label: 'Reply to support', hint: 'Answer and close tickets', group: 'People' },
{ key: 'verifyBusinesses', label: 'Verify businesses', hint: 'Approve, reject, suspend verification', group: 'Trust' },
{ key: 'moderateReports', label: 'Moderate reports', hint: 'Approve, reject and escalate user reports', group: 'Trust' },
{ key: 'manageDisputes', label: 'Decide disputes', hint: 'Uphold, correct or remove disputed information', group: 'Trust' },
{ key: 'moderateReviews', label: 'Moderate reviews', hint: 'Keep or remove reported reviews', group: 'Trust' },
{ key: 'manageScoring', label: 'Manage Trust Score', hint: 'Bands, weights and rules', group: 'Trust' },
{ key: 'reviewAi', label: 'Review AI flags', hint: 'Confirm or override AI risk signals', group: 'Trust' },
{ key: 'manageApi', label: 'Manage API customers', hint: 'Revoke keys, review usage', group: 'Platform' },
{ key: 'adjustCredits', label: 'Adjust credits', hint: 'Add or remove user credits', group: 'Money' },
{ key: 'refund', label: 'Issue refunds', hint: 'Refund failed checks', group: 'Money' },
{ key: 'managePricing', label: 'Manage credit packages', hint: 'Create, edit and retire packages', group: 'Money' },
{ key: 'manageProviders', label: 'Manage AI & analyzers', hint: 'Routing, failover, pausing analyzers', group: 'Platform' },
{ key: 'manageDataSources', label: 'Manage data sources', hint: 'Sync, pause and add sources', group: 'Platform' },
{ key: 'manageContent', label: 'Edit content & policies', hint: 'Terms, policies, help and app copy', group: 'Content' },
{ key: 'sendNotifications', label: 'Send notifications', hint: 'Campaigns and templates', group: 'Content' },
{ key: 'viewAuditLogs', label: 'View audit logs', hint: 'See every admin action', group: 'Governance' },
{ key: 'manageAdmins', label: 'Manage admins & roles', hint: 'Invite admins, edit roles', group: 'Governance' },
{ key: 'manageSettings', label: 'Change settings', hint: 'Security and workspace settings', group: 'Governance' }];


export const allPermissions = permissionCatalog.map((p) => p.key);

export const initialRoles: AdminRoleDef[] = [
{ id: 'superAdmin', name: 'Super admin', description: 'Full access to everything', permissions: allPermissions, builtIn: true },
{
  id: 'support',
  name: 'Support agent',
  description: 'Helps users and manages accounts',
  permissions: ['viewAnalytics', 'manageUsers', 'replySupport', 'viewAuditLogs', 'moderateReports', 'moderateReviews'],
  builtIn: true
},
{
  id: 'verification-officer',
  name: 'Verification officer',
  description: 'Reviews business documents and decides disputes',
  permissions: ['verifyBusinesses', 'manageDisputes', 'moderateReports', 'reviewAi', 'viewAuditLogs'],
  builtIn: false
},
{
  id: 'finance',
  name: 'Finance',
  description: 'Payments, credits and pricing',
  permissions: ['viewAnalytics', 'adjustCredits', 'refund', 'managePricing', 'viewAuditLogs'],
  builtIn: true
},
{
  id: 'content-editor',
  name: 'Content editor',
  description: 'Keeps copy, policies and messages up to date',
  permissions: ['manageContent', 'sendNotifications', 'viewAnalytics'],
  builtIn: false
}];


export const initialTeam: TeamMember[] = [
{ id: 'a-1', name: 'Tunde Bakare', email: 'tunde@padicheck.com', roleId: 'superAdmin', status: 'active', lastActive: '2026-10-03T09:40:00', twoFactor: true },
{ id: 'a-2', name: 'Amara Nwosu', email: 'amara@padicheck.com', roleId: 'superAdmin', status: 'active', lastActive: '2026-10-02T17:10:00', twoFactor: true },
{ id: 'a-3', name: 'Ngozi Obi', email: 'ngozi@padicheck.com', roleId: 'support', status: 'active', lastActive: '2026-10-03T08:55:00', twoFactor: true },
{ id: 'a-4', name: 'Kofi Asante', email: 'kofi@padicheck.com', roleId: 'support', status: 'active', lastActive: '2026-10-01T12:30:00', twoFactor: true },
{ id: 'a-5', name: 'Ife Lawal', email: 'ife@padicheck.com', roleId: 'finance', status: 'active', lastActive: '2026-10-02T10:05:00', twoFactor: true },
{ id: 'a-6', name: 'Zainab Musa', email: 'zainab@padicheck.com', roleId: 'content-editor', status: 'invited', twoFactor: false }];