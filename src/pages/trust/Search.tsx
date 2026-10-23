import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SearchIcon } from 'lucide-react';
import { PageHeader } from '../../components/consumer/PageHeader';
import { EntityRow } from '../../components/trust/EntityRow';
import { StateView } from '../../components/trust/StateView';
import { useTrust } from '../../contexts/TrustContext';
import { entityTypes } from '../../data/entityTypes';
import { entityFromBusiness } from '../../utils/trustApi';
import { chipClass } from '../../utils/formStyles';
import type { EntityType } from '../../types/trust';

export function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const type = params.get('type') as EntityType | null ?? null;
  const savedOnly = params.get('saved') === '1';
  const { entities: all, businesses, savedEntityIds, myCheckIds } = useTrust();
  // People are only listed if you checked them yourself — search never exposes private individuals.
  const entities = useMemo(() => all.filter((e) => e.type !== 'person' || myCheckIds.includes(e.id)), [all, myCheckIds]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const bizEntities = businesses.filter((b) => !b.entityId && b.verification !== 'none').map(entityFromBusiness);
    return [...entities, ...bizEntities].filter(
      (e) =>
      (!type || e.type === type) && (
      !savedOnly || savedEntityIds.includes(e.id)) && (
      !term || `${e.name} ${e.identifier} ${e.subtitle}`.toLowerCase().includes(term))
    );
  }, [q, type, savedOnly, entities, businesses, savedEntityIds]);

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => v ? next.set(k, v) : next.delete(k));
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader title="Search" back />
      <div className="mx-auto w-full max-w-3xl px-4 lg:px-10">
        <label className="flex h-14 items-center gap-3 rounded-2xl bg-surface px-4 ring-1 ring-line focus-within:ring-2 focus-within:ring-brand">
          <SearchIcon className="h-5 w-5 text-muted" aria-hidden="true" />
          <span className="sr-only">Search businesses, phones, websites and listings</span>
          <input type="search" autoFocus value={q} onChange={(e) => update({ q: e.target.value })} placeholder="Business, phone, website, listing…" className="h-full min-w-0 flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-muted/80" />
        </label>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
          <button type="button" aria-pressed={!type && !savedOnly} onClick={() => update({ type: null, saved: null })} className={chipClass(!type && !savedOnly)}>
            All
          </button>
          <button type="button" aria-pressed={savedOnly} onClick={() => update({ saved: savedOnly ? null : '1' })} className={chipClass(savedOnly)}>
            Saved
          </button>
          {entityTypes.map((t) =>
          <button key={t.id} type="button" aria-pressed={type === t.id} onClick={() => update({ type: type === t.id ? null : t.id })} className={chipClass(type === t.id)}>
              {t.label}
            </button>
          )}
        </div>

        {results.length ?
        <>
            <p className="mt-4 text-sm text-muted" aria-live="polite">
              {results.length} result{results.length > 1 ? 's' : ''} already checked on PadiCheck
            </p>
            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-3xl bg-surface">
              {results.map((e) =>
            <EntityRow key={e.id} entity={e} />
            )}
            </ul>
          </> :

        <StateView
          kind="no-result"
          className="mt-4"
          title={q ? `No checks found for “${q}”` : 'Nothing matches these filters'}
          body="Run a fresh check — we’ll search verified records, reports and public sources."
          action={
          <Link to={`/verify/${type ?? 'business'}?q=${encodeURIComponent(q)}`} className="inline-flex h-12 items-center rounded-2xl bg-brand px-6 font-semibold text-white">
                Check Now
              </Link>
          } />

        }
        <p className="mt-4 text-xs text-muted">Search only covers entities and businesses. People can only be found through a check with lawful sources.</p>
      </div>
    </>);

}