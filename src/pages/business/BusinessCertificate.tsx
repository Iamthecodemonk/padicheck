import React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { BadgeCheckIcon, CopyIcon, ExternalLinkIcon, PrinterIcon } from 'lucide-react';
import { QrCode } from '../../components/trust/QrCode';
import { StateView } from '../../components/trust/StateView';
import { useTrust } from '../../contexts/TrustContext';
import { formatDate } from '../../utils/checks';

export function BusinessCertificate() {
  const { myBusiness: b } = useTrust();

  if (b.verification !== 'verified' || !b.certificateId) {
    return (
      <StateView
        kind="forbidden"
        title="Your certificate unlocks after verification"
        body="Once our team verifies your business you’ll get a certificate, a QR code and a badge to share."
        action={
        <Link to="/business/verification" className="inline-flex h-12 items-center rounded-2xl bg-brand px-6 font-semibold text-white">
            Go to verification
          </Link>
        }
        className="mb-10" />);


  }

  const url = `${window.location.origin}/certificate/${b.certificateId}`;
  const badge = `<a href="${url}" target="_blank" rel="noopener">PadiCheck Verified · ${b.name}</a>`;
  const copy = async (text: string, label: string) => {
    await navigator.clipboard?.writeText(text);
    toast.success(`${label} copied`);
  };

  return (
    <div className="grid gap-6 pb-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section aria-label="Certificate" className="rounded-[28px] bg-surface p-6 ring-1 ring-line md:p-8">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-dark">
          <BadgeCheckIcon className="h-4 w-4" aria-hidden="true" /> {b.tier}
        </p>
        <h2 className="mt-4 text-3xl font-bold text-ink">{b.name}</h2>
        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
          {[
          ['Verification ID', b.certificateId],
          ['Status', 'Active'],
          ['Verified on', b.verifiedAt ? formatDate(b.verifiedAt) : '—'],
          ['Trust Score', `${b.score} / 100`]].
          map(([k, v]) =>
          <div key={k}>
              <dt className="text-muted">{k}</dt>
              <dd className="font-semibold text-ink">{v}</dd>
            </div>
          )}
        </dl>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link to={`/certificate/${b.certificateId}`} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-brand px-5 font-semibold text-white">
            <ExternalLinkIcon className="h-4 w-4" aria-hidden="true" /> Open certificate
          </Link>
          <button type="button" onClick={() => copy(url, 'Verification link')} className="inline-flex h-12 items-center gap-2 rounded-2xl px-5 font-semibold text-ink ring-1 ring-line">
            <CopyIcon className="h-4 w-4" aria-hidden="true" /> Copy link
          </button>
        </div>
        <h3 className="mt-8 font-semibold text-ink">Website badge</h3>
        <p className="text-sm text-muted">Paste this into your website. It always shows your live status.</p>
        <pre className="mt-2 overflow-x-auto rounded-2xl bg-canvas p-4 text-xs text-ink">
          <code>{badge}</code>
        </pre>
        <button type="button" onClick={() => copy(badge, 'Badge code')} className="mt-2 h-11 rounded-xl px-3 text-sm font-semibold text-brand-dark">
          Copy code
        </button>
      </section>
      <aside className="self-start rounded-[28px] bg-surface p-6 text-center">
        <QrCode value={url} size={200} label={`QR code for ${b.name} verification`} />
        <p className="mt-3 font-semibold text-ink">Your QR code</p>
        <p className="text-sm text-muted">Print it on receipts, vans and your shopfront. Scanning opens your live verification page.</p>
        <button type="button" onClick={() => window.print()} className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-semibold text-ink ring-1 ring-line">
          <PrinterIcon className="h-4 w-4" aria-hidden="true" /> Print QR & certificate
        </button>
      </aside>
    </div>);

}