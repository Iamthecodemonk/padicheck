import React, { useState } from 'react';
import { toast } from 'sonner';
import { LockIcon } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { StatusPill } from '../../components/admin/StatusPill';
import { Switch } from '../../components/Switch';
import { useAdminSession } from '../../contexts/AdminSessionContext';
import { usePwa } from '../../contexts/PwaContext';
import { aiProviders } from '../../data/adminOps';

export function AdminProviders() {
  const { permissions } = useAdminSession();
  const { online } = usePwa();
  const [routing, setRouting] = useState<Record<string, boolean>>(Object.fromEntries(aiProviders.map((p) => [p.id, p.routing])));
  const canManage = permissions.manageProviders && online;

  return (
    <>
      <AdminPageHeader title="AI Providers" subtitle="Live performance over the last 24 hours. Traffic fails over automatically." />
      <div className="px-4 md:px-8">
        {!permissions.manageProviders &&
        <p className="mb-3 flex items-center gap-2 text-sm text-muted">
            <LockIcon className="h-4 w-4" aria-hidden="true" /> View only — routing changes need a super admin.
          </p>
        }
        <div className="overflow-hidden rounded-3xl bg-surface">
          <div className="hidden grid-cols-[minmax(0,2fr)_130px_110px_110px_110px_72px] gap-4 border-b border-line px-5 py-3 text-sm font-medium text-muted lg:grid">
            <span>Provider</span>
            <span>Status</span>
            <span className="text-right">Latency</span>
            <span className="text-right">Errors</span>
            <span className="text-right">Requests</span>
            <span className="text-right">Route</span>
          </div>
          <ul className="divide-y divide-line">
            {aiProviders.map((p) =>
            <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-4 lg:grid-cols-[minmax(0,2fr)_130px_110px_110px_110px_72px] lg:px-5">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{p.name}</p>
                  <p className="truncate text-sm text-muted">
                    {p.role} · fallback {p.fallback}
                  </p>
                </div>
                <div className="justify-self-end lg:justify-self-start">
                  <StatusPill status={p.status} />
                </div>
                <dl className="col-span-2 grid grid-cols-3 gap-2 text-sm lg:contents">
                  <div className="lg:text-right">
                    <dt className="text-muted lg:sr-only">Latency</dt>
                    <dd className={`font-medium tabular-nums ${p.latencyMs > 4000 ? 'text-caution' : 'text-ink'}`}>{(p.latencyMs / 1000).toFixed(1)}s</dd>
                  </div>
                  <div className="lg:text-right">
                    <dt className="text-muted lg:sr-only">Errors</dt>
                    <dd className={`font-medium tabular-nums ${p.errorRate > 3 ? 'text-danger' : 'text-ink'}`}>{p.errorRate}%</dd>
                  </div>
                  <div className="lg:text-right">
                    <dt className="text-muted lg:sr-only">Requests</dt>
                    <dd className="font-medium tabular-nums text-ink">{p.requests24h.toLocaleString()}</dd>
                  </div>
                </dl>
                <div className="col-span-2 flex items-center justify-between border-t border-line pt-1 lg:col-span-1 lg:justify-end lg:border-0 lg:pt-0">
                  <span className="text-sm text-muted lg:sr-only">Route traffic</span>
                  <Switch
                  checked={routing[p.id]}
                  disabled={!canManage}
                  onChange={(on) => {
                    setRouting((r) => ({ ...r, [p.id]: on }));
                    toast(on ? `Routing traffic to ${p.name}` : `${p.name} drained — using ${p.fallback}`);
                  }}
                  label={`Route traffic to ${p.name}`} />
                
                </div>
              </li>
            )}
          </ul>
        </div>
      </div>
    </>);

}