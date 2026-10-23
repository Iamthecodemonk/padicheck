import React, { useState } from 'react';
import { toast } from 'sonner';
import { ReceiptIcon } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { PlanPicker } from '../../components/billing/PlanPicker';
import { PageHeader } from '../../components/consumer/PageHeader';
import { useTrust } from '../../contexts/TrustContext';
import { planById } from '../../data/plans';
import { track } from '../../utils/analytics';
import { formatDate, formatNaira } from '../../utils/checks';
import type { Invoice } from '../../types/trust';

const invoiceTone = { paid: 'bg-brand-soft text-brand-dark', failed: 'bg-danger-soft text-danger', refunded: 'bg-canvas text-muted' };

export function Billing() {
  const { subscription, setSubscription, invoices } = useTrust();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [receipt, setReceipt] = useState<Invoice | null>(null);
  const plan = planById(subscription.planId);
  const paid = plan && plan.monthly > 0;

  return (
    <>
      <PageHeader title="Subscription & billing" back="/account" />
      <div className="mx-auto w-full max-w-5xl space-y-8 px-4 pb-10 lg:px-10">
        <section aria-labelledby="current-heading" className="rounded-3xl bg-surface p-5 md:p-6">
          <h2 id="current-heading" className="text-sm font-medium text-muted">
            Current plan
          </h2>
          <div className="mt-1 flex flex-wrap items-end gap-x-6 gap-y-3">
            <div className="flex-1">
              <p className="text-3xl font-bold text-ink">{plan?.name ?? 'Free'}</p>
              <p className="mt-1 text-ink-soft">
                {subscription.status === 'cancelled' ?
                `Cancelled — access until ${formatDate(subscription.renewsAt)}` :
                paid ?
                `${formatNaira(subscription.period === 'monthly' ? plan.monthly : plan.yearly)} / ${subscription.period === 'monthly' ? 'month' : 'year'} · renews ${formatDate(subscription.renewsAt)}` :
                'No payment needed'}
              </p>
            </div>
            {paid && subscription.status === 'active' &&
            <button type="button" onClick={() => setCancelOpen(true)} className="h-11 rounded-xl px-4 text-sm font-semibold text-danger ring-1 ring-line hover:bg-danger-soft">
                Cancel plan
              </button>
            }
            {subscription.status === 'cancelled' &&
            <button
              type="button"
              onClick={() => {
                setSubscription({ ...subscription, status: 'active' });
                toast.success('Your plan will renew as normal');
              }}
              className="h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-white">
              
                Resume plan
              </button>
            }
          </div>
        </section>

        <section aria-labelledby="plans-heading">
          <h2 id="plans-heading" className="mb-4 text-xl font-bold text-ink">
            Change plan
          </h2>
          <PlanPicker audience="consumer" signedIn />
        </section>

        <section aria-labelledby="history-heading">
          <h2 id="history-heading" className="text-xl font-bold text-ink">
            Billing history
          </h2>
          <table className="mt-3 w-full overflow-hidden rounded-3xl bg-surface text-left">
            <caption className="sr-only">Invoices</caption>
            <thead className="hidden text-sm text-muted md:table-header-group">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Date</th>
                <th scope="col" className="px-5 py-3 font-medium">Description</th>
                <th scope="col" className="px-5 py-3 font-medium">Amount</th>
                <th scope="col" className="px-5 py-3 font-medium">Status</th>
                <th scope="col" className="px-5 py-3"><span className="sr-only">Receipt</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {invoices.map((i) =>
              <tr key={i.id} className="flex flex-wrap items-center gap-x-3 px-5 py-3 md:table-row md:px-0">
                  <td className="w-full text-sm text-muted md:w-auto md:px-5 md:py-3">{formatDate(i.at)}</td>
                  <td className="flex-1 font-medium text-ink md:px-5 md:py-3">{i.label}</td>
                  <td className="font-semibold text-ink md:px-5 md:py-3">{formatNaira(i.amountNaira)}</td>
                  <td className="md:px-5 md:py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${invoiceTone[i.status]}`}>{i.status}</span>
                  </td>
                  <td className="md:px-5 md:py-3">
                    <button type="button" onClick={() => setReceipt(i)} aria-label={`View receipt ${i.id}`} className="grid h-11 w-11 place-items-center rounded-xl text-muted hover:bg-canvas hover:text-ink">
                      <ReceiptIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      <ConfirmSheet
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => {
          setSubscription({ ...subscription, status: 'cancelled' });
          track('subscription_cancelled', { plan: subscription.planId });
          toast('Plan cancelled', { description: `You keep access until ${formatDate(subscription.renewsAt)}.` });
          setCancelOpen(false);
        }}
        title="Cancel your plan?"
        description={`You’ll keep ${plan?.name} until ${formatDate(subscription.renewsAt)}, then move to Free. Saved checks stay safe.`}
        confirmLabel="Cancel plan"
        tone="danger" />
      
      <BottomSheet open={receipt !== null} onClose={() => setReceipt(null)} title={`Receipt ${receipt?.id ?? ''}`}>
        {receipt &&
        <div>
            <dl className="divide-y divide-line rounded-2xl bg-canvas text-sm">
              {[
            ['Date', formatDate(receipt.at)],
            ['Description', receipt.label],
            ['Paid with', receipt.method],
            ['Amount', formatNaira(receipt.amountNaira)],
            ['VAT (7.5%, included)', formatNaira(Math.round(receipt.amountNaira * 0.0698))],
            ['Status', receipt.status]].
            map(([k, v]) =>
            <div key={k} className="flex justify-between gap-4 p-3.5">
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-medium capitalize text-ink">{v}</dd>
                </div>
            )}
            </dl>
            <button type="button" onClick={() => window.print()} className="mt-4 h-12 w-full rounded-2xl font-semibold text-ink ring-1 ring-line">
              Download invoice
            </button>
          </div>
        }
      </BottomSheet>
    </>);

}