import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheckIcon, BotIcon, MessageSquareWarningIcon, TriangleAlertIcon } from 'lucide-react';
import { usePageMeta } from '../../hooks/usePageMeta';
import { howSteps } from '../../data/marketing';

const details = [
'Tell us what you’re about to trust: a phone number, business, website, person, property, job, social profile or listing.',
'We gather signals from registries, public sources, community reports, reviews and our AI risk models.',
'Anything confirmed by an authorised source is marked Verified. Everything else is labelled with where it came from.',
'Categories such as identity, reports and history are combined into a 0–100 score with a confidence level.',
'You get a recommendation in plain language and can save, share or download the report — or report a problem.'];


const labels = [
{ icon: BadgeCheckIcon, title: 'Verified information', body: 'Confirmed through an official or authorised source.', tone: 'bg-brand-soft text-brand-dark' },
{ icon: MessageSquareWarningIcon, title: 'User reports', body: 'From people who dealt with them, reviewed by moderators.', tone: 'bg-sky-soft text-sky' },
{ icon: BotIcon, title: 'AI risk signals', body: 'Patterns linked to risk. Never presented as facts.', tone: 'bg-violet-soft text-violet' },
{ icon: TriangleAlertIcon, title: 'Possible warnings', body: 'Things you should check yourself before you commit.', tone: 'bg-caution-soft text-caution' }];


export function HowItWorks() {
  usePageMeta({ title: 'How PadiCheck works', description: 'Search, analyse, verify, score, decide — how a PadiCheck check works.' });
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 lg:px-10 lg:pt-16">
      <h1 className="text-4xl font-bold text-ink sm:text-5xl">How PadiCheck works</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">Five steps, usually in under a minute.</p>
      <ol className="mt-10 space-y-0">
        {howSteps.map((s, i) =>
        <li key={s.title} className="relative grid grid-cols-[48px_minmax(0,1fr)] gap-5 pb-10 last:pb-0">
            {i < howSteps.length - 1 && <span className="absolute left-6 top-12 h-[calc(100%-48px)] w-px bg-line" aria-hidden="true" />}
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-white">
              <s.icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="pt-1">
              <h2 className="text-xl font-semibold text-ink">{s.title}</h2>
              <p className="mt-1 max-w-2xl text-ink-soft">{details[i]}</p>
            </div>
          </li>
        )}
      </ol>
      <section aria-labelledby="labels" className="mt-16">
        <h2 id="labels" className="text-2xl font-bold text-ink">Every result is labelled</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {labels.map((l) =>
          <li key={l.title} className="rounded-3xl bg-surface p-5">
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${l.tone}`}>
                <l.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-3 font-semibold text-ink">{l.title}</h3>
              <p className="mt-1 text-sm text-muted">{l.body}</p>
            </li>
          )}
        </ul>
      </section>
      <Link to="/verify" className="mt-12 inline-flex h-14 items-center rounded-2xl bg-brand px-8 text-base font-semibold text-white hover:bg-brand-dark">
        Check Now
      </Link>
    </div>);

}