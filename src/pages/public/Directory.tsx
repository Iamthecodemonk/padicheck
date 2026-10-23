import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeftIcon, PlusIcon, SearchIcon, StoreIcon } from 'lucide-react';
import { DirectoryCard } from '../../components/directory/DirectoryCard';
import { StateView } from '../../components/trust/StateView';
import { useTrust } from '../../contexts/TrustContext';
import { DIRECTORY_FEE, categoryBySlug, directoryCategories } from '../../data/directory';
import { usePageMeta } from '../../hooks/usePageMeta';
import { track } from '../../utils/analytics';
import { formatNaira } from '../../utils/checks';
import { isListed, ratingFor } from '../../utils/directory';
import { chipClass } from '../../utils/formStyles';

type Sort = 'recommended' | 'rating' | 'score';

/** Explore Businesses: browse listed businesses by category, search, and open their profile and reviews. */
export function Directory() {
  const { category } = useParams<{category?: string;}>();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { businesses, reviews } = useTrust();
  const cat = categoryBySlug(category);
  const [q, setQ] = useState(params.get('q') ?? '');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('recommended');

  usePageMeta({
    title: cat ? `${cat.label} businesses on PadiCheck` : 'Explore businesses',
    description: 'Find listed and verified Nigerian businesses, read reviews and check their Trust Score before you pay.',
    structuredData: { '@type': 'CollectionPage', name: cat ? `${cat.label} — PadiCheck Directory` : 'PadiCheck Business Directory' }
  });

  useEffect(() => track('directory_viewed', { category: category ?? 'all' }), [category]);

  const listed = useMemo(() => businesses.filter((b) => isListed(b)), [businesses]);
  const counts = useMemo(() => Object.fromEntries(directoryCategories.map((c) => [c.slug, listed.filter((b) => b.category === c.label).length])), [listed]);

  const term = q.trim().toLowerCase();
  const showResults = Boolean(cat || term);
  const results = useMemo(() => {
    const list = listed.
    filter((b) => !cat || b.category === cat.label).
    filter((b) => !verifiedOnly || b.verification === 'verified').
    filter((b) => !term || `${b.name} ${b.category} ${b.location} ${b.description}`.toLowerCase().includes(term)).
    map((b) => ({ b, rating: ratingFor(b.id, reviews) }));
    return list.sort((x, y) => {
      if (sort === 'rating') return y.rating.avg - x.rating.avg || y.rating.count - x.rating.count;
      if (sort === 'score') return y.b.score - x.b.score;
      const vx = x.b.verification === 'verified' ? 1 : 0;
      const vy = y.b.verification === 'verified' ? 1 : 0;
      return vy - vx || y.rating.avg * Math.log2(y.rating.count + 2) - x.rating.avg * Math.log2(x.rating.count + 2);
    });
  }, [listed, cat, verifiedOnly, term, sort, reviews]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setParams(q.trim() ? { q: q.trim() } : {});
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 lg:px-10 lg:pt-12">
      {cat ?
      <Link to="/directory" className="-ml-2 inline-flex h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" /> All categories
        </Link> :
      null}
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">{cat ? cat.label : 'Explore businesses'}</h1>
          <p className="mt-2 text-lg text-ink-soft">
            {cat ? `${counts[cat.slug] ?? 0} listed businesses. Read reviews and check their Trust Score before you pay.` : 'Find businesses listed on PadiCheck, read real reviews, and check before you trust.'}
          </p>
        </div>
        <Link to="/directory/register" className="inline-flex h-12 shrink-0 items-center gap-2 self-start rounded-2xl px-5 font-semibold text-ink ring-1 ring-line hover:bg-surface lg:self-auto">
          <PlusIcon className="h-4 w-4" aria-hidden="true" /> List your business
        </Link>
      </header>

      <form onSubmit={submitSearch} role="search" className="mt-6 flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Search businesses</span>
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={cat ? `Search ${cat.label.toLowerCase()}` : 'Business name, service or city'}
            className="h-14 w-full rounded-2xl bg-surface pl-12 pr-4 text-[17px] text-ink outline-none ring-1 ring-line placeholder:text-muted/80 focus:ring-2 focus:ring-brand" />
          
        </label>
        <button type="submit" className="h-14 shrink-0 rounded-2xl bg-brand px-6 font-semibold text-white hover:bg-brand-dark">
          Search
        </button>
      </form>

      {!showResults &&
      <section aria-labelledby="cats-h" className="mt-10">
          <h2 id="cats-h" className="text-lg font-semibold text-ink">
            Browse by category
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {directoryCategories.map((c) =>
          <li key={c.slug}>
                <Link to={`/directory/${c.slug}`} className="flex h-full flex-col gap-3 rounded-3xl bg-surface p-4 ring-1 ring-line transition-colors hover:ring-brand">
                  <span className={`grid h-11 w-11 place-items-center rounded-2xl ${c.tile}`}>
                    <c.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-semibold leading-snug text-ink">{c.label}</span>
                    <span className="block text-sm text-muted">{counts[c.slug] ? `${counts[c.slug]} listed` : 'Be the first'}</span>
                  </span>
                </Link>
              </li>
          )}
          </ul>
        </section>
      }

      {showResults ?
      <section aria-labelledby="results-h" className="mt-8">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="results-h" className="mr-auto text-sm font-medium text-muted" aria-live="polite">
              {results.length} {results.length === 1 ? 'business' : 'businesses'}
              {term ? ` for “${q.trim()}”` : ''}
            </h2>
            <button type="button" aria-pressed={verifiedOnly} onClick={() => setVerifiedOnly((v) => !v)} className={chipClass(verifiedOnly)}>
              Verified only
            </button>
            <label className="inline-flex items-center gap-2 text-sm text-muted">
              Sort
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-11 rounded-xl bg-surface px-3 text-ink ring-1 ring-line">
                <option value="recommended">Recommended</option>
                <option value="rating">Highest rated</option>
                <option value="score">Trust Score</option>
              </select>
            </label>
          </div>
          {results.length === 0 ?
        <StateView
          kind="no-result"
          className="mt-6"
          title={term ? `No listed businesses match “${q.trim()}”` : 'No businesses listed here yet'}
          body="Not listed doesn’t mean unsafe — or safe. Run a business check to see what we can find."
          action={
          <div className="flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={() => navigate(`/verify/business${term ? `?q=${encodeURIComponent(q.trim())}` : ''}`)} className="inline-flex h-12 items-center rounded-2xl bg-brand px-6 font-semibold text-white">
                    Check a business
                  </button>
                  <Link to="/directory/register" className="inline-flex h-12 items-center rounded-2xl px-6 font-semibold text-ink ring-1 ring-line">
                    List your business
                  </Link>
                </div>
          } /> :


        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map(({ b, rating }) =>
          <li key={b.id}>
                  <DirectoryCard business={b} rating={rating} />
                </li>
          )}
            </ul>
        }
        </section> :

      <section aria-labelledby="own-h" className="mt-12 grid gap-6 rounded-[28px] bg-brand-soft p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-8">
          <div className="flex gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand text-white">
              <StoreIcon className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h2 id="own-h" className="text-xl font-bold text-ink">
                Own a business? Get listed for {formatNaira(DIRECTORY_FEE)} a year
              </h2>
              <p className="mt-1 text-ink-soft">A public profile with your contacts, opening hours and customer reviews — approved by our team so customers know you’re real.</p>
            </div>
          </div>
          <Link to="/directory/register" className="inline-flex h-12 items-center justify-center rounded-2xl bg-brand px-6 font-semibold text-white hover:bg-brand-dark">
            List your business
          </Link>
        </section>
      }
    </div>);

}