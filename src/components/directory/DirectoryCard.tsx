import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheckIcon, MapPinIcon } from 'lucide-react';
import { Stars } from '../trust/ReviewList';
import { categoryForBusiness } from '../../data/directory';
import { scoreBand } from '../../utils/trustScore';
import type { Business } from '../../types/trust';

interface DirectoryCardProps {
  business: Business;
  rating: {avg: number;count: number;};
}

/** One business in Explore Businesses. Verification is shown separately from the listing itself. */
export function DirectoryCard({ business: b, rating }: DirectoryCardProps) {
  const cat = categoryForBusiness(b.category);
  const band = scoreBand(b.score);
  const verified = b.verification === 'verified';
  return (
    <Link to={`/b/${b.slug}`} className="flex h-full flex-col rounded-3xl bg-surface p-5 ring-1 ring-line transition-colors hover:ring-brand">
      <div className="flex items-start gap-3">
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-lg font-bold ${cat.tile}`} aria-hidden="true">
          {b.name[0]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{b.name}</p>
          <p className="truncate text-sm text-muted">{b.category}</p>
        </div>
        <span className="shrink-0 text-right">
          <span className="block text-lg font-bold tabular-nums text-ink">{b.score}</span>
          <span className={`block text-[11px] font-semibold ${band.text}`}>Trust Score</span>
        </span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-ink-soft">{b.description}</p>
      <div className="mt-auto pt-4">
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <MapPinIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{b.location}</span>
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-sm text-muted">
            <Stars rating={Math.round(rating.avg)} size="h-3.5 w-3.5" />
            {rating.count ? `${rating.avg.toFixed(1)} (${rating.count})` : 'No reviews yet'}
          </span>
          {verified ?
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark">
              <BadgeCheckIcon className="h-3.5 w-3.5" aria-hidden="true" /> Verified
            </span> :

          <span className="shrink-0 rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-muted">Listed</span>
          }
        </div>
      </div>
    </Link>);

}