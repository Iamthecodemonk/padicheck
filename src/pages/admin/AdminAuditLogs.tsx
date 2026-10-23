import React, { useMemo, useState } from 'react';
import { DownloadIcon, SearchIcon } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { LockedNotice } from '../../components/admin/LockedNotice';
import { useAdminData } from '../../contexts/AdminDataContext';
import { useAdminSession } from '../../contexts/AdminSessionContext';
import { formatWhen } from '../../utils/checks';
import { chipClass } from '../../utils/formStyles';
import type { AuditCategory } from '../../types/admin';

const categories: {id: AuditCategory | 'all';label: string;tone: string;}[] = [
{ id: 'all', label: 'All', tone: '' },
{ id: 'trust', label: 'Trust & Safety', tone: 'bg-danger-soft text-danger' },
{ id: 'users', label: 'Users', tone: 'bg-sky-soft text-sky' },
{ id: 'credits', label: 'Credits', tone: 'bg-amber-soft text-amber' },
{ id: 'pricing', label: 'Pricing', tone: 'bg-amber-soft text-amber' },
{ id: 'content', label: 'Content', tone: 'bg-teal-soft text-teal' },
{ id: 'team', label: 'Team', tone: 'bg-violet-soft text-violet' },
{ id: 'notifications', label: 'Notifications', tone: 'bg-rose-soft text-rose' },
{ id: 'settings', label: 'Settings', tone: 'bg-canvas text-ink' },
{ id: 'platform', label: 'Platform', tone: 'bg-brand-soft text-brand-dark' },
{ id: 'support', label: 'Support', tone: 'bg-sky-soft text-sky' }];


export function AdminAuditLogs() {
  const { audit } = useAdminData();
  const { permissions } = useAdminSession();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<AuditCategory | 'all'>('all');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return audit.filter((a) => (cat === 'all' || a.category === cat) && (!q || `${a.actor} ${a.action} ${a.detail ?? ''}`.toLowerCase().includes(q)));
  }, [audit, query, cat]);

  const exportCsv = () => {
    const rows = [['When', 'Admin', 'Category', 'Action', 'Detail'], ...list.map((a) => [a.at, a.actor, a.category, a.action, a.detail ?? ''])];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `padicheck-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!permissions.viewAuditLogs) {
    return (
      <>
        <AdminPageHeader title="Audit Logs" />
        <div className="px-4 md:px-8">
          <LockedNotice text="Your role can’t view audit logs." />
        </div>
      </>);

  }

  const tone = (c: AuditCategory) => categories.find((x) => x.id === c)?.tone ?? '';

  return (
    <>
      <AdminPageHeader
        title="Audit Logs"
        subtitle="Every admin action, who did it and when. Entries can’t be edited or deleted."
        actions={
        <button type="button" onClick={exportCsv} className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-ink ring-1 ring-line hover:bg-surface">
            <DownloadIcon className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">Export CSV</span>
          </button>
        } />
      
      <div className="px-4 md:px-8">
        <label className="flex h-12 items-center gap-2 rounded-2xl bg-surface px-4 ring-1 ring-line focus-within:ring-2 focus-within:ring-brand md:max-w-lg">
          <SearchIcon className="h-4 w-4 text-muted" aria-hidden="true" />
          <span className="sr-only">Search audit log</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by admin or action" className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted/80" />
        </label>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          {categories.map((c) =>
          <button key={c.id} type="button" aria-pressed={cat === c.id} onClick={() => setCat(c.id)} className={chipClass(cat === c.id)}>
              {c.label}
            </button>
          )}
        </div>
        <ol className="mt-4 divide-y divide-line overflow-hidden rounded-3xl bg-surface lg:max-w-5xl">
          {list.map((a) =>
          <li key={a.id} className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-4">
              <span className="w-32 shrink-0 text-sm text-muted">{formatWhen(a.at)}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-ink">{a.action}</span>
                <span className="block text-sm text-muted">
                  {a.actor}
                  {a.detail ? ` · ${a.detail}` : ''}
                </span>
              </span>
              <span className={`self-start rounded-full px-2.5 py-1 text-xs font-semibold capitalize sm:self-center ${tone(a.category)}`}>{a.category}</span>
            </li>
          )}
          {list.length === 0 && <li className="px-5 py-10 text-center text-muted">No matching entries.</li>}
        </ol>
      </div>
    </>);

}