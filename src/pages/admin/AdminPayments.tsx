import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { StatusPill } from '../../components/admin/StatusPill';
import { payments } from '../../data/adminOps';
import { formatNaira, formatWhen } from '../../utils/checks';
import type { Payment } from '../../types/admin';

type Filter = 'all' | Payment['status'];
const filters: {id: Filter;label: string;}[] = [
{ id: 'all', label: 'All' },
{ id: 'succeeded', label: 'Succeeded' },
{ id: 'pending', label: 'Pending' },
{ id: 'failed', label: 'Failed' }];


export function AdminPayments() {
  const [filter, setFilter] = useState<Filter>('all');
  const list = payments.filter((p) => filter === 'all' || p.status === filter);
  const settled = payments.filter((p) => p.status === 'succeeded').reduce((s, p) => s + p.amountNaira, 0);

  return (
    <>
      <AdminPageHeader title="Payments" subtitle={`${formatNaira(settled)} settled in this period`} />
      <div className="px-4 md:px-8">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {filters.map((f) =>
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`h-11 shrink-0 rounded-full px-4 text-sm font-medium transition-colors ${filter === f.id ? 'bg-ink text-white' : 'bg-surface text-ink ring-1 ring-line hover:bg-canvas'}`}>
            
              {f.label}
            </button>
          )}
        </div>

        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-3xl bg-surface md:hidden">
          {list.map((p) =>
          <li key={p.id} className="flex min-h-[72px] items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <Link to={`/admin/users/${p.userId}`} className="block truncate font-semibold text-ink">
                  {p.user}
                </Link>
                <span className="block truncate text-sm text-muted">
                  {p.method} · {p.credits} credits · {formatWhen(p.at)}
                </span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className="font-semibold text-ink">{formatNaira(p.amountNaira)}</span>
                <StatusPill status={p.status} />
              </span>
            </li>
          )}
        </ul>

        <div className="mt-4 hidden overflow-hidden rounded-3xl bg-surface md:block">
          <table className="w-full text-left text-[15px]">
            <thead className="border-b border-line text-sm text-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Reference</th>
                <th scope="col" className="px-4 py-3 font-medium">User</th>
                <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">Method</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Amount</th>
                <th scope="col" className="hidden px-4 py-3 text-right font-medium lg:table-cell">Credits</th>
                <th scope="col" className="px-4 py-3 font-medium">When</th>
                <th scope="col" className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((p) =>
              <tr key={p.id}>
                  <td className="px-5 py-3 font-mono text-sm text-ink">{p.id}</td>
                  <td className="px-4 py-3">
                    <Link to={`/admin/users/${p.userId}`} className="font-medium text-ink underline-offset-2 hover:underline">
                      {p.user}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 text-muted lg:table-cell">{p.method}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-ink">{formatNaira(p.amountNaira)}</td>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-ink lg:table-cell">{p.credits}</td>
                  <td className="px-4 py-3 text-muted">{formatWhen(p.at)}</td>
                  <td className="px-5 py-3">
                    <StatusPill status={p.status} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {list.length === 0 && <p className="mt-4 rounded-3xl bg-surface px-6 py-10 text-center text-muted">No payments in this view.</p>}
      </div>
    </>);

}