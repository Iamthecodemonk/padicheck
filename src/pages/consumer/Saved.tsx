import React from 'react';
import { BookmarkIcon } from 'lucide-react';
import { PageHeader } from '../../components/consumer/PageHeader';
import { ResultRow } from '../../components/consumer/ResultRow';
import { SavedEntities } from '../../components/trust/SavedEntities';
import { useUser } from '../../contexts/UserContext';
import { useOpenCheck } from '../../hooks/useOpenCheck';
import { results } from '../../data/results';

export function Saved() {
  const { savedIds } = useUser();
  const openCheck = useOpenCheck();
  const saved = results.filter((r) => savedIds.includes(r.id));

  return (
    <>
      <PageHeader title="Saved" />
      <div className="mx-auto w-full max-w-3xl px-4 lg:px-10">
        <SavedEntities />
        {saved.length > 0 && <h2 className="mb-1 font-semibold text-ink">Saved reports</h2>}
        {saved.length === 0 ?
        <div className="mt-6 flex flex-col items-center rounded-3xl bg-surface px-6 py-12 text-center">
            <BookmarkIcon className="h-8 w-8 text-muted" aria-hidden="true" />
            <p className="mt-3 font-semibold text-ink">Nothing saved yet</p>
            <p className="mt-1 max-w-xs text-sm text-muted">Save a report to keep it handy — saved reports open even without a connection.</p>
            <button type="button" onClick={openCheck} className="mt-5 h-12 rounded-2xl bg-ink px-6 font-semibold text-white hover:bg-ink-soft">
              Start a check
            </button>
          </div> :

        <>
            <p className="text-sm text-muted">Saved reports are kept on this device, so you can open them offline.</p>
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-3xl bg-surface">
              {saved.map((r) =>
            <ResultRow key={r.id} result={{ ...r, availableOffline: true }} />
            )}
            </ul>
          </>
        }
      </div>
    </>);

}