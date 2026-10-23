import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRightIcon, SearchIcon } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { StatusPill } from '../../components/admin/StatusPill';
import { adminUsers } from '../../data/adminUsers';
import { formatWhen } from '../../utils/checks';

type Filter = 'all' | 'active' | 'suspended' | 'low';
const filters: {id: Filter;label: string;}[] = [
{ id: 'all', label: 'All' },
{ id: 'active', label: 'Active' },
{ id: 'suspended', label: 'Suspended' },
{ id: 'low', label: 'Low credits' }];


export function AdminUsers() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return adminUsers.filter((u) => {
      const matches = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.id.includes(q);
      const passes = filter === 'all' || (filter === 'low' ? u.credits < 5 : u.status === filter);
      return matches && passes;
    });
  }, [query, filter]);

  const initials = (name: string) => name.split(' ').map((p) => p[0]).join('').slice(0, 2);

  return (
    <>
      <AdminPageHeader title="Users" subtitle={`${adminUsers.length} people in this view`} />
      <div className="px-4 md:px-8">
        <label className="flex h-12 items-center gap-2 rounded-2xl bg-surface px-4 ring-1 ring-line focus-within:ring-2 focus-within:ring-ink md:max-w-lg">
          <SearchIcon className="h-4 w-4 text-muted" aria-hidden="true" />
          <span className="sr-only">Search users</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email or ID"
            className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted/80" />
          
        </label>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
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

        {list.length === 0 ?
        <p className="mt-6 rounded-3xl bg-surface px-6 py-10 text-center text-muted">No users match “{query}”.</p> :

        <>
            <ul className="mt-4 divide-y divide-line overflow-hidden rounded-3xl bg-surface md:hidden">
              {list.map((u) =>
            <li key={u.id}>
                  <Link to={`/admin/users/${u.id}`} className="flex min-h-[72px] items-center gap-3 px-4 py-3 active:bg-canvas">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-canvas text-sm font-semibold text-ink">{initials(u.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{u.name}</span>
                      <span className="block truncate text-sm text-muted">
                        {u.credits} credits · {u.country}
                      </span>
                    </span>
                    {u.status === 'suspended' && <StatusPill status="suspended" />}
                    <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  </Link>
                </li>
            )}
            </ul>

            <div className="mt-4 hidden overflow-hidden rounded-3xl bg-surface md:block">
              <table className="w-full text-left text-[15px]">
                <thead className="border-b border-line text-sm text-muted">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-medium">User</th>
                    <th scope="col" className="px-4 py-3 font-medium">Country</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Credits</th>
                    <th scope="col" className="hidden px-4 py-3 text-right font-medium lg:table-cell">Checks</th>
                    <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">Last active</th>
                    <th scope="col" className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {list.map((u) =>
                <tr key={u.id} onClick={() => navigate(`/admin/users/${u.id}`)} className="cursor-pointer transition-colors hover:bg-canvas/70">
                      <td className="px-5 py-3">
                        <Link to={`/admin/users/${u.id}`} className="font-semibold text-ink" onClick={(e) => e.stopPropagation()}>
                          {u.name}
                        </Link>
                        <span className="block text-sm text-muted">{u.email}</span>
                      </td>
                      <td className="px-4 py-3 text-ink">{u.country}</td>
                      <td className={`px-4 py-3 text-right font-semibold tabular-nums ${u.credits < 5 ? 'text-caution' : 'text-ink'}`}>{u.credits}</td>
                      <td className="hidden px-4 py-3 text-right tabular-nums text-ink lg:table-cell">{u.checks}</td>
                      <td className="hidden px-4 py-3 text-muted lg:table-cell">{formatWhen(u.lastActive)}</td>
                      <td className="px-5 py-3">
                        <StatusPill status={u.status} />
                      </td>
                    </tr>
                )}
                </tbody>
              </table>
            </div>
          </>
        }
      </div>
    </>);

}