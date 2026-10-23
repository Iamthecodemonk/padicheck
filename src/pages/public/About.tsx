import React from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../../hooks/usePageMeta';
import { howSteps, whyPoints } from '../../data/marketing';

const blocks = [
{ title: 'Our mission', body: 'Make it easy for anyone to check before they trust — so fewer people lose money, time or safety to people and businesses that aren’t who they say they are.' },
{ title: 'Our vision', body: 'A trust layer for everyday commerce across Africa, used by consumers, marketplaces, property platforms, recruiters, fintechs and enterprises.' },
{ title: 'The problem', body: 'More buying, renting and hiring happens through WhatsApp, Instagram and marketplaces than ever. It’s hard to tell a real vendor, agent or employer from a convincing fake — and the cost of getting it wrong falls on ordinary people.' },
{ title: 'Our solution', body: 'PadiCheck brings verified records, community reports, reviews and AI risk signals into one clear PadiCheck Score, with the reasons behind it. Honest businesses can get verified and prove they’re real.' }];


const principles = [
'We clearly separate verified facts, user reports and AI signals.',
'AI never makes a final moderation or legal decision without a person reviewing it.',
'Everyone has a right to respond — businesses can dispute inaccurate information.',
'We only use information that is lawful to process, and never sell personal data.',
'Scores are guidance. The final decision always belongs to you.'];


export function About() {
  usePageMeta({ title: 'About PadiCheck', description: 'Our mission is to help everyone check before they trust.' });
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 lg:px-10 lg:pt-16">
      <h1 className="max-w-3xl text-4xl font-bold leading-tight text-ink sm:text-5xl">Trust should be something you can check.</h1>
      <div className="mt-12 grid gap-10 md:grid-cols-2">
        {blocks.map((b) =>
        <section key={b.title}>
            <h2 className="text-xl font-semibold text-ink">{b.title}</h2>
            <p className="mt-2 leading-relaxed text-ink-soft">{b.body}</p>
          </section>
        )}
      </div>

      <section aria-labelledby="philosophy" className="mt-16 rounded-[28px] bg-surface p-6 md:p-10">
        <h2 id="philosophy" className="text-2xl font-bold text-ink">Our trust philosophy</h2>
        <div className="mt-6 grid gap-8 md:grid-cols-3">
          {whyPoints.map((w) =>
          <div key={w.title}>
              <w.icon className="h-6 w-6 text-brand" aria-hidden="true" />
              <h3 className="mt-2 font-semibold text-ink">{w.title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{w.body}</p>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="how" className="mt-16">
        <h2 id="how" className="text-2xl font-bold text-ink">How PadiCheck works</h2>
        <p className="mt-2 text-ink-soft">{howSteps.map((s) => s.title).join(' → ')}</p>
        <Link to="/how-it-works" className="mt-3 inline-flex h-11 items-center font-semibold text-brand-dark">
          See the full process
        </Link>
      </section>

      <section aria-labelledby="principles" className="mt-12">
        <h2 id="principles" className="text-2xl font-bold text-ink">Safety principles</h2>
        <ol className="mt-4 space-y-3">
          {principles.map((p, i) =>
          <li key={p} className="flex gap-4 text-ink-soft">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand-dark">{i + 1}</span>
              <span className="pt-1">{p}</span>
            </li>
          )}
        </ol>
      </section>
    </div>);

}