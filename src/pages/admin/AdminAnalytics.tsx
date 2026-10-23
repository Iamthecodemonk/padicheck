import React, { useState } from 'react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { LockedNotice } from '../../components/admin/LockedNotice';
import { SegmentedTabs } from '../../components/admin/SegmentedTabs';
import { useAdminSession } from '../../contexts/AdminSessionContext';
import { analyticsByRange, checksByCategory, entryPoints, installFunnel, platformSplit, topCountries, type AnalyticsRange } from '../../data/adminAnalytics';
import { formatNaira } from '../../utils/checks';

export function AdminAnalytics() {
  const { permissions } = useAdminSession();
  const [range, setRange] = useState<AnalyticsRange>('7d');
  const data = analyticsByRange[range];
  const peak = Math.max(...data.daily);
  const funnelTop = installFunnel[0].value;

  if (!permissions.viewAnalytics) {
    return (
      <>
        <AdminPageHeader title="Analytics" />
        <div className="px-4 md:px-8">
          <LockedNotice text="Your role can’t view analytics." />
        </div>
      </>);

  }

  return (
    <>
      <AdminPageHeader title="Analytics" subtitle="How people find, install and use PadiCheck." />
      <div className="space-y-5 px-4 md:px-8">
        <SegmentedTabs
          label="Date range"
          value={range}
          onChange={setRange}
          tabs={[
          { id: '7d', label: '7 days' },
          { id: '30d', label: '30 days' },
          { id: '90d', label: '90 days' }]
          } />
        

        <div className="grid gap-5 lg:grid-cols-3">
          <section aria-labelledby="checks-heading" className="rounded-3xl bg-surface p-5 lg:col-span-2">
            <h2 id="checks-heading" className="text-sm font-medium text-muted">
              Checks run
            </h2>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-4xl font-bold tracking-tight text-ink">{data.checks.toLocaleString()}</span>
              <span className="text-sm font-semibold text-brand-dark">{data.checksChange}</span>
            </p>
            <div className="mt-5 flex h-44 items-end gap-1" role="img" aria-label={`Checks per ${range === '90d' ? 'week' : 'day'}, peaking at ${peak.toLocaleString()}`}>
              {data.daily.map((v, i) =>
              <div key={i} className="flex h-full flex-1 flex-col justify-end">
                  <div className={`rounded-t-md ${v === peak ? 'bg-brand' : 'bg-brand/40'}`} style={{ height: `${v / peak * 100}%` }} />
                </div>
              )}
            </div>
            <div className="mt-2 flex gap-1 text-xs text-muted" aria-hidden="true">
              {data.labels.map((l, i) =>
              <span key={i} className="flex-1 whitespace-nowrap text-center">
                  {l}
                </span>
              )}
            </div>
          </section>

          <section aria-label="Growth" className="grid gap-5">
            <div className="rounded-3xl bg-sky-soft p-5">
              <p className="text-sm font-medium text-sky">New users</p>
              <p className="mt-1 text-3xl font-bold text-ink">{data.newUsers.toLocaleString()}</p>
              <p className="text-sm text-ink-soft">{data.usersChange} on previous period</p>
            </div>
            <div className="rounded-3xl bg-amber-soft p-5">
              <p className="text-sm font-medium text-amber">Credit revenue</p>
              <p className="mt-1 text-3xl font-bold text-ink">{formatNaira(data.revenue)}</p>
              <p className="text-sm text-ink-soft">{data.revenueChange} on previous period</p>
            </div>
          </section>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <section aria-labelledby="cat-heading" className="rounded-3xl bg-surface p-5">
            <h2 id="cat-heading" className="text-lg font-semibold text-ink">
              Checks by category
            </h2>
            <div className="mt-4 flex h-3 overflow-hidden rounded-full" aria-hidden="true">
              {checksByCategory.map((c) =>
              <div key={c.label} className={c.tone} style={{ width: `${c.share}%` }} />
              )}
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
              {checksByCategory.map((c) =>
              <li key={c.label} className="flex items-center gap-2 text-sm">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${c.tone}`} aria-hidden="true" />
                  <span className="flex-1 text-ink">{c.label}</span>
                  <span className="font-semibold tabular-nums text-ink">{c.share}%</span>
                </li>
              )}
            </ul>
          </section>

          <section aria-labelledby="funnel-heading" className="rounded-3xl bg-surface p-5">
            <h2 id="funnel-heading" className="text-lg font-semibold text-ink">
              Install funnel
            </h2>
            <ol className="mt-4 space-y-3">
              {installFunnel.map((s) =>
              <li key={s.label}>
                  <div className="flex justify-between text-sm">
                    <span className="text-ink">{s.label}</span>
                    <span className="font-semibold tabular-nums text-ink">
                      {s.value.toLocaleString()} <span className="font-normal text-muted">· {Math.round(s.value / funnelTop * 100)}%</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-canvas">
                    <div className="h-full rounded-full bg-violet" style={{ width: `${s.value / funnelTop * 100}%` }} />
                  </div>
                </li>
              )}
            </ol>
          </section>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {[
          { title: 'Platform', rows: platformSplit.map((p) => ({ ...p, tone: p.tone })) },
          { title: 'Countries', rows: topCountries.map((p) => ({ ...p, tone: 'bg-amber' })) },
          { title: 'How checks start', rows: entryPoints.map((p) => ({ ...p, tone: 'bg-teal' })) }].
          map((card) =>
          <section key={card.title} className="rounded-3xl bg-surface p-5">
              <h2 className="text-lg font-semibold text-ink">{card.title}</h2>
              <ul className="mt-3 space-y-3">
                {card.rows.map((r) =>
              <li key={r.label}>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink">{r.label}</span>
                      <span className="font-semibold tabular-nums text-ink">{r.value}%</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-canvas">
                      <div className={`h-full rounded-full ${r.tone}`} style={{ width: `${r.value}%` }} />
                    </div>
                  </li>
              )}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>);

}