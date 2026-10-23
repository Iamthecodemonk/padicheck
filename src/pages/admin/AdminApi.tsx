import React, { useState } from 'react';
import { toast } from 'sonner';
import { KeyRoundIcon } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { LockedNotice } from '../../components/admin/LockedNotice';
import { ReasonSheet } from '../../components/admin/trust/ReasonSheet';
import { StateView } from '../../components/trust/StateView';
import { useAdminSession } from '../../contexts/AdminSessionContext';
import { useTrust } from '../../contexts/TrustContext';
import { apiEndpoints, apiPlan, usageByDay } from '../../data/developer';
import { formatWhen } from '../../utils/checks';
import type { ApiKey } from '../../types/trust';

export function AdminApi() {
  const { apiKeys, saveApiKey, requestLogs, myBusiness, webhooks } = useTrust();
  const { permissions, log } = useAdminSession();
  const canAct = permissions.manageApi;
  const [revoking, setRevoking] = useState<ApiKey | null>(null);

  const monthly = usageByDay.reduce((a, b) => a + b, 0) + requestLogs.length;
  const errors = requestLogs.filter((r) => r.status >= 400);
  const limited = requestLogs.filter((r) => r.status === 429).length;
  const avgMs = requestLogs.length ? Math.round(requestLogs.reduce((s, r) => s + r.ms, 0) / requestLogs.length) : 0;
  const byEndpoint = apiEndpoints.map((e) => {
    const rs = requestLogs.filter((r) => r.path === e.path);
    return { path: e.path, total: rs.length, errors: rs.filter((r) => r.status >= 400).length };
  });
  const peak = Math.max(...usageByDay);

  return (
    <>
      <AdminPageHeader title="API" subtitle="API customers, keys and request health" />
      <div className="space-y-5 px-4 md:px-8">
        {!canAct && <LockedNotice text="Your role can view API usage but can’t revoke keys." />}
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
          ['Requests this month', monthly.toLocaleString()],
          ['Error rate', requestLogs.length ? `${Math.round(errors.length / requestLogs.length * 100)}%` : '—'],
          ['Rate-limited', limited],
          ['Average latency', avgMs ? `${avgMs} ms` : '—']].
          map(([k, v]) =>
          <div key={k} className="rounded-3xl bg-surface p-5">
              <dt className="text-sm text-muted">{k}</dt>
              <dd className="mt-1 text-2xl font-bold text-ink">{v}</dd>
            </div>
          )}
        </dl>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section aria-labelledby="usage-h" className="rounded-3xl bg-surface p-5">
            <h2 id="usage-h" className="text-sm font-medium text-muted">
              Daily requests, last 14 days
            </h2>
            <div className="mt-4 flex h-32 items-end gap-1" role="img" aria-label={`Daily API requests, peaking at ${peak}`}>
              {usageByDay.map((v, i) =>
              <div key={i} className={`flex-1 rounded-t ${v === peak ? 'bg-brand' : 'bg-brand/35'}`} style={{ height: `${v / peak * 100}%` }} />
              )}
            </div>
            <table className="mt-6 w-full text-sm">
              <caption className="sr-only">Requests by endpoint</caption>
              <thead className="text-muted">
                <tr>
                  <th scope="col" className="py-2 text-left font-medium">Endpoint</th>
                  <th scope="col" className="py-2 text-right font-medium">Recent requests</th>
                  <th scope="col" className="py-2 text-right font-medium">Errors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {byEndpoint.map((e) =>
                <tr key={e.path}>
                    <td className="py-2.5 font-mono text-ink">{e.path}</td>
                    <td className="py-2.5 text-right tabular-nums text-ink">{e.total}</td>
                    <td className={`py-2.5 text-right tabular-nums ${e.errors ? 'text-danger' : 'text-ink'}`}>{e.errors}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section aria-labelledby="cust-h" className="self-start rounded-3xl bg-surface p-5">
            <h2 id="cust-h" className="text-sm font-medium text-muted">
              Customer
            </h2>
            <p className="mt-1 text-lg font-bold text-ink">{myBusiness.name}</p>
            <p className="text-sm text-muted">
              {apiPlan.name} · {apiPlan.monthlyLimit.toLocaleString()} requests/month · {apiPlan.ratePerMinute}/min · {webhooks.length} webhook{webhooks.length === 1 ? '' : 's'}
            </p>
            <p className={`mt-2 text-sm font-semibold ${myBusiness.verification === 'verified' ? 'text-brand-dark' : 'text-caution'}`}>
              {myBusiness.verification === 'verified' ? 'Verified — live keys allowed' : 'Not verified — sandbox keys only'}
            </p>
          </section>
        </div>

        <section aria-labelledby="keys-h">
          <h2 id="keys-h" className="mb-2 text-lg font-semibold text-ink">
            API keys
          </h2>
          {apiKeys.length === 0 ?
          <StateView kind="empty" title="No API keys issued" /> :

          <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface">
              {apiKeys.map((k) =>
            <li key={k.id} className={`flex flex-wrap items-center gap-3 px-5 py-4 ${k.revoked ? 'opacity-60' : ''}`}>
                  <KeyRoundIcon className="h-5 w-5 text-muted" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink">
                      {k.name} <span className="font-normal text-muted">· {myBusiness.name}</span>
                    </span>
                    <span className="block font-mono text-sm text-muted">{k.prefix}••••</span>
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${k.env === 'live' ? 'bg-brand-soft text-brand-dark' : 'bg-amber-soft text-amber'}`}>{k.env === 'live' ? 'Live' : 'Sandbox'}</span>
                  <span className="w-full text-sm text-muted sm:w-36">{k.revoked ? 'Revoked' : k.lastUsed ? `Used ${formatWhen(k.lastUsed)}` : 'Never used'}</span>
                  {canAct && !k.revoked &&
              <button type="button" onClick={() => setRevoking(k)} className="h-11 rounded-xl px-3 text-sm font-semibold text-danger hover:bg-danger-soft">
                      Revoke
                    </button>
              }
                </li>
            )}
            </ul>
          }
        </section>

        {errors.length > 0 &&
        <section aria-labelledby="err-h">
            <h2 id="err-h" className="mb-2 text-lg font-semibold text-ink">
              Recent errors
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface text-sm">
              {errors.slice(0, 8).map((r) =>
            <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="rounded-full bg-danger-soft px-2 py-0.5 font-mono text-xs font-semibold text-danger">{r.status}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-ink">
                    {r.method} {r.path}
                  </span>
                  <span className="text-muted">{formatWhen(r.at)}</span>
                </li>
            )}
            </ul>
          </section>
        }
      </div>
      <ReasonSheet
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        title={`Revoke “${revoking?.name}”`}
        description="Requests using this key fail immediately with 401. The customer is emailed."
        confirmLabel="Revoke key"
        tone="danger"
        onConfirm={(reason) => {
          if (revoking) {
            saveApiKey({ ...revoking, revoked: true });
            log('platform', 'Revoked API key', `${revoking.prefix} · ${myBusiness.name} — ${reason}`);
          }
          setRevoking(null);
          toast('Key revoked');
        }} />
      
    </>);

}