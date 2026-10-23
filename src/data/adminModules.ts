import {
  ActivityIcon,
  BellIcon,
  BotIcon,
  BrainCircuitIcon,
  Building2Icon,
  ClipboardListIcon,
  CodeIcon,
  CoinsIcon,
  CpuIcon,
  CreditCardIcon,
  DatabaseIcon,
  FlagIcon,
  GaugeIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  NewspaperIcon,
  ScaleIcon,
  SettingsIcon,
  ShieldCheckIcon,
  StarIcon,
  StoreIcon,
  TrendingUpIcon,
  UsersIcon,
  type LucideIcon } from
'lucide-react';

export type AdminBadgeKey = 'support' | 'failed' | 'verification' | 'directory' | 'reports' | 'disputes' | 'reviews' | 'ai';

export interface AdminNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badgeKey?: AdminBadgeKey;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const adminNavGroups: AdminNavGroup[] = [
{
  label: 'Overview',
  items: [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboardIcon, end: true },
  { to: '/admin/analytics', label: 'Analytics', icon: TrendingUpIcon }]

},
{
  label: 'Trust & Safety',
  items: [
  { to: '/admin/businesses', label: 'Businesses', icon: Building2Icon, badgeKey: 'verification' },
  { to: '/admin/directory', label: 'Directory', icon: StoreIcon, badgeKey: 'directory' },
  { to: '/admin/reports', label: 'Reports', icon: FlagIcon, badgeKey: 'reports' },
  { to: '/admin/disputes', label: 'Disputes', icon: ScaleIcon, badgeKey: 'disputes' },
  { to: '/admin/reviews', label: 'Reviews', icon: StarIcon, badgeKey: 'reviews' },
  { to: '/admin/trust-scores', label: 'Trust Scores', icon: GaugeIcon },
  { to: '/admin/ai-analysis', label: 'AI Analysis', icon: BrainCircuitIcon, badgeKey: 'ai' }]

},
{
  label: 'People',
  items: [
  { to: '/admin/users', label: 'Users', icon: UsersIcon },
  { to: '/admin/support', label: 'Support', icon: LifeBuoyIcon, badgeKey: 'support' }]

},
{
  label: 'Money',
  items: [
  { to: '/admin/credits', label: 'Credits', icon: CoinsIcon },
  { to: '/admin/payments', label: 'Payments', icon: CreditCardIcon }]

},
{
  label: 'Platform',
  items: [
  { to: '/admin/api', label: 'API', icon: CodeIcon },
  { to: '/admin/analyzers', label: 'Analyzers', icon: BotIcon, badgeKey: 'failed' },
  { to: '/admin/providers', label: 'AI Providers', icon: CpuIcon },
  { to: '/admin/data-sources', label: 'Data Sources', icon: DatabaseIcon },
  { to: '/admin/health', label: 'System Health', icon: ActivityIcon }]

},
{
  label: 'Content',
  items: [
  { to: '/admin/cms', label: 'CMS & Policies', icon: NewspaperIcon },
  { to: '/admin/notifications', label: 'Notifications', icon: BellIcon }]

},
{
  label: 'Governance',
  items: [
  { to: '/admin/team', label: 'Team & Roles', icon: ShieldCheckIcon },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: ClipboardListIcon },
  { to: '/admin/settings', label: 'Settings', icon: SettingsIcon }]

}];