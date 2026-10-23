import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { BadgeCheckIcon, CheckIcon, CircleXIcon, FileUpIcon, HourglassIcon, LoaderCircleIcon, TriangleAlertIcon } from 'lucide-react';
import { useTrust } from '../../contexts/TrustContext';
import { requiredDocuments } from '../../data/businessPortal';
import { track } from '../../utils/analytics';
import { formatDate } from '../../utils/checks';
import { chipClass, primaryButton, secondaryButton } from '../../utils/formStyles';
import { submit } from '../../utils/trustApi';
import type { BusinessDocument, VerificationTier } from '../../types/trust';

const tiers: {id: VerificationTier;hint: string;}[] = [
{ id: 'Basic Verification', hint: 'Registration and owner identity' },
{ id: 'Verified Business', hint: '+ address and directors. Includes certificate & QR' },
{ id: 'Business Pro', hint: '+ ongoing monitoring and team access' }];


export function BusinessVerification() {
  const { myBusiness: b, saveBusiness, notify } = useTrust();
  const [step, setStep] = useState(0);
  const [tier, setTier] = useState<VerificationTier>(b.tier);
  const [docs, setDocs] = useState<Record<string, string>>(Object.fromEntries(b.documents.map((d) => [d.kind, d.name])));
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const needed = requiredDocuments.filter((d) => tier !== 'Basic Verification' || d.kind !== 'Address');

  const send = async () => {
    if (!confirm) return setError('Please confirm the details are accurate');
    setBusy(true);
    setError('');
    try {
      await submit(null, 1200);
      const documents: BusinessDocument[] = needed.map((d) => ({ name: docs[d.kind], kind: d.kind, status: 'pending' }));
      saveBusiness({ ...b, tier, documents, verification: 'review', submittedAt: new Date().toISOString(), infoRequest: undefined });
      notify({ category: 'verification', title: 'Verification submitted', body: 'Our team usually reviews within 2 working days.', to: '/business/verification' });
      track('business_verification_started', { tier });
      toast.success('Submitted for review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t submit. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (b.verification === 'verified') {
    return (
      <div className="max-w-2xl rounded-3xl bg-brand-soft p-6 pb-8" role="status">
        <BadgeCheckIcon className="h-10 w-10 text-brand-dark" aria-hidden="true" />
        <h2 className="mt-3 text-2xl font-bold text-ink">You’re PadiCheck Verified</h2>
        <p className="mt-1 text-ink-soft">
          {b.tier} since {b.verifiedAt ? formatDate(b.verifiedAt) : 'today'}. We re-verify every 12 months, and sooner if your details change.
        </p>
        <Link to="/business/certificate" className={`${primaryButton} mt-5`}>
          Get your certificate & QR
        </Link>
      </div>);

  }

  if (b.verification === 'review') {
    return (
      <div className="max-w-2xl space-y-4 pb-10">
        <div className="rounded-3xl bg-sky-soft p-6" role="status">
          <HourglassIcon className="h-9 w-9 text-sky" aria-hidden="true" />
          <h2 className="mt-3 text-2xl font-bold text-ink">We’re reviewing your documents</h2>
          <p className="mt-1 text-ink-soft">Submitted {b.submittedAt ? formatDate(b.submittedAt) : 'today'}. Most reviews finish within 2 working days — we’ll notify you.</p>
        </div>
        <ul className="divide-y divide-line rounded-3xl bg-surface">
          {b.documents.map((d) =>
          <li key={d.kind} className="flex items-center gap-3 px-5 py-4">
              <span className="flex-1">
                <span className="block font-medium text-ink">{d.kind}</span>
                <span className="block text-sm text-muted">{d.name}</span>
              </span>
              <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold capitalize text-muted">{d.status}</span>
            </li>
          )}
        </ul>
      </div>);

  }

  const banner =
  b.verification === 'info' ?
  <p className="mb-5 flex gap-2 rounded-2xl bg-caution-soft p-4 text-caution" role="alert">
        <TriangleAlertIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> {b.infoRequest ?? 'Our team needs more information.'} Update your documents and resubmit.
      </p> :
  b.verification === 'rejected' || b.verification === 'suspended' ?
  <p className="mb-5 flex gap-2 rounded-2xl bg-danger-soft p-4 text-danger" role="alert">
        <CircleXIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> {b.infoRequest ?? 'Your verification wasn’t approved.'} You can fix the issue and apply again.
      </p> :
  null;

  const steps = ['Plan', 'Documents', 'Review & submit'];

  return (
    <div className="max-w-2xl pb-10">
      {banner}
      <ol className="mb-6 flex gap-2" aria-label="Verification steps">
        {steps.map((s, i) =>
        <li key={s} className="flex flex-1 flex-col gap-1.5" aria-current={i === step ? 'step' : undefined}>
            <span className={`h-1.5 rounded-full ${i <= step ? 'bg-brand' : 'bg-line'}`} />
            <span className={`text-sm ${i === step ? 'font-semibold text-ink' : 'text-muted'}`}>{s}</span>
          </li>
        )}
      </ol>

      {step === 0 &&
      <fieldset>
          <legend className="text-xl font-bold text-ink">Choose your verification</legend>
          <div className="mt-4 space-y-2">
            {tiers.map((t) =>
          <button key={t.id} type="button" aria-pressed={tier === t.id} onClick={() => setTier(t.id)} className={`flex w-full items-center gap-3 rounded-2xl p-4 text-left ring-1 transition-colors ${tier === t.id ? 'bg-brand-soft ring-2 ring-brand' : 'bg-surface ring-line'}`}>
                <span className="flex-1">
                  <span className="block font-semibold text-ink">{t.id}</span>
                  <span className="block text-sm text-muted">{t.hint}</span>
                </span>
                {tier === t.id && <CheckIcon className="h-5 w-5 text-brand-dark" aria-hidden="true" />}
              </button>
          )}
          </div>
          <button type="button" onClick={() => setStep(1)} className={`${primaryButton} mt-6`}>
            Continue
          </button>
        </fieldset>
      }

      {step === 1 &&
      <section>
          <h2 className="text-xl font-bold text-ink">Upload documents</h2>
          <p className="mt-1 text-sm text-muted">Clear photos or PDFs, up to 10 MB each. Only our verification team can see them.</p>
          <ul className="mt-4 space-y-3">
            {needed.map((d) =>
          <li key={d.kind} className="rounded-2xl bg-surface p-4">
                <div className="flex items-center gap-3">
                  <span className="flex-1">
                    <span className="block font-medium text-ink">{d.label}</span>
                    <span className="block text-sm text-muted">{docs[d.kind] ?? d.hint}</span>
                  </span>
                  <input
                ref={(el) => fileRefs.current[d.kind] = el}
                type="file"
                accept="image/*,.pdf"
                className="sr-only"
                aria-label={d.label}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 10 * 1024 * 1024) return toast.error(`${f.name} is over 10 MB`);
                  setDocs((x) => ({ ...x, [d.kind]: f.name }));
                }} />
              
                  <button type="button" onClick={() => fileRefs.current[d.kind]?.click()} className={docs[d.kind] ? chipClass(false) : chipClass(true)}>
                    {docs[d.kind] ? <CheckIcon className="h-4 w-4 text-brand" aria-hidden="true" /> : <FileUpIcon className="h-4 w-4" aria-hidden="true" />}
                    {docs[d.kind] ? 'Replace' : 'Upload'}
                  </button>
                </div>
              </li>
          )}
          </ul>
          <div className="mt-6 flex gap-2">
            <button type="button" onClick={() => setStep(0)} className={secondaryButton}>
              Back
            </button>
            <button type="button" disabled={needed.some((d) => !docs[d.kind])} onClick={() => setStep(2)} className={primaryButton}>
              Continue
            </button>
          </div>
        </section>
      }

      {step === 2 &&
      <section>
          <h2 className="text-xl font-bold text-ink">Check and submit</h2>
          <dl className="mt-4 divide-y divide-line rounded-2xl bg-surface">
            {[
          ['Business', b.name],
          ['Registration', b.regNumber],
          ['Address', b.location],
          ['Verification', tier],
          ['Documents', `${needed.length} uploaded`]].
          map(([k, v]) =>
          <div key={k} className="flex justify-between gap-4 p-4">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-medium text-ink">{v}</dd>
              </div>
          )}
          </dl>
          <p className="mt-2 text-sm text-muted">
            Wrong details?{' '}
            <Link to="/business/profile" className="font-semibold text-brand-dark">
              Edit your profile
            </Link>
          </p>
          <label className="mt-5 flex gap-3 rounded-2xl bg-surface p-4">
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[rgb(var(--brand))]" />
            <span className="text-sm text-ink-soft">I confirm I’m authorised to act for this business and the documents are genuine. Submitting false documents leads to permanent removal.</span>
          </label>
          {error &&
        <p role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
        }
          <div className="mt-6 flex gap-2">
            <button type="button" onClick={() => setStep(1)} className={secondaryButton}>
              Back
            </button>
            <button type="button" disabled={busy} onClick={send} className={primaryButton}>
              {busy && <LoaderCircleIcon className="h-5 w-5 animate-spin" aria-hidden="true" />} Submit for verification
            </button>
          </div>
        </section>
      }
    </div>);

}