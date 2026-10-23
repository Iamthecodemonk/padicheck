import React, { useState } from 'react';
import { StateView } from '../../components/trust/StateView';
import { useTrust } from '../../contexts/TrustContext';
import { formatWhen } from '../../utils/checks';
import { chipClass } from '../../utils/formStyles';

const PAGE = 10;

export function DevRequests() {
  const { requestLogs } = useTrust();
  const [filter, setFilter] = useState<'all' | 'errors'>('all');
  const [page, setPage] = useState(0);
  const list = requestLogs.filter((r) => filter === 'all' || r.status >= 400);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const rows = list.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <div className="max-w-4xl">
      <div className="flex gap-2">
        {(['all', 'errors'] as const).map((f) =>
        <button
          key={f}
          type="button"
          aria-pressed={filter === f}
          onClick={() => {
            setFilter(f);
            setPage(0);
          }}
          className={chipClass(filter === f)}>
          
            {f === 'all' ? 'All requests' : 'Errors only'}
          </button>
        )}
      </div>
      {rows.length === 0 ?
      <StateView kind="empty" className="mt-4" title="No requests yet" body="Requests from your keys and the sandbox show up here." /> :

      <div className="mt-4 overflow-x-auto rounded-3xl bg-surface">
          <table className="w-full min-w-[560px] text-left text-sm">
            <caption className="sr-only">API request log</caption>
            <thead className="text-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Time</th>
                <th scope="col" className="px-5 py-3 font-medium">Request</th>
                <th scope="col" className="px-5 py-3 font-medium">Status</th>
                <th scope="col" className="px-5 py-3 font-medium">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) =>
            <tr key={r.id}>
                  <td className="px-5 py-3 text-muted">{formatWhen(r.at)}</td>
                  <td className="px-5 py-3 font-mono text-ink">
                    {r.method} {r.path}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-1 font-mono text-xs font-semibold ${r.status < 300 ? 'bg-brand-soft text-brand-dark' : r.status === 429 ? 'bg-amber-soft text-amber' : 'bg-danger-soft text-danger'}`}>{r.status}</span>
                  </td>
                  <td className="px-5 py-3 tabular-nums text-ink">{r.ms} ms</td>
                </tr>
            )}
            </tbody>
          </table>
        </div>
      }
      {pages > 1 &&
      <nav aria-label="Pagination" className="mt-4 flex items-center justify-between">
          <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="h-11 rounded-xl px-4 text-sm font-semibold text-ink ring-1 ring-line disabled:opacity-40">
            Previous
          </button>
          <span className="text-sm text-muted">
            Page {page + 1} of {pages}
          </span>
          <button type="button" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="h-11 rounded-xl px-4 text-sm font-semibold text-ink ring-1 ring-line disabled:opacity-40">
            Next
          </button>
        </nav>
      }
    </div>);

}