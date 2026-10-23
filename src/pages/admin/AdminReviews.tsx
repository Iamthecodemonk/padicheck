import React, { useState } from 'react';
import { toast } from 'sonner';
import { BadgeCheckIcon } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { LockedNotice } from '../../components/admin/LockedNotice';
import { SegmentedTabs } from '../../components/admin/SegmentedTabs';
import { ReasonSheet } from '../../components/admin/trust/ReasonSheet';
import { Stars } from '../../components/trust/ReviewList';
import { StateView } from '../../components/trust/StateView';
import { useAdminSession } from '../../contexts/AdminSessionContext';
import { useTrust } from '../../contexts/TrustContext';
import { formatWhen } from '../../utils/checks';
import type { Review } from '../../types/trust';

type Tab = Review['status'];

export function AdminReviews() {
  const { reviews, saveReview, businesses } = useTrust();
  const { permissions, log } = useAdminSession();
  const canAct = permissions.moderateReviews;
  const [tab, setTab] = useState<Tab>('flagged');
  const [removing, setRemoving] = useState<Review | null>(null);
  const list = reviews.filter((r) => r.status === tab).sort((a, b) => b.at.localeCompare(a.at));
  const bizName = (id: string) => businesses.find((b) => b.id === id)?.name ?? 'Unknown business';

  return (
    <>
      <AdminPageHeader title="Reviews" subtitle="Moderate reported reviews against the review guidelines" />
      <div className="space-y-4 px-4 md:px-8">
        {!canAct && <LockedNotice text="Your role can view reviews but can’t moderate them." />}
        <SegmentedTabs
          label="Review status"
          value={tab}
          onChange={setTab}
          tabs={[
          { id: 'flagged', label: 'Reported', count: reviews.filter((r) => r.status === 'flagged').length },
          { id: 'published', label: 'Published', count: reviews.filter((r) => r.status === 'published').length },
          { id: 'removed', label: 'Removed', count: reviews.filter((r) => r.status === 'removed').length }]
          } />
        
        {list.length === 0 ?
        <StateView kind="empty" title={tab === 'flagged' ? 'No reported reviews' : 'No reviews here'} /> :

        <ul className="grid gap-3 lg:grid-cols-2">
            {list.map((r) =>
          <li key={r.id} className="flex flex-col rounded-3xl bg-surface p-5">
                <p className="text-sm font-semibold text-muted">{bizName(r.businessId)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Stars rating={r.rating} />
                  <span className="font-semibold text-ink">{r.author}</span>
                  {r.verifiedTransaction &&
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-dark">
                      <BadgeCheckIcon className="h-3.5 w-3.5" aria-hidden="true" /> Verified transaction
                    </span>
              }
                  <span className="text-sm text-muted">{formatWhen(r.at)}</span>
                </div>
                <p className="mt-2 text-ink-soft">{r.text}</p>
                {r.flagReason && <p className="mt-2 text-sm font-medium text-caution">{r.status === 'removed' ? 'Removed' : 'Reported'}: {r.flagReason}</p>}
                {r.response && <p className="mt-2 rounded-2xl bg-canvas p-3 text-sm text-ink">Business reply: {r.response}</p>}
                {canAct &&
            <div className="mt-auto flex gap-2 pt-4">
                    {r.status !== 'published' &&
              <button
                type="button"
                onClick={() => {
                  saveReview({ ...r, status: 'published', flagReason: undefined });
                  log('trust', r.status === 'removed' ? 'Restored review' : 'Kept reported review', `${bizName(r.businessId)} · review by ${r.author}`);
                  toast.success('Review published');
                }}
                className="h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-white">
                
                        {r.status === 'removed' ? 'Restore' : 'Keep review'}
                      </button>
              }
                    {r.status !== 'removed' &&
              <button type="button" onClick={() => setRemoving(r)} className="h-11 rounded-xl px-4 text-sm font-semibold text-danger ring-1 ring-line hover:bg-danger-soft">
                        Remove
                      </button>
              }
                  </div>
            }
              </li>
          )}
          </ul>
        }
      </div>
      <ReasonSheet
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="Remove this review"
        description="It disappears from the business profile and stops counting towards the Trust Score."
        confirmLabel="Remove review"
        tone="danger"
        label="Which guideline does it break?"
        onConfirm={(reason) => {
          if (removing) {
            saveReview({ ...removing, status: 'removed', flagReason: reason });
            log('trust', 'Removed review', `${bizName(removing.businessId)} · review by ${removing.author} — ${reason}`);
          }
          setRemoving(null);
          toast('Review removed');
        }} />
      
    </>);

}