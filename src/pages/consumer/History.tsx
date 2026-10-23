import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckIcon, SearchIcon, SlidersHorizontalIcon } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { PullToRefresh } from '../../components/PullToRefresh';
import { PageHeader } from '../../components/consumer/PageHeader';
import { QueueList } from '../../components/consumer/QueueList';
import { ResultRow } from '../../components/consumer/ResultRow';
import { usePwa } from '../../contexts/PwaContext';
import { useUser } from '../../contexts/UserContext';
import { checkTypes } from '../../data/checkTypes';
import { results } from '../../data/results';
import type { CheckType, Verdict } from '../../types/check';

type SortOrder = 'newest' | 'oldest' | 'risk';
const sortOptions: {id: SortOrder;label: string;}[] = [
{ id: 'newest', label: 'Newest first' },
{ id: 'oldest', label: 'Oldest first' },
{ id: 'risk', label: 'Highest risk first' }];

const riskRank: Record<Verdict, number> = { risk: 0, caution: 1, good: 2 };

export function History() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'pending' ? 'pending' : 'all';
  const { online } = usePwa();
  const { queue } = useUser();
  const [query, setQuery] = useState('');
  const [types, setTypes] = useState<CheckType[]>([]);
  const [sort, setSort] = useState<SortOrder>('newest');
  const [filterOpen, setFilterOpen] = useState(false);
  const pending = queue.filter((t) => t.status !== 'done').length;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = results.filter(
      (r) => (types.length === 0 || types.includes(r.type)) && (!q || r.title.toLowerCase().includes(q) || r.source.toLowerCase().includes(q))
    );
    return [...filtered].sort((a, b) => {
      if (sort === 'risk') return riskRank[a.verdict] - riskRank[b.verdict];
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sort === 'newest' ? diff : -diff;
    });
  }, [query, types, sort]);

  const refresh = async () => {
    if (!online) {
      toast('You’re offline', { description: 'Showing reports stored on this device.' });
      return;
    }
    await new Promise((r) => window.setTimeout(r, 900));
    toast.success('History is up to date');
  };

  const activeFilters = types.length + (sort !== 'newest' ? 1 : 0);

  return (
    <>
      <PageHeader title="History" />
      <div className="mx-auto w-full max-w-3xl px-4 lg:px-10">
        <div role="tablist" aria-label="History view" className="grid grid-cols-2 gap-1 rounded-2xl bg-line/60 p-1">
          {(['all', 'pending'] as const).map((id) =>
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setParams(id === 'pending' ? { tab: 'pending' } : {}, { replace: true })}
            className={`h-11 rounded-xl text-[15px] font-semibold transition-colors ${tab === id ? 'bg-surface text-ink shadow-card' : 'text-muted'}`}>
            
              {id === 'all' ? 'All checks' : `Pending${pending ? ` (${pending})` : ''}`}
            </button>
          )}
        </div>

        {tab === 'pending' ?
        <div className="mt-4">
            <QueueList />
          </div> :

        <PullToRefresh onRefresh={refresh}>
            <div className="mt-4 flex gap-2">
              <label className="flex h-12 flex-1 items-center gap-2 rounded-2xl bg-surface px-4 ring-1 ring-line focus-within:ring-2 focus-within:ring-ink">
                <SearchIcon className="h-4 w-4 text-muted" aria-hidden="true" />
                <span className="sr-only">Search history</span>
                <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search checks"
                className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted/80" />
              
              </label>
              <button
              type="button"
              onClick={() => setFilterOpen(true)}
              aria-label={`Filter and sort${activeFilters ? `, ${activeFilters} active` : ''}`}
              className="relative grid h-12 w-12 place-items-center rounded-2xl bg-surface text-ink ring-1 ring-line hover:bg-canvas">
              
                <SlidersHorizontalIcon className="h-5 w-5" />
                {activeFilters > 0 &&
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">{activeFilters}</span>
              }
              </button>
            </div>

            {list.length === 0 ?
          <div className="mt-6 rounded-3xl bg-surface px-6 py-10 text-center">
                <p className="font-semibold text-ink">No matching checks</p>
                <p className="mt-1 text-sm text-muted">Try a different search or clear your filters.</p>
              </div> :

          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-3xl bg-surface">
                {list.map((r) =>
            <ResultRow key={r.id} result={r} />
            )}
              </ul>
          }
            {!online && <p className="mt-3 px-1 text-xs text-muted">Reports marked “Needs connection” weren’t stored on this device.</p>}
          </PullToRefresh>
        }
      </div>

      <BottomSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter & sort"
        footer={
        <div className="grid grid-cols-2 gap-3">
            <button
            type="button"
            onClick={() => {
              setTypes([]);
              setSort('newest');
            }}
            className="h-12 rounded-2xl border border-line font-semibold text-ink hover:bg-canvas">
            
              Reset
            </button>
            <button type="button" onClick={() => setFilterOpen(false)} className="h-12 rounded-2xl bg-ink font-semibold text-white hover:bg-ink-soft">
              Show {list.length}
            </button>
          </div>
        }>
        
        <h3 className="text-sm font-medium text-muted">Type</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {checkTypes.map((t) => {
            const on = types.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => setTypes((s) => on ? s.filter((x) => x !== t.id) : [...s, t.id])}
                className={`inline-flex h-11 items-center gap-2 rounded-full px-4 text-[15px] font-medium transition-colors ${
                on ? 'bg-ink text-white' : 'bg-canvas text-ink hover:bg-line/60'}`
                }>
                
                <t.icon className="h-4 w-4" aria-hidden="true" /> {t.label}
              </button>);

          })}
        </div>
        <h3 className="mt-6 text-sm font-medium text-muted">Sort</h3>
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl bg-canvas" role="radiogroup" aria-label="Sort order">
          {sortOptions.map((o) =>
          <li key={o.id}>
              <button type="button" role="radio" aria-checked={sort === o.id} onClick={() => setSort(o.id)} className="flex h-14 w-full items-center px-4 text-left font-medium text-ink hover:bg-line/50">
                <span className="flex-1">{o.label}</span>
                {sort === o.id && <CheckIcon className="h-5 w-5 text-brand" aria-hidden="true" />}
              </button>
            </li>
          )}
        </ul>
      </BottomSheet>
    </>);

}