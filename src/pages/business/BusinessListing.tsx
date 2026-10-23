import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { CircleAlertIcon, ClockIcon, ExternalLinkIcon, StoreIcon } from 'lucide-react';
import { CheckoutSheet } from '../../components/billing/CheckoutSheet';
import { useTrust } from '../../contexts/TrustContext';
import { DIRECTORY_FEE, directoryBenefits } from '../../data/directory';
import { formatDate, formatNaira } from '../../utils/checks';
import { isListed, ratingFor, YEAR_MS } from '../../utils/directory';
import { primaryButton, secondaryButton } from '../../utils/formStyles';

/** Business portal: directory listing status, renewal and history. */
export function BusinessListing() {
  const { myBusiness: b, saveBusiness, addInvoice, notify, reviews } = useTrust();
  const [renewOpen, setRenewOpen] = useState(false);
  const d = b.directory;
  const live = isListed(b);
  const expired = d?.status === 'active' && !live;
  const daysLeft = d?.expiresAt ? Math.ceil((new Date(d.expiresAt).getTime() - Date.now()) / 86_400_000) : null;
  const rating = ratingFor(b.id, reviews);

  if (!d) {
    return (
      <section className="grid gap-8 rounded-[28px] bg-surface p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-8">
        <div>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand-dark">
            <StoreIcon className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-2xl font-bold text-ink">Get {b.name} into Explore Businesses</h2>
          <p className="mt-1 text-ink-soft">{formatNaira(DIRECTORY_FEE)} a year. Approved by our team, with a public page for reviews.</p>
          <ul className="mt-5 grid gap-4 sm:grid-cols-3">
            {directoryBenefits.map((x) =>
            <li key={x.title}>
                <p className="font-semibold text-ink">{x.title}</p>
                <p className="text-sm text-ink-soft">{x.text}</p>
              </li>
            )}
          </ul>
        </div>
        <Link to="/directory/register" className={primaryButton}>
          List my business
        </Link>
      </section>);

  }

  const renew = (method: string, reference: string) => {
    const now = Date.now();
    const from = d.expiresAt && new Date(d.expiresAt).getTime() > now ? new Date(d.expiresAt).getTime() : now;
    const expiresAt = new Date(from + YEAR_MS).toISOString();
    saveBusiness({ ...b, directory: { ...d, status: 'active', paidAt: new Date(now).toISOString(), reference, expiresAt } });
    addInvoice({ id: reference, label: `Directory renewal · ${b.name} · 1 year`, amountNaira: DIRECTORY_FEE, status: 'paid', method, at: new Date(now).toISOString() });
    notify({ category: 'subscription', title: 'Directory listing renewed', body: `Live until ${formatDate(expiresAt)}.`, to: '/business/listing' });
    toast.success('Listing renewed');
  };

  const status = expired ?
  { label: 'Expired', tone: 'bg-danger-soft text-danger', icon: CircleAlertIcon, text: 'Your listing is hidden from Explore Businesses. Renew to show it again — your reviews are kept.' } :
  d.status === 'pending' ?
  { label: 'Awaiting approval', tone: 'bg-sky-soft text-sky', icon: ClockIcon, text: 'Payment received. A moderator checks that the details are real — usually within 1 working day.' } :
  d.status === 'rejected' ?
  { label: 'Not approved', tone: 'bg-danger-soft text-danger', icon: CircleAlertIcon, text: d.note ?? 'Your listing wasn’t approved. Your payment has been refunded.' } :
  d.status === 'suspended' ?
  { label: 'Suspended', tone: 'bg-danger-soft text-danger', icon: CircleAlertIcon, text: d.note ?? 'Your listing is hidden while we review new information.' } :
  { label: 'Live', tone: 'bg-brand-soft text-brand-dark', icon: StoreIcon, text: `Visible in Explore Businesses under ${b.category}.` };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-3xl bg-surface p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold text-ink">Directory listing</h2>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${status.tone}`}>
            <status.icon className="h-4 w-4" aria-hidden="true" /> {status.label}
          </span>
        </div>
        <p className="mt-2 text-ink-soft">{status.text}</p>
        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted">Submitted</dt>
            <dd className="font-semibold text-ink">{formatDate(d.submittedAt)}</dd>
          </div>
          <div>
            <dt className="text-muted">Approved</dt>
            <dd className="font-semibold text-ink">{d.approvedAt ? formatDate(d.approvedAt) : '—'}</dd>
          </div>
          <div>
            <dt className="text-muted">{expired ? 'Expired' : 'Renews'}</dt>
            <dd className={`font-semibold ${daysLeft !== null && daysLeft <= 30 ? 'text-caution' : 'text-ink'}`}>{d.expiresAt ? formatDate(d.expiresAt) : 'After approval'}</dd>
          </div>
          <div>
            <dt className="text-muted">Fee</dt>
            <dd className="font-semibold text-ink">{formatNaira(d.feeNaira)} / year</dd>
          </div>
        </dl>
        {daysLeft !== null && daysLeft > 0 && daysLeft <= 30 && <p className="mt-4 rounded-2xl bg-caution-soft p-3 text-sm text-caution">Your listing ends in {daysLeft} days. Renew now so customers can keep finding you.</p>}
        <div className="mt-6 flex flex-wrap gap-2">
          {live &&
          <Link to={`/b/${b.slug}`} className={secondaryButton}>
              <ExternalLinkIcon className="h-4 w-4" aria-hidden="true" /> View public listing
            </Link>
          }
          {(live || expired) &&
          <button type="button" onClick={() => setRenewOpen(true)} className={primaryButton}>
              Renew for {formatNaira(DIRECTORY_FEE)}
            </button>
          }
          {d.status === 'rejected' &&
          <Link to="/business/profile" className={primaryButton}>
              Update details
            </Link>
          }
          <Link to="/business/profile" className={secondaryButton}>
            Edit listing details
          </Link>
        </div>
      </section>
      <aside className="space-y-4">
        <section className="rounded-3xl bg-surface p-5">
          <h3 className="text-sm font-medium text-muted">Reviews on your listing</h3>
          <p className="mt-1 text-3xl font-bold text-ink">{rating.count ? rating.avg.toFixed(1) : '—'}</p>
          <p className="text-sm text-muted">{rating.count} published reviews</p>
          <Link to="/business/reviews" className="mt-3 inline-flex h-11 items-center text-sm font-semibold text-brand-dark">
            Reply to reviews
          </Link>
        </section>
        {b.verification !== 'verified' &&
        <section className="rounded-3xl bg-brand-soft p-5">
            <p className="font-semibold text-ink">Add the Verified badge</p>
            <p className="mt-1 text-sm text-ink-soft">Verified businesses are shown first in their category.</p>
            <Link to="/business/verification" className="mt-3 inline-flex h-11 items-center text-sm font-semibold text-brand-dark">
              Start verification
            </Link>
          </section>
        }
      </aside>
      <CheckoutSheet open={renewOpen} onClose={() => setRenewOpen(false)} title="Renew directory listing" description={`${b.name} · 12 more months`} amountNaira={DIRECTORY_FEE} onPaid={renew} />
    </div>);

}