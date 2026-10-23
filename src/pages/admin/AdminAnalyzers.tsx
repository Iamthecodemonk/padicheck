import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { RotateCcwIcon, UndoIcon } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { Switch } from '../../components/Switch';
import { useAdminSession } from '../../contexts/AdminSessionContext';
import { usePwa } from '../../contexts/PwaContext';
import { analyzers, failedAnalyses } from '../../data/adminOps';
import { formatWhen, getCheckType } from '../../utils/checks';
import type { FailedAnalysis } from '../../types/admin';

export function AdminAnalyzers() {
  const { permissions, log } = useAdminSession();
  const { online } = usePwa();
  const [failed, setFailed] = useState(failedAnalyses);
  const [enabled, setEnabled] = useState<Record<string, boolean>>(Object.fromEntries(analyzers.map((a) => [a.id, a.enabled])));
  const [refunding, setRefunding] = useState<FailedAnalysis | null>(null);

  const removeItem = (id: string) => setFailed((list) => list.filter((f) => f.id !== id));

  return (
    <>
      <AdminPageHeader title="Analyzers" subtitle="Failed checks to review, and how each analyzer is performing." />
      <div className="grid gap-5 px-4 md:px-8 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section aria-labelledby="failed-heading" className="rounded-3xl bg-surface p-2">
          <h2 id="failed-heading" className="px-3 pb-1 pt-3 text-lg font-semibold text-ink">
            Failed analyses <span className="font-normal text-muted">· {failed.length}</span>
          </h2>
          {failed.length === 0 ?
          <p className="px-3 pb-6 pt-2 text-muted">All caught up — nothing to review.</p> :

          <ul className="divide-y divide-line">
              {failed.map((f) => {
              const t = getCheckType(f.type);
              return (
                <li key={f.id} className="flex flex-col gap-3 px-3 py-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 gap-3">
                      <t.icon className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">{f.reason}</p>
                        <p className="truncate text-sm text-muted">{f.input}</p>
                        <p className="mt-0.5 text-sm text-muted">
                          <Link to={`/admin/users/${f.userId}`} className="font-medium text-ink underline-offset-2 hover:underline">
                            {f.user}
                          </Link>{' '}
                          · {f.provider} · {formatWhen(f.at)} · {f.creditsHeld} credits held
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2 pl-8 sm:pl-0">
                      <button
                      type="button"
                      disabled={!online}
                      onClick={() => {
                        removeItem(f.id);
                        toast.success(`Retry queued for ${f.id}`);
                      }}
                      className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-ink ring-1 ring-line hover:bg-canvas disabled:opacity-40">
                      
                        <RotateCcwIcon className="h-4 w-4" aria-hidden="true" /> Retry
                      </button>
                      <button
                      type="button"
                      disabled={!online || !permissions.refund}
                      title={permissions.refund ? undefined : 'Your role can’t issue refunds'}
                      onClick={() => setRefunding(f)}
                      className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-ink px-3 text-sm font-semibold text-white hover:bg-ink-soft disabled:opacity-40">
                      
                        <UndoIcon className="h-4 w-4" aria-hidden="true" /> Refund
                      </button>
                    </div>
                  </li>);

            })}
            </ul>
          }
        </section>

        <section aria-labelledby="analyzers-heading" className="self-start rounded-3xl bg-surface p-2">
          <h2 id="analyzers-heading" className="px-3 pb-1 pt-3 text-lg font-semibold text-ink">
            Analyzers
          </h2>
          <ul className="divide-y divide-line">
            {analyzers.map((a) =>
            <li key={a.id} className="flex items-center gap-3 py-2 pl-3 pr-1">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{a.name}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-line" aria-hidden="true">
                      <div className={`h-full rounded-full ${a.successRate < 96 ? 'bg-caution' : 'bg-brand'}`} style={{ width: `${a.successRate}%` }} />
                    </div>
                    <span className="text-sm text-muted">
                      {a.successRate}% · {a.runs24h.toLocaleString()} runs
                    </span>
                  </div>
                </div>
                <Switch
                checked={enabled[a.id]}
                disabled={!permissions.manageProviders || !online}
                onChange={(on) => {
                  setEnabled((s) => ({ ...s, [a.id]: on }));
                  toast(`${a.name} ${on ? 'enabled' : 'paused'}`);
                }}
                label={`${a.name} enabled`} />
              
              </li>
            )}
          </ul>
        </section>
      </div>

      <ConfirmSheet
        open={refunding !== null}
        onClose={() => setRefunding(null)}
        onConfirm={() => {
          if (!refunding) return;
          removeItem(refunding.id);
          log('credits', `Refunded ${refunding.creditsHeld} credits to ${refunding.user}`, refunding.reason);
          toast.success(`Refunded ${refunding.creditsHeld} credits to ${refunding.user}`);
          setRefunding(null);
        }}
        title={refunding ? `Refund ${refunding.creditsHeld} credits?` : ''}
        description={refunding ? `${refunding.user} will be notified, and the refund is recorded in the audit log.` : ''}
        confirmLabel="Refund" />
      
    </>);

}