import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ChevronRightIcon } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { StatusPill } from '../../components/admin/StatusPill';
import { InstallCard } from '../../components/pwa/InstallCard';
import { useAdminSession } from '../../contexts/AdminSessionContext';
import { useTrust } from '../../contexts/TrustContext';
import { useAdminBadges } from '../../hooks/useAdminBadges';
import { aiProviders, failedAnalyses, payments } from '../../data/adminOps';
import { analysesByHour, keyNumbers } from '../../data/adminDashboard';
import { supportTickets } from '../../data/adminSupport';
import { formatNaira, formatWhen } from '../../utils/checks';

const toneDot = { bad: 'bg-danger', warn: 'bg-caution', info: 'bg-ink' };

export function AdminDashboard() {
  const { session } = useAdminSession();
  const firstName = session?.name.split(' ')[0] ?? '';
  const total = analysesByHour.reduce((a, b) => a + b, 0);
  const peak = Math.max(...analysesByHour);
  const openTickets = supportTickets.filter((t) => t.status === 'open');
  const degraded = aiProviders.filter((p) => p.status !== 'operational');
  const pending = payments.filter((p) => p.status === 'pending');
  const badges = useAdminBadges();
  const { reports, businesses, disputes, entities } = useTrust();
  const trustNumbers = [
  { label: 'Verified businesses', value: businesses.filter((b) => b.verification === 'verified').length, to: '/admin/businesses' },
  { label: 'Pending verification', value: badges.verification, to: '/admin/businesses' },
  { label: 'Open reports', value: badges.reports, to: '/admin/reports' },
  { label: 'Open disputes', value: badges.disputes, to: '/admin/disputes' },
  { label: 'High-risk entities', value: entities.filter((e) => e.score < 40).length, to: '/admin/trust-scores' },
  { label: 'Disputes resolved', value: disputes.filter((d) => ['upheld', 'corrected', 'removed'].includes(d.status)).length, to: '/admin/disputes' }];


  const attention = [
  ...(badges.verification ? [{ to: '/admin/businesses', tone: 'info' as const, title: `${badges.verification} businesses awaiting verification`, detail: 'Review documents and approve, reject or request information' }] : []),
  ...(badges.directory ? [{ to: '/admin/directory', tone: 'info' as const, title: `${badges.directory} paid directory listings to approve`, detail: 'Owners have paid ₦6,000 — approve or refund' }] : []),
  ...(badges.reports ? [{ to: '/admin/reports', tone: 'bad' as const, title: `${badges.reports} user reports to moderate`, detail: `${reports.filter((r) => r.risk === 'high' && (r.status === 'pending' || r.status === 'review')).length} high risk` }] : []),
  ...(badges.disputes ? [{ to: '/admin/disputes', tone: 'warn' as const, title: `${badges.disputes} disputes to decide`, detail: 'Businesses challenging reports' }] : []),
  ...(badges.reviews ? [{ to: '/admin/reviews', tone: 'warn' as const, title: `${badges.reviews} reported reviews`, detail: 'Check against review guidelines' }] : []),
  ...(badges.ai ? [{ to: '/admin/ai-analysis', tone: 'info' as const, title: `${badges.ai} AI flags need a human`, detail: 'AI signals never act on their own' }] : []),
  {
    to: '/admin/analyzers',
    tone: 'bad' as const,
    title: `${failedAnalyses.length} failed analyses`,
    detail: `${failedAnalyses.reduce((s, f) => s + f.creditsHeld, 0)} credits held for users`
  },
  ...degraded.map((p) => ({ to: '/admin/providers', tone: 'warn' as const, title: `${p.name} is ${p.status}`, detail: `${p.errorRate}% errors · failover to ${p.fallback}` })),
  {
    to: '/admin/support',
    tone: 'info' as const,
    title: `${openTickets.length} open support tickets`,
    detail: `${openTickets.filter((t) => t.priority === 'high').length} high priority`
  },
  { to: '/admin/payments', tone: 'warn' as const, title: `${pending.length} payments pending`, detail: 'Awaiting bank or card confirmation' }];


  return (
    <>
      <AdminPageHeader title={`Good morning, ${firstName}`} subtitle={format(new Date(), 'EEEE d MMMM')} />
      <section aria-labelledby="trust-heading" className="px-4 pb-5 md:px-8">
        <h2 id="trust-heading" className="sr-only">
          Trust & Safety
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {trustNumbers.map((n) =>
          <li key={n.label}>
              <Link to={n.to} className="block rounded-3xl bg-surface p-4 transition-colors hover:bg-line/40">
                <span className="block text-sm text-muted">{n.label}</span>
                <span className="mt-1 block text-2xl font-bold text-ink">{n.value}</span>
              </Link>
            </li>
          )}
        </ul>
      </section>
      <div className="grid gap-5 px-4 md:px-8 lg:grid-cols-3">
        <section aria-labelledby="attention-heading" className="rounded-3xl bg-surface p-2 lg:col-span-2">
          <h2 id="attention-heading" className="px-3 pb-1 pt-3 text-lg font-semibold text-ink">
            Needs attention
          </h2>
          <ul>
            {attention.map((item) =>
            <li key={item.title}>
                <Link to={item.to} className="flex min-h-[64px] items-center gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-canvas">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${toneDot[item.tone]}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">{item.title}</span>
                    <span className="block truncate text-sm text-muted">{item.detail}</span>
                  </span>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                </Link>
              </li>
            )}
          </ul>
        </section>

        <section aria-labelledby="today-heading" className="rounded-3xl bg-surface p-5">
          <h2 id="today-heading" className="text-lg font-semibold text-ink">
            Today
          </h2>
          <dl className="mt-3 divide-y divide-line">
            {keyNumbers.map((n) =>
            <div key={n.label} className="py-3">
                <dt className="text-sm text-muted">{n.label}</dt>
                <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                  <span className="text-xl font-bold text-ink">{n.value}</span>
                  <span className="text-xs text-muted">{n.change}</span>
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section aria-labelledby="volume-heading" className="rounded-3xl bg-surface p-5 lg:col-span-2">
          <h2 id="volume-heading" className="text-sm font-medium text-muted">
            Analyses, last 24 hours
          </h2>
          <p className="mt-1 text-4xl font-bold tracking-tight text-ink">{total.toLocaleString()}</p>
          <div className="mt-5 flex h-40 items-end gap-[3px]" role="img" aria-label={`Hourly analyses, peaking at ${peak} per hour around midday`}>
            {analysesByHour.map((v, i) =>
            <div key={i} className={`flex-1 rounded-t ${v === peak ? 'bg-brand' : 'bg-brand/35'}`} style={{ height: `${v / peak * 100}%` }} />
            )}
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted" aria-hidden="true">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>Now</span>
          </div>
        </section>

        <section aria-labelledby="payments-heading" className="rounded-3xl bg-surface p-2">
          <div className="flex items-center justify-between px-3 pt-3">
            <h2 id="payments-heading" className="text-lg font-semibold text-ink">
              Latest payments
            </h2>
            <Link to="/admin/payments" className="inline-flex h-11 items-center rounded-xl px-2 text-sm font-semibold text-brand-dark hover:bg-canvas">
              All
            </Link>
          </div>
          <ul>
            {payments.slice(0, 4).map((p) =>
            <li key={p.id} className="flex min-h-[60px] items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{p.user}</span>
                  <span className="block text-sm text-muted">{formatWhen(p.at)}</span>
                </span>
                <span className="text-right">
                  <span className="block font-semibold text-ink">{formatNaira(p.amountNaira)}</span>
                  <StatusPill status={p.status} />
                </span>
              </li>
            )}
          </ul>
        </section>

        <InstallCard className="lg:col-span-3" context="Get alerts for failures and support tickets, and open the console from your home screen or dock." />
      </div>
    </>);

}