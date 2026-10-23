import React, { useState } from 'react';
import { toast } from 'sonner';
import { BadgeCheckIcon, FlagIcon } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { Field } from '../../components/admin/Field';
import { Stars } from '../../components/trust/ReviewList';
import { StateView } from '../../components/trust/StateView';
import { useTrust } from '../../contexts/TrustContext';
import { formatDate } from '../../utils/checks';
import { chipClass, primaryButton, textareaClass } from '../../utils/formStyles';
import type { Review } from '../../types/trust';

type Filter = 'all' | 'unanswered' | 'flagged';

export function BusinessReviews() {
  const { myBusiness, reviews, saveReview } = useTrust();
  const [filter, setFilter] = useState<Filter>('all');
  const [replying, setReplying] = useState<Review | null>(null);
  const [reply, setReply] = useState('');
  const mine = reviews.filter((r) => r.businessId === myBusiness.id && r.status !== 'removed');
  const list = mine.filter((r) => filter === 'unanswered' ? !r.response && r.status === 'published' : filter === 'flagged' ? r.status === 'flagged' : true);
  const published = mine.filter((r) => r.status === 'published');
  const avg = published.length ? published.reduce((s, r) => s + r.rating, 0) / published.length : 0;

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-center gap-4 rounded-3xl bg-surface p-5">
        <p className="text-4xl font-bold text-ink">{avg ? avg.toFixed(1) : '—'}</p>
        <div>
          <Stars rating={Math.round(avg)} size="h-5 w-5" />
          <p className="text-sm text-muted">{published.length} published reviews</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        {(['all', 'unanswered', 'flagged'] as const).map((f) =>
        <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={chipClass(filter === f)}>
            {f === 'all' ? 'All' : f === 'unanswered' ? 'Needs reply' : 'Reported'}
          </button>
        )}
      </div>
      {list.length === 0 ?
      <StateView kind="empty" className="mt-4" title="No reviews here" /> :

      <ul className="mt-4 space-y-3">
          {list.map((r) =>
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
              </div>
              <p className="mt-2 text-ink-soft">{r.text}</p>
              {r.status === 'flagged' && <p className="mt-2 text-sm font-medium text-caution">Under moderation: {r.flagReason}</p>}
              {r.response &&
          <div className="mt-3 rounded-2xl bg-canvas p-3.5">
                  <p className="text-xs font-semibold text-muted">Your reply</p>
                  <p className="mt-1 text-sm text-ink">{r.response}</p>
                </div>
          }
              <div className="mt-3 flex gap-2">
                <button
              type="button"
              onClick={() => {
                setReplying(r);
                setReply(r.response ?? '');
              }}
              className="h-11 rounded-xl px-4 text-sm font-semibold text-brand-dark ring-1 ring-line hover:bg-canvas">
              
                  {r.response ? 'Edit reply' : 'Reply'}
                </button>
                {r.status === 'published' &&
            <button
              type="button"
              onClick={() => {
                saveReview({ ...r, status: 'flagged', flagReason: 'Reported by the business' });
                toast.success('Sent to moderators', { description: 'It stays visible until a moderator decides.' });
              }}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-muted ring-1 ring-line hover:bg-canvas">
              
                    <FlagIcon className="h-4 w-4" aria-hidden="true" /> Report
                  </button>
            }
              </div>
            </li>
        )}
        </ul>
      }
      <BottomSheet
        open={replying !== null}
        onClose={() => setReplying(null)}
        title={`Reply to ${replying?.author}`}
        description="Replies are public. Be polite and specific — it builds trust."
        footer={
        <button
          type="button"
          disabled={reply.trim().length < 5}
          onClick={() => {
            if (replying) saveReview({ ...replying, response: reply.trim() });
            setReplying(null);
            toast.success('Reply published');
          }}
          className={`${primaryButton} w-full`}>
          
            Publish reply
          </button>
        }>
        
        <Field label="Your reply">
          <textarea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} className={textareaClass} />
        </Field>
      </BottomSheet>
    </div>);

}