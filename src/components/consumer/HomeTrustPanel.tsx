import React from 'react';
import { Link } from 'react-router-dom';
import { BellIcon, Building2Icon, ChevronRightIcon, CodeIcon, FlagIcon, SparklesIcon, StoreIcon } from 'lucide-react';
import { useTrust } from '../../contexts/TrustContext';
import { verificationStatusMeta } from '../../data/businessPortal';
import { planById } from '../../data/plans';

/** Account at a glance on Home: plan, alerts, reports and workspace shortcuts — so mobile users reach everything. */
export function HomeTrustPanel() {
  const { subscription, unreadCount, reports, myBusiness, notifications } = useTrust();
  const plan = planById(subscription.planId);
  const openReports = reports.filter((r) => r.reporter === 'Adaeze Okafor' && r.status !== 'resolved' && r.status !== 'rejected').length;
  const biz = verificationStatusMeta[myBusiness.verification];
  const latest = notifications.find((n) => !n.read);

  const rows = [
  { to: '/notifications', icon: BellIcon, label: 'Alerts', value: unreadCount ? `${unreadCount} unread` : 'All caught up', tone: unreadCount ? 'text-danger' : 'text-muted' },
  { to: '/my-reports', icon: FlagIcon, label: 'My reports', value: openReports ? `${openReports} in progress` : 'None open', tone: 'text-muted' },
  { to: '/account/billing', icon: SparklesIcon, label: 'Plan', value: `${plan?.name ?? 'Free'}${subscription.status === 'cancelled' ? ' · ends soon' : ''}`, tone: 'text-muted' },
  { to: '/directory', icon: StoreIcon, label: 'Explore businesses', value: 'By category', tone: 'text-muted' },
  { to: '/business', icon: Building2Icon, label: 'Business', value: biz.label.replace('PadiCheck ', ''), tone: biz.text },
  {
    to: '/business/listing',
    icon: StoreIcon,
    label: 'Directory listing',
    value: myBusiness.directory ? ({ pending: 'Awaiting approval', active: 'Live', rejected: 'Not approved', expired: 'Expired', suspended: 'Suspended' } as const)[myBusiness.directory.status] : '₦6,000 / year',
    tone: myBusiness.directory?.status === 'active' ? 'text-brand-dark' : 'text-muted'
  },
  { to: '/developers', icon: CodeIcon, label: 'Developers', value: 'API & keys', tone: 'text-muted' }];


  return (
    <section aria-labelledby="glance-heading">
      <h2 id="glance-heading" className="font-semibold text-ink">
        Your PadiCheck
      </h2>
      {latest &&
      <Link to={latest.to ?? '/notifications'} className="mt-2 block rounded-2xl bg-danger-soft p-4 transition-opacity hover:opacity-90">
          <span className="block text-sm font-semibold text-danger">{latest.title}</span>
          <span className="block text-sm text-ink-soft">{latest.body}</span>
        </Link>
      }
      <ul className="mt-2 divide-y divide-line overflow-hidden rounded-3xl bg-surface">
        {rows.map((r) =>
        <li key={r.to}>
            <Link to={r.to} className="flex min-h-[56px] items-center gap-3 px-4 transition-colors hover:bg-canvas/70">
              <r.icon className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
              <span className="flex-1 font-medium text-ink">{r.label}</span>
              <span className={`text-sm ${r.tone}`}>{r.value}</span>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            </Link>
          </li>
        )}
      </ul>
    </section>);

}