import type { CheckType } from './check';

export type AdminRole = 'superAdmin' | 'support' | 'finance';

export interface AdminSession {
  name: string;
  email: string;
  role: AdminRole;
}

export interface AdminUserSession {
  id: string;
  device: string;
  lastSeen: string;
  current?: boolean;
}

export interface AdminUserActivity {
  title: string;
  type: Exclude<CheckType, 'any'>;
  at: string;
  status: 'completed' | 'failed';
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  country: string;
  credits: number;
  status: 'active' | 'suspended';
  joined: string;
  lastActive: string;
  checks: number;
  spentNaira: number;
  sessions: AdminUserSession[];
  activity: AdminUserActivity[];
}

export interface Payment {
  id: string;
  user: string;
  userId: string;
  amountNaira: number;
  credits: number;
  method: 'Card' | 'Bank transfer' | 'USSD';
  status: 'succeeded' | 'failed' | 'pending';
  at: string;
}

export interface FailedAnalysis {
  id: string;
  user: string;
  userId: string;
  type: Exclude<CheckType, 'any'>;
  input: string;
  reason: string;
  provider: string;
  creditsHeld: number;
  at: string;
}

export interface Analyzer {
  id: string;
  name: string;
  successRate: number;
  runs24h: number;
  enabled: boolean;
}

export type ProviderStatus = 'operational' | 'degraded' | 'down';

export interface AiProvider {
  id: string;
  name: string;
  role: string;
  status: ProviderStatus;
  latencyMs: number;
  errorRate: number;
  requests24h: number;
  fallback: string;
  routing: boolean;
}

export interface ServiceHealth {
  id: string;
  name: string;
  status: ProviderStatus;
  uptime: string;
  detail: string;
}

export interface TicketMessage {
  from: 'user' | 'agent';
  author: string;
  text: string;
  at: string;
}

export interface SupportTicket {
  id: string;
  user: string;
  userId: string;
  subject: string;
  status: 'open' | 'waiting' | 'resolved';
  priority: 'high' | 'normal';
  at: string;
  messages: TicketMessage[];
}

export type PermissionKey =
'viewAnalytics' |
'manageUsers' |
'adjustCredits' |
'refund' |
'managePricing' |
'manageProviders' |
'manageDataSources' |
'replySupport' |
'manageContent' |
'sendNotifications' |
'viewAuditLogs' |
'manageAdmins' |
'manageSettings' |
'verifyBusinesses' |
'moderateReports' |
'manageDisputes' |
'moderateReviews' |
'manageScoring' |
'reviewAi' |
'manageApi';

export type Permissions = Record<PermissionKey, boolean>;

export interface AdminRoleDef {
  id: string;
  name: string;
  description: string;
  permissions: PermissionKey[];
  builtIn: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  roleId: string;
  status: 'active' | 'invited' | 'deactivated';
  lastActive?: string;
  twoFactor: boolean;
}

export type AuditCategory = 'users' | 'credits' | 'pricing' | 'content' | 'team' | 'settings' | 'notifications' | 'platform' | 'support' | 'trust';

export interface AuditEntry {
  id: string;
  actor: string;
  category: AuditCategory;
  action: string;
  detail?: string;
  at: string;
}

export interface DataSource {
  id: string;
  name: string;
  kind: string;
  coverage: string;
  status: 'ok' | 'warn' | 'off';
  lastSync: string;
  records: number;
  frequency: 'Hourly' | 'Daily' | 'Weekly';
}

export type NotificationChannel = 'push' | 'email';

export interface NotificationTemplate {
  id: string;
  name: string;
  trigger: string;
  channels: NotificationChannel[];
  enabled: boolean;
  essential: boolean;
}

export interface Campaign {
  id: string;
  title: string;
  body: string;
  audience: 'all' | 'lowCredits' | 'inactive' | 'nigeria' | 'ghana' | 'kenya';
  channels: NotificationChannel[];
  status: 'sent' | 'scheduled';
  at: string;
  reach: number;
  by: string;
}

export interface AdminSettings {
  workspaceName: string;
  supportEmail: string;
  allowSignups: boolean;
  signupBonus: number;
  lowCreditThreshold: number;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  require2fa: boolean;
  sessionHours: number;
  ipAllowlist: string;
  fileRetentionDays: number;
}