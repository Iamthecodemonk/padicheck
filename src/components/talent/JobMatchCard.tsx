import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheckIcon, BookmarkIcon, CheckIcon, MapPinIcon, ShieldQuestionIcon, TriangleAlertIcon } from 'lucide-react';
import { formatWhen } from '../../utils/checks';
import { matchTone } from '../../utils/talentMatch';
import type { JobListing, Match } from '../../types/talent';

interface JobMatchCardProps {
  match: Match<JobListing>;
  saved: boolean;
  onToggleSave: () => void;
}

export function JobMatchCard({ match, saved, onToggleSave }: JobMatchCardProps) {
  const job = match.item;
  const checkText = `${job.title} at ${job.company}, ${job.location} (${job.mode}). Salary ${job.salary}. ${job.description}`;

  return (
    <article className="rounded-3xl bg-surface p-5 ring-1 ring-line">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold leading-snug text-ink">{job.title}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[15px] text-ink-soft">
            {job.company}
            {job.verifiedEmployer ?
            <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-dark">
                <BadgeCheckIcon className="h-4 w-4" aria-hidden="true" /> Verified employer
              </span> :

            <span className="inline-flex items-center gap-1 text-sm font-medium text-caution">
                <ShieldQuestionIcon className="h-4 w-4" aria-hidden="true" /> Not verified
              </span>
            }
          </p>
        </div>
        <span className={`shrink-0 rounded-2xl px-3 py-1.5 text-center ${matchTone(match.score)}`}>
          <span className="block text-xl font-bold leading-none">{match.score}%</span>
          <span className="text-[11px] font-semibold">match</span>
        </span>
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <span className="inline-flex items-center gap-1">
          <MapPinIcon className="h-4 w-4" aria-hidden="true" /> {job.location} · {job.mode}
        </span>
        <span className="font-semibold text-ink">{job.salary}</span>
        <span>Posted {formatWhen(job.postedAt)}</span>
      </p>

      {!job.verifiedEmployer &&
      <p className="mt-3 flex gap-2 rounded-2xl bg-caution-soft px-3 py-2.5 text-sm text-caution">
          <TriangleAlertIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          We couldn’t verify this employer. Never pay a fee to get a job — check it before you apply.
        </p>
      }

      {match.reasons.length > 0 &&
      <ul className="mt-4 space-y-1.5">
          {match.reasons.slice(0, 3).map((r) =>
        <li key={r} className="flex gap-2 text-sm text-ink">
              <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={3} aria-hidden="true" /> {r}
            </li>
        )}
        </ul>
      }
      {match.missing.length > 0 && <p className="mt-2 text-sm text-muted">To strengthen: {match.missing.join(', ')}</p>}

      <div className="mt-5 flex gap-2">
        <Link
          to={`/check/job?mode=text&text=${encodeURIComponent(checkText)}`}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-dark">
          
          Check this job
        </Link>
        <button
          type="button"
          aria-pressed={saved}
          onClick={onToggleSave}
          className={`inline-flex h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold ring-1 transition-colors ${saved ? 'bg-brand-soft text-brand-dark ring-brand' : 'text-ink ring-line hover:bg-canvas'}`}>
          
          <BookmarkIcon className="h-4 w-4" fill={saved ? 'currentColor' : 'none'} aria-hidden="true" /> {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </article>);

}