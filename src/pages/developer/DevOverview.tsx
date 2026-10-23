import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import { useTrust } from '../../contexts/TrustContext';
import { apiPlan, usageByDay } from '../../data/developer';
import { formatNaira } from '../../utils/checks';

export function DevOverview() {
  const { apiKeys, requestLogs } = useTrust();
  const used = usageByDay.reduce((a, b) => a + b, 0) + requestLogs.length;
  const pct = Math.min(100, Math.round(used / apiPlan.monthlyLimit * 100));
  const errors = requestLogs.filter((r) => r.status >= 400).length;
  const peak = Math.max(...usageByDay);
  const activeKeys = apiKeys.filter((k) => !k.revoked);

  return (
    <div className="space-y-5">
      {activeKeys.length === 0 &&
      <Link to="/developers/keys" className="flex items-center gap-3 rounded-2xl bg-brand-soft p-4 font-medium text-brand-dark">
          <span className="flex-1">Create your first API key to start making requests</span>
          <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
        </Link>
      }
      <div className="grid gap-5 lg:grid-cols-3">
        <section aria-labelledby="usage-h" className="rounded-3xl bg-surface p-6 lg:col-span-2">
          <h2 id="usage-h" className="text-sm font-medium text-muted">
            Requests this month
          </h2>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-4xl font-bold text-ink">{used.toLocaleString()}</span>
            <span className="text-muted">of {apiPlan.monthlyLimit.toLocaleString()}</span>
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-canvas" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Monthly quota used">
            <div className={`h-full rounded-full ${pct > 85 ? 'bg-caution' : 'bg-brand'}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-6 flex h-28 items-end gap-1" role="img" aria-label="Daily requests over the last 14 days">
            {usageByDay.map((v, i) =>
            <div key={i} className={`flex-1 rounded-t ${v === peak ? 'bg-brand' : 'bg-brand/35'}`} style={{ height: `${v / peak * 100}%` }} />
            )}
          </div>
        </section>
        <section aria-labelledby="plan-h" className="rounded-3xl bg-surface p-6">
          <h2 id="plan-h" className="text-sm font-medium text-muted">
            API plan
          </h2>
          <p className="mt-1 text-2xl font-bold text-ink">{apiPlan.name}</p>
          <dl className="mt-4 space-y-2 text-sm">
            {[
            ['Monthly limit', apiPlan.monthlyLimit.toLocaleString()],
            ['Rate limit', `${apiPlan.ratePerMinute}/min`],
            ['Price', `${formatNaira(apiPlan.priceNaira)}/month`],
            ['Error rate (recent)', requestLogs.length ? `${Math.round(errors / requestLogs.length * 100)}%` : '—']].
            map(([k, v]) =>
            <div key={k} className="flex justify-between">
                <dt className="text-muted">{k}</dt>
                <dd className="font-semibold text-ink">{v}</dd>
              </div>
            )}
          </dl>
          <Link to="/business/billing" className="mt-5 inline-flex h-11 items-center text-sm font-semibold text-brand-dark">
            Manage plan & billing
          </Link>
        </section>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
        ['/developers/sandbox', 'Try the sandbox', 'Send test requests with sample data'],
        ['/developers/docs', 'Read the docs', 'Endpoints, errors and examples'],
        ['/business/team', 'Invite your team', 'Share access with developers']].
        map(([to, t, d]) =>
        <Link key={to} to={to} className="rounded-3xl bg-surface p-5 hover:bg-line/40">
            <span className="block font-semibold text-ink">{t}</span>
            <span className="block text-sm text-muted">{d}</span>
          </Link>
        )}
      </div>
    </div>);

}