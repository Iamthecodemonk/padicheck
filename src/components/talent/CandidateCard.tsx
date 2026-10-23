import React from 'react';
import { BadgeCheckIcon, CheckIcon, MapPinIcon, StarIcon } from 'lucide-react';
import { educationLabel, matchTone } from '../../utils/talentMatch';
import type { Candidate, Match } from '../../types/talent';

interface CandidateCardProps {
  match: Match<Candidate>;
  shortlisted: boolean;
  introRequested: boolean;
  onToggleShortlist: () => void;
  onRequestIntro: () => void;
}

export function CandidateCard({ match, shortlisted, introRequested, onToggleShortlist, onRequestIntro }: CandidateCardProps) {
  const c = match.item;
  const initials = c.name.split(' ').map((p) => p[0]).join('').slice(0, 2);

  return (
    <article className="rounded-3xl bg-surface p-5 ring-1 ring-line">
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-violet-soft font-semibold text-violet">{initials}</span>
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-1.5 text-lg font-semibold leading-snug text-ink">
            {c.name}
            {c.verifiedId && <BadgeCheckIcon className="h-5 w-5 text-brand" aria-label="ID verified" />}
          </h3>
          <p className="text-[15px] text-ink-soft">{c.headline}</p>
        </div>
        <span className={`shrink-0 rounded-2xl px-3 py-1.5 text-center ${matchTone(match.score)}`}>
          <span className="block text-xl font-bold leading-none">{match.score}%</span>
          <span className="text-[11px] font-semibold">match</span>
        </span>
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <span className="inline-flex items-center gap-1">
          <MapPinIcon className="h-4 w-4" aria-hidden="true" /> {c.location}
        </span>
        <span>{educationLabel(c.education)}</span>
        <span>Available {c.availability === 'Immediately' ? 'now' : `in ${c.availability}`}</span>
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {c.skills.map((s) => {
          const hit = match.matched.includes(s);
          return (
            <span key={s} className={`inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-semibold ${hit ? 'bg-brand-soft text-brand-dark' : 'bg-canvas text-muted'}`}>
              {hit && <CheckIcon className="h-3 w-3" strokeWidth={3} aria-hidden="true" />}
              {s}
            </span>);

        })}
      </div>
      {c.certifications.length > 0 && <p className="mt-3 text-sm text-ink-soft">Certified: {c.certifications.join(', ')}</p>}
      {match.missing.length > 0 && <p className="mt-1 text-sm text-muted">Doesn’t yet have: {match.missing.join(', ')}</p>}

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onRequestIntro}
          disabled={introRequested}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:bg-brand-soft disabled:text-brand-dark">
          
          {introRequested ? 'Intro requested' : 'Request intro'}
        </button>
        <button
          type="button"
          aria-pressed={shortlisted}
          onClick={onToggleShortlist}
          className={`inline-flex h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold ring-1 transition-colors ${shortlisted ? 'bg-amber-soft text-amber ring-amber' : 'text-ink ring-line hover:bg-canvas'}`}>
          
          <StarIcon className="h-4 w-4" fill={shortlisted ? 'currentColor' : 'none'} aria-hidden="true" /> {shortlisted ? 'Shortlisted' : 'Shortlist'}
        </button>
      </div>
    </article>);

}