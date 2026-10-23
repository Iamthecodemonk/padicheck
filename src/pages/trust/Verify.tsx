import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRightIcon } from 'lucide-react';
import { PageHeader } from '../../components/consumer/PageHeader';
import { EntityRow } from '../../components/trust/EntityRow';
import { useTrust } from '../../contexts/TrustContext';
import { entityTypes } from '../../data/entityTypes';

export function Verify() {
  const { myCheckIds, getEntity } = useTrust();
  const recent = myCheckIds.map(getEntity).filter((e): e is NonNullable<typeof e> => Boolean(e)).slice(0, 4);

  return (
    <>
      <PageHeader title="Check Now" back="/" />
      <div className="mx-auto w-full max-w-6xl px-4 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12 lg:px-10">
        <section aria-labelledby="what-heading">
          <h2 id="what-heading" className="text-[26px] font-bold leading-tight text-ink lg:text-4xl">
            What do you want to check?
          </h2>
          <p className="mt-2 max-w-xl text-ink-soft">Check before you trust. Pick what you’re about to buy from, pay, hire, rent or meet.</p>
          <ul className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {entityTypes.map((t) =>
            <li key={t.id}>
                <Link
                to={`/verify/${t.id}`}
                className="flex h-full min-h-[112px] flex-col justify-between gap-3 rounded-3xl bg-surface p-4 ring-1 ring-line transition-colors hover:bg-canvas">
                
                  <span className={`grid h-11 w-11 place-items-center rounded-2xl ${t.tile}`}>
                    <t.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-semibold text-ink">{t.label}</span>
                    <span className="block text-xs text-muted">
                      {t.credits} credit{t.credits > 1 ? 's' : ''}
                    </span>
                  </span>
                </Link>
              </li>
            )}
          </ul>
        </section>

        <aside className="mt-8 lg:mt-14" aria-labelledby="recent-trust-heading">
          <div className="flex items-center justify-between">
            <h2 id="recent-trust-heading" className="font-semibold text-ink">
              Your recent checks
            </h2>
            <Link to="/search" className="-mr-2 inline-flex h-11 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-brand-dark hover:bg-surface">
              Search <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          {recent.length ?
          <ul className="mt-1 divide-y divide-line overflow-hidden rounded-3xl bg-surface">
              {recent.map((e) =>
            <EntityRow key={e.id} entity={e} />
            )}
            </ul> :

          <p className="mt-2 rounded-3xl bg-surface p-6 text-center text-sm text-muted">Your checks will appear here.</p>
          }
        </aside>
      </div>
    </>);

}