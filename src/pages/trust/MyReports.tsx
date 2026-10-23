import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDownIcon, FlagIcon } from 'lucide-react';
import { PageHeader } from '../../components/consumer/PageHeader';
import { StateView } from '../../components/trust/StateView';
import { useTrust } from '../../contexts/TrustContext';
import { useUser } from '../../contexts/UserContext';
import { formatWhen } from '../../utils/checks';
import { chipClass } from '../../utils/formStyles';
import type { ReportStatus } from '../../types/trust';

export const reportStatusMeta: Record<ReportStatus, {label: string;tone: string;}> = {
  pending: { label: 'Pending', tone: 'bg-canvas text-muted' },
  review: { label: 'Under Review', tone: 'bg-sky-soft text-sky' },
  info: { label: 'More Information Required', tone: 'bg-caution-soft text-caution' },
  resolved: { label: 'Resolved', tone: 'bg-brand-soft text-brand-dark' },
  rejected: { label: 'Rejected', tone: 'bg-danger-soft text-danger' }
};

export function MyReports() {
  const { reports } = useTrust();
  const { session } = useUser();
  const [filter, setFilter] = useState<ReportStatus | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const mine = reports.filter((r) => r.reporter === session?.name);
  const list = mine.filter((r) => filter === 'all' || r.status === filter);

  return (
    <>
      <PageHeader
        title="My reports"
        back="/account"
        actions={
        <Link to="/report-issue" className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-danger hover:bg-danger-soft">
            <FlagIcon className="h-4 w-4" aria-hidden="true" /> New report
          </Link>
        } />
      
      <div className="mx-auto w-full max-w-3xl px-4 lg:px-10">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {(['all', 'pending', 'review', 'info', 'resolved', 'rejected'] as const).map((s) =>
          <button key={s} type="button" aria-pressed={filter === s} onClick={() => setFilter(s)} className={chipClass(filter === s)}>
              {s === 'all' ? `All (${mine.length})` : reportStatusMeta[s].label}
            </button>
          )}
        </div>
        {list.length === 0 ?
        <StateView kind="empty" className="mt-4" title={mine.length ? 'No reports with this status' : 'You haven’t reported anything'} body="If something looks suspicious, report it — it helps protect others." /> :

        <ul className="mt-4 space-y-3">
            {list.map((r) => {
            const expanded = open === r.id;
            return (
              <li key={r.id} className="rounded-3xl bg-surface">
                  <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : r.id)} className="flex w-full items-start gap-3 p-5 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink">{r.entityName}</span>
                      <span className="block text-sm text-muted">
                        {r.id} · {r.category} · {formatWhen(r.at)}
                      </span>
                      <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${reportStatusMeta[r.status].tone}`}>{reportStatusMeta[r.status].label}</span>
                    </span>
                    <ChevronDownIcon className={`mt-1 h-5 w-5 shrink-0 text-muted transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                  {expanded &&
                <div className="border-t border-line px-5 pb-5 pt-4">
                      <p className="whitespace-pre-line text-[15px] text-ink-soft">{r.description}</p>
                      <ol className="mt-4 space-y-3 border-l-2 border-line pl-4">
                        {r.updates.map((u, i) =>
                    <li key={i}>
                            <p className="text-sm font-medium text-ink">{u.text}</p>
                            <p className="text-xs text-muted">
                              {u.by} · {formatWhen(u.at)}
                            </p>
                          </li>
                    )}
                      </ol>
                      {r.status === 'info' &&
                  <Link to={`/report-issue?entity=${r.entityId}`} className="mt-4 inline-flex h-11 items-center rounded-xl bg-caution-soft px-4 text-sm font-semibold text-caution">
                          Add more information
                        </Link>
                  }
                    </div>
                }
                </li>);

          })}
          </ul>
        }
      </div>
    </>);

}