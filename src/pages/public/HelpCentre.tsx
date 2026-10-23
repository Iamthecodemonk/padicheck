import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDownIcon, SearchIcon } from 'lucide-react';
import { StateView } from '../../components/trust/StateView';
import { usePlatform } from '../../contexts/PlatformContext';
import { usePageMeta } from '../../hooks/usePageMeta';
import { helpArticles, helpCategories } from '../../data/marketing';
import { chipClass } from '../../utils/formStyles';

export function HelpCentre() {
  usePageMeta({ title: 'Help Centre', description: 'Answers about checks, verification, reports, payments, privacy and the API.' });
  const { docs } = usePlatform();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [open, setOpen] = useState<string | null>(null);
  const cmsHelp = docs.filter((d) => d.kind === 'help' && d.version > 0);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return helpArticles.filter((a) => (cat === 'all' || a.category === cat) && (!term || `${a.q} ${a.a}`.toLowerCase().includes(term)));
  }, [q, cat]);

  return (
    <div className="mx-auto max-w-4xl px-4 pt-10 lg:px-10 lg:pt-16">
      <h1 className="text-4xl font-bold text-ink">How can we help?</h1>
      <label className="mt-6 flex h-14 items-center gap-3 rounded-2xl bg-surface px-4 ring-1 ring-line focus-within:ring-2 focus-within:ring-brand">
        <SearchIcon className="h-5 w-5 text-muted" aria-hidden="true" />
        <span className="sr-only">Search help</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for answers" className="h-full min-w-0 flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-muted/80" />
      </label>
      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        <button type="button" aria-pressed={cat === 'all'} onClick={() => setCat('all')} className={chipClass(cat === 'all')}>
          All
        </button>
        {helpCategories.map((c) =>
        <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={chipClass(cat === c)}>
            {c}
          </button>
        )}
      </div>

      {list.length ?
      <ul className="mt-6 divide-y divide-line overflow-hidden rounded-3xl bg-surface">
          {list.map((a) => {
          const expanded = open === a.id;
          return (
            <li key={a.id}>
                <h2>
                  <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : a.id)} className="flex min-h-[64px] w-full items-center gap-3 px-5 py-3 text-left">
                    <span className="flex-1">
                      <span className="block font-semibold text-ink">{a.q}</span>
                      <span className="text-sm text-muted">{a.category}</span>
                    </span>
                    <ChevronDownIcon className={`h-5 w-5 shrink-0 text-muted transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                </h2>
                {expanded && <p className="px-5 pb-5 leading-relaxed text-ink-soft">{a.a}</p>}
              </li>);

        })}
        </ul> :

      <StateView kind="no-result" className="mt-6" title={`No answers for “${q}”`} body="Try different words, or contact us and we’ll help." action={<Link to="/contact" className="inline-flex h-12 items-center rounded-2xl bg-brand px-6 font-semibold text-white">Contact us</Link>} />
      }

      {cmsHelp.length > 0 &&
      <section aria-labelledby="guides" className="mt-10">
          <h2 id="guides" className="text-xl font-bold text-ink">Guides</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {cmsHelp.map((d) =>
          <li key={d.id}>
                <Link to={`/legal/${d.slug}`} className="block rounded-3xl bg-surface p-5 hover:bg-line/40">
                  <span className="block font-semibold text-ink">{d.title}</span>
                  <span className="block text-sm text-muted">{d.summary}</span>
                </Link>
              </li>
          )}
          </ul>
        </section>
      }
    </div>);

}