import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { LoaderCircleIcon, MoreVerticalIcon, RefreshCwIcon, Share2Icon, Trash2Icon, ExternalLinkIcon } from 'lucide-react';
import { BottomSheet } from '../BottomSheet';
import { EntityRow } from './EntityRow';
import { usePwa } from '../../contexts/PwaContext';
import { useTrust } from '../../contexts/TrustContext';
import { refreshEntity } from '../../utils/trustApi';
import type { TrustEntity } from '../../types/trust';

/** Saved trust checks with change indicators and open / refresh / share / remove actions. */
export function SavedEntities() {
  const { savedEntityIds, getEntity, toggleSavedEntity, upsertEntity } = useTrust();
  const { online } = usePwa();
  const [active, setActive] = useState<TrustEntity | null>(null);
  const [busy, setBusy] = useState(false);
  const saved = savedEntityIds.map(getEntity).filter((e): e is TrustEntity => Boolean(e));

  if (!saved.length) return null;

  const refresh = async () => {
    if (!active) return;
    setBusy(true);
    try {
      upsertEntity(await refreshEntity(active));
      toast.success(`${active.name} refreshed`);
      setActive(null);
    } catch {
      toast.error('Couldn’t refresh — check your connection');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="saved-entities-heading" className="mb-8">
      <h2 id="saved-entities-heading" className="font-semibold text-ink">
        Saved checks
      </h2>
      <p className="text-sm text-muted">We’ll notify you when a saved score changes.</p>
      <ul className="mt-3 divide-y divide-line overflow-hidden rounded-3xl bg-surface">
        {saved.map((e) =>
        <EntityRow
          key={e.id}
          entity={e}
          showChange
          actions={
          <button type="button" aria-label={`Actions for ${e.name}`} onClick={() => setActive(e)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-canvas hover:text-ink">
                <MoreVerticalIcon className="h-5 w-5" />
              </button>
          } />

        )}
      </ul>
      <BottomSheet open={active !== null} onClose={() => setActive(null)} title={active?.name ?? ''}>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl ring-1 ring-line">
          <li>
            <Link to={`/report/${active?.id}`} className="flex h-14 items-center gap-3 px-4 font-medium text-ink hover:bg-canvas">
              <ExternalLinkIcon className="h-5 w-5 text-muted" aria-hidden="true" /> Open report
            </Link>
          </li>
          <li>
            <button type="button" disabled={!online || busy} onClick={refresh} className="flex h-14 w-full items-center gap-3 px-4 font-medium text-ink hover:bg-canvas disabled:opacity-50">
              {busy ? <LoaderCircleIcon className="h-5 w-5 animate-spin text-muted" aria-hidden="true" /> : <RefreshCwIcon className="h-5 w-5 text-muted" aria-hidden="true" />}
              {online ? 'Refresh now' : 'Refresh (needs a connection)'}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard?.writeText(`${window.location.origin}/report/${active?.id}`);
                toast.success('Link copied');
                setActive(null);
              }}
              className="flex h-14 w-full items-center gap-3 px-4 font-medium text-ink hover:bg-canvas">
              
              <Share2Icon className="h-5 w-5 text-muted" aria-hidden="true" /> Copy share link
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                if (active) toggleSavedEntity(active.id);
                toast('Removed from saved');
                setActive(null);
              }}
              className="flex h-14 w-full items-center gap-3 px-4 font-medium text-danger hover:bg-canvas">
              
              <Trash2Icon className="h-5 w-5" aria-hidden="true" /> Remove
            </button>
          </li>
        </ul>
      </BottomSheet>
    </section>);

}