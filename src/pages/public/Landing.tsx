import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRightIcon, BadgeCheckIcon, QrCodeIcon, SearchIcon, StarIcon } from 'lucide-react';
import { ScoreGauge } from '../../components/trust/ScoreGauge';
import { usePageMeta } from '../../hooks/usePageMeta';
import { entityTypes } from '../../data/entityTypes';
import { howSteps, popularChecks, safetyTips, testimonials, whyPoints } from '../../data/marketing';
import { defaultBands, scoreBand } from '../../utils/trustScore';
import type { EntityType } from '../../types/trust';

export function Landing() {
  const navigate = useNavigate();
  const [type, setType] = useState<EntityType>('phone');
  const [q, setQ] = useState('');
  const meta = entityTypes.find((t) => t.id === type)!;

  usePageMeta({
    title: 'PadiCheck — Check Before You Trust',
    description: 'Verify people, businesses, websites and opportunities before you buy, pay or engage.',
    path: '/',
    structuredData: { '@type': 'Organization', name: 'PadiCheck', url: 'https://padicheck.com', slogan: 'Check Before You Trust' }
  });

  return (
    <>
      {/* Hero + main check interface */}
      <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-12 pt-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center lg:px-10 lg:pt-16">
        <div>
          <h1 className="text-[40px] font-bold leading-[1.05] tracking-tight text-ink sm:text-6xl">
            Check Before <span className="text-brand-dark">You Trust.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-soft">Verify people, businesses, websites and opportunities before you buy, pay or engage.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/verify" className="inline-flex h-14 items-center gap-2 rounded-2xl bg-brand px-7 text-base font-semibold text-white hover:bg-brand-dark">
              Check Now <ArrowRightIcon className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link to="/for-business" className="inline-flex h-14 items-center rounded-2xl px-7 text-base font-semibold text-ink ring-1 ring-line hover:bg-surface">
              Verify Your Business
            </Link>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate(`/verify/${type}${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
          }}
          className="rounded-[28px] bg-surface p-5 ring-1 ring-line md:p-6"
          aria-label="Start a check">
          
          <h2 className="text-lg font-semibold text-ink">What do you want to check?</h2>
          <div role="radiogroup" aria-label="Check type" className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
            {entityTypes.map((t) =>
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={type === t.id}
              onClick={() => setType(t.id)}
              className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${type === t.id ? 'bg-brand text-white' : 'bg-canvas text-ink hover:bg-line/60'}`}>
              
                <t.icon className="h-4 w-4" aria-hidden="true" /> {t.label}
              </button>
            )}
          </div>
          <label htmlFor="hero-q" className="mt-5 block text-sm font-medium text-ink">
            {meta.inputLabel}
          </label>
          <div className="mt-1.5 flex gap-2">
            <input id="hero-q" value={q} onChange={(e) => setQ(e.target.value)} inputMode={meta.inputMode} placeholder={meta.placeholder} className="h-14 min-w-0 flex-1 rounded-2xl bg-canvas px-4 text-[17px] text-ink outline-none ring-1 ring-line placeholder:text-muted/80 focus:ring-2 focus:ring-brand" />
            <button type="submit" aria-label="Check Now" className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand text-white hover:bg-brand-dark">
              <SearchIcon className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-3 text-sm text-muted">{meta.why}</p>
        </form>
      </section>

      {/* What PadiCheck checks */}
      <section aria-labelledby="checks-heading" className="mx-auto max-w-6xl px-4 py-12 lg:px-10">
        <h2 id="checks-heading" className="text-3xl font-bold text-ink">What PadiCheck checks</h2>
        <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {entityTypes.map((t) =>
          <li key={t.id}>
              <Link to={`/verify/${t.id}`} className="flex h-full flex-col gap-3 rounded-3xl bg-surface p-5 transition-colors hover:bg-line/40">
                <span className={`grid h-11 w-11 place-items-center rounded-2xl ${t.tile}`}>
                  <t.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="font-semibold text-ink">{t.label}</span>
                <span className="text-sm leading-snug text-muted">{t.examples[0]}</span>
              </Link>
            </li>
          )}
        </ul>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-heading" className="bg-surface py-14">
        <div className="mx-auto max-w-6xl px-4 lg:px-10">
          <h2 id="how-heading" className="text-3xl font-bold text-ink">How it works</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-5">
            {howSteps.map((s, i) =>
            <li key={s.title} className="relative">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand-dark">
                  <s.icon className="h-6 w-6" aria-hidden="true" />
                </span>
                {i < howSteps.length - 1 && <span className="absolute left-14 right-0 top-6 hidden h-px bg-line md:block" aria-hidden="true" />}
                <h3 className="mt-4 font-semibold text-ink">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>
              </li>
            )}
          </ol>
        </div>
      </section>

      {/* Trust Score */}
      <section aria-labelledby="score-heading" className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center lg:px-10">
        <ScoreGauge score={82} />
        <div>
          <h2 id="score-heading" className="text-3xl font-bold text-ink">One score. Clear reasons.</h2>
          <p className="mt-3 max-w-xl text-ink-soft">The PadiCheck Score runs from 0 to 100. Every score comes with the signals behind it, a confidence level and a recommendation in plain language.</p>
          <ul className="mt-6 grid gap-2 sm:grid-cols-5">
            {defaultBands.map((b, i) => {
              const band = scoreBand(b.min);
              const max = i === 0 ? 100 : defaultBands[i - 1].min - 1;
              return (
                <li key={b.label} className={`rounded-2xl p-3 ${band.soft}`}>
                  <span className="block text-sm font-bold">
                    {b.min}–{max}
                  </span>
                  <span className="block text-sm font-medium">{b.label}</span>
                </li>);

            })}
          </ul>
        </div>
      </section>

      {/* Popular checks */}
      <section aria-labelledby="popular-heading" className="mx-auto max-w-6xl px-4 py-10 lg:px-10">
        <h2 id="popular-heading" className="text-3xl font-bold text-ink">Popular checks</h2>
        <ul className="mt-6 grid gap-3 md:grid-cols-2">
          {popularChecks.map((p) => {
            const t = entityTypes.find((x) => x.id === p.type)!;
            return (
              <li key={p.q}>
                <Link to={`/verify/${p.type}?q=${encodeURIComponent(p.q)}`} className="flex items-center gap-4 rounded-3xl bg-surface p-5 transition-colors hover:bg-line/40">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${t.tile}`}>
                    <t.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">{p.label}</span>
                    <span className="block truncate text-sm text-muted">{p.q}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-ink-soft">{p.result}</span>
                </Link>
              </li>);

          })}
        </ul>
      </section>

      {/* Business verification */}
      <section aria-labelledby="biz-heading" className="mx-auto max-w-6xl px-4 py-10 lg:px-10">
        <div className="grid gap-8 rounded-[32px] bg-brand-soft p-6 md:p-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <h2 id="biz-heading" className="text-3xl font-bold text-ink">Run a business? Get verified.</h2>
            <p className="mt-3 max-w-xl text-ink-soft">Show customers you’re real with a PadiCheck Verified badge, a shareable profile, a digital certificate and a QR code they can scan.</p>
            <Link to="/for-business" className="mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-brand px-6 font-semibold text-white hover:bg-brand-dark">
              Get Verified <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="flex items-center gap-4 rounded-3xl bg-surface p-5">
            <BadgeCheckIcon className="h-12 w-12 text-brand" aria-hidden="true" />
            <div>
              <p className="font-semibold text-ink">PadiCheck Verified</p>
              <p className="text-sm text-muted">Lekki Prime Homes Ltd · 91</p>
            </div>
            <QrCodeIcon className="ml-4 h-10 w-10 text-ink" aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* Why */}
      <section aria-labelledby="why-heading" className="mx-auto max-w-6xl px-4 py-12 lg:px-10">
        <h2 id="why-heading" className="text-3xl font-bold text-ink">Why PadiCheck</h2>
        <div className="mt-6 grid gap-8 md:grid-cols-3">
          {whyPoints.map((w) =>
          <div key={w.title}>
              <w.icon className="h-7 w-7 text-brand" aria-hidden="true" />
              <h3 className="mt-3 text-lg font-semibold text-ink">{w.title}</h3>
              <p className="mt-1 text-ink-soft">{w.body}</p>
            </div>
          )}
        </div>
      </section>

      {/* Safety education */}
      <section aria-labelledby="safety-heading" className="bg-surface py-14">
        <div className="mx-auto max-w-6xl px-4 lg:px-10">
          <h2 id="safety-heading" className="text-3xl font-bold text-ink">Stay safe — four rules that stop most scams</h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {safetyTips.map((t) =>
            <li key={t.title} className="border-l-2 border-brand pl-4">
                <h3 className="font-semibold text-ink">{t.title}</h3>
                <p className="mt-1 text-sm text-muted">{t.body}</p>
              </li>
            )}
          </ol>
        </div>
      </section>

      {/* Testimonials */}
      <section aria-labelledby="reviews-heading" className="mx-auto max-w-6xl px-4 py-14 lg:px-10">
        <h2 id="reviews-heading" className="text-3xl font-bold text-ink">People who checked first</h2>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {testimonials.map((t) =>
          <li key={t.name} className="flex flex-col rounded-3xl bg-surface p-6">
              <div className="flex gap-0.5 text-amber" aria-label="5 out of 5 stars">
                {[0, 1, 2, 3, 4].map((i) =>
              <StarIcon key={i} className="h-4 w-4" fill="currentColor" aria-hidden="true" />
              )}
              </div>
              <blockquote className="mt-3 flex-1 text-ink">“{t.quote}”</blockquote>
              <p className="mt-4 text-sm font-semibold text-ink">{t.name}</p>
              <p className="text-sm text-muted">{t.role}</p>
            </li>
          )}
        </ul>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 lg:px-10">
        <div className="rounded-[32px] bg-ink px-6 py-12 text-center md:py-16">
          <h2 className="text-3xl font-bold text-canvas md:text-4xl">About to pay someone? Check first.</h2>
          <p className="mx-auto mt-3 max-w-lg text-canvas/80">It takes less than a minute, and your first checks are free.</p>
          <Link to="/verify" className="mt-8 inline-flex h-14 items-center rounded-2xl bg-brand px-8 text-base font-semibold text-white hover:bg-brand-dark">
            Check Now
          </Link>
        </div>
      </section>
    </>);

}