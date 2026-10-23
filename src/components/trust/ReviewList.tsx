import React, { useState } from 'react';
import { toast } from 'sonner';
import { BadgeCheckIcon, FlagIcon, StarIcon } from 'lucide-react';
import { BottomSheet } from '../BottomSheet';
import { useTrust } from '../../contexts/TrustContext';
import { formatDate } from '../../utils/checks';
import { chipClass } from '../../utils/formStyles';
import type { Review } from '../../types/trust';

export function Stars({ rating, size = 'h-4 w-4' }: {rating: number;size?: string;}) {
  return (
    <span className="inline-flex gap-0.5 text-amber" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) =>
      <StarIcon key={i} className={size} fill={i <= rating ? 'currentColor' : 'none'} aria-hidden="true" />
      )}
    </span>);

}

const flagReasons = ['Spam or advertising', 'Offensive language', 'Not a genuine customer', 'Contains personal information'];

/** Public review list with "report review". Business replies are shown inline. */
export function ReviewList({ reviews }: {reviews: Review[];}) {
  const { saveReview } = useTrust();
  const [flagging, setFlagging] = useState<Review | null>(null);
  const [reason, setReason] = useState(flagReasons[0]);

  if (!reviews.length) return <p className="rounded-3xl bg-surface p-6 text-center text-muted">No reviews yet.</p>;

  return (
    <>
      <ul className="space-y-3">
        {reviews.map((r) =>
        <li key={r.id} className="rounded-3xl bg-surface p-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Stars rating={r.rating} />
              <span className="font-semibold text-ink">{r.author}</span>
              {r.verifiedTransaction &&
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-dark">
                  <BadgeCheckIcon className="h-3.5 w-3.5" aria-hidden="true" /> Verified transaction
                </span>
            }
              <span className="text-sm text-muted">{formatDate(r.at)}</span>
              <button type="button" onClick={() => setFlagging(r)} aria-label={`Report review by ${r.author}`} className="ml-auto grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-canvas hover:text-ink">
                <FlagIcon className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-[15px] text-ink-soft">{r.text}</p>
            {r.response &&
          <div className="mt-3 rounded-2xl bg-canvas p-3.5">
                <p className="text-xs font-semibold text-muted">Response from the business</p>
                <p className="mt-1 text-sm text-ink">{r.response}</p>
              </div>
          }
          </li>
        )}
      </ul>
      <BottomSheet
        open={flagging !== null}
        onClose={() => setFlagging(null)}
        title="Report this review"
        description="Our moderators will check it against the review guidelines."
        footer={
        <button
          type="button"
          onClick={() => {
            if (flagging) saveReview({ ...flagging, status: 'flagged', flagReason: reason });
            setFlagging(null);
            toast.success('Thanks — the review has been sent for moderation');
          }}
          className="h-12 w-full rounded-2xl bg-brand font-semibold text-white">
          
            Report review
          </button>
        }>
        
        <div className="flex flex-wrap gap-2">
          {flagReasons.map((x) =>
          <button key={x} type="button" aria-pressed={reason === x} onClick={() => setReason(x)} className={chipClass(reason === x)}>
              {x}
            </button>
          )}
        </div>
      </BottomSheet>
    </>);

}