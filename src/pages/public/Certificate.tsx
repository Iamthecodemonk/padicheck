import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BadgeCheckIcon, CircleXIcon, PrinterIcon, SearchIcon, ShieldAlertIcon } from 'lucide-react';
import { QrCode } from '../../components/trust/QrCode';
import { Logo } from '../../components/Logo';
import { useTrust } from '../../contexts/TrustContext';
import { usePageMeta } from '../../hooks/usePageMeta';
import { formatDate } from '../../utils/checks';

/** Public certificate + QR verification page. Status is always live, so a revoked certificate can't be reused. */
export function Certificate() {
  const { id = '' } = useParams<{id: string;}>();
  const navigate = useNavigate();
  const { getBusinessByCertificate } = useTrust();
  const [lookup, setLookup] = useState('');
  const biz = id ? getBusinessByCertificate(id) : undefined;
  usePageMeta({ title: biz ? `Certificate ${biz.certificateId}` : 'Verify a certificate', description: 'Check that a PadiCheck verification certificate is genuine and current.' });

  const form =
  <form
    onSubmit={(e) => {
      e.preventDefault();
      if (lookup.trim()) navigate(`/certificate/${lookup.trim().toUpperCase()}`);
    }}
    className="mt-6 flex gap-2">
    
      <label htmlFor="cert-id" className="sr-only">
        Certificate ID
      </label>
      <input id="cert-id" value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="e.g. PC-VB-2026-004812" className="h-12 min-w-0 flex-1 rounded-2xl bg-surface px-4 font-mono text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-brand" />
      <button type="submit" aria-label="Verify certificate" className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-white">
        <SearchIcon className="h-5 w-5" />
      </button>
    </form>;


  if (!biz) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-12">
        <h1 className="text-3xl font-bold text-ink">Verify a certificate</h1>
        {id ?
        <p role="alert" className="mt-4 flex gap-2 rounded-2xl bg-danger-soft p-4 text-danger">
            <CircleXIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> No certificate matches “{id}”. It may be fake — don’t rely on it.
          </p> :

        <p className="mt-2 text-ink-soft">Enter the certificate ID printed under the QR code.</p>
        }
        {form}
      </div>);

  }

  const valid = biz.verification === 'verified';

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 lg:pt-12">
      <div className={`flex items-center gap-3 rounded-2xl p-4 ${valid ? 'bg-brand-soft text-brand-dark' : 'bg-danger-soft text-danger'}`} role="status">
        {valid ? <BadgeCheckIcon className="h-6 w-6 shrink-0" aria-hidden="true" /> : <ShieldAlertIcon className="h-6 w-6 shrink-0" aria-hidden="true" />}
        <p className="font-semibold">{valid ? 'This certificate is genuine and currently valid.' : `This certificate is not currently valid (${biz.verification === 'suspended' ? 'suspended' : 'under review'}).`}</p>
      </div>

      <article className="mt-5 rounded-[28px] bg-surface p-6 ring-1 ring-line md:p-10" aria-label="Verification certificate">
        <div className="flex items-start justify-between gap-4">
          <Logo height={30} />
          <span className="text-right text-xs text-muted">
            Certificate of
            <br />
            Verification
          </span>
        </div>
        <p className="mt-10 text-sm text-muted">This certifies that</p>
        <h1 className="mt-1 text-3xl font-bold text-ink md:text-4xl">{biz.name}</h1>
        <p className="mt-1 text-ink-soft">{biz.regNumber}</p>
        <div className="mt-8 grid gap-8 sm:grid-cols-[minmax(0,1fr)_auto]">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            {[
            ['Verification ID', biz.certificateId ?? '—'],
            ['Verification type', biz.tier],
            ['Status', valid ? 'Active' : biz.verification],
            ['Trust Score', `${biz.score} / 100`],
            ['Verified on', biz.verifiedAt ? formatDate(biz.verifiedAt) : '—'],
            ['Last verified', biz.lastVerifiedAt ? formatDate(biz.lastVerifiedAt) : '—']].
            map(([k, v]) =>
            <div key={k}>
                <dt className="text-muted">{k}</dt>
                <dd className="mt-0.5 font-semibold capitalize text-ink">{v}</dd>
              </div>
            )}
          </dl>
          <div className="text-center">
            <QrCode value={`${window.location.origin}/certificate/${biz.certificateId}`} size={132} label="QR code to verify this certificate" />
            <p className="mt-2 text-xs text-muted">Scan to verify</p>
          </div>
        </div>
      </article>

      <div className="no-print mt-5 flex flex-wrap gap-2">
        <Link to={`/b/${biz.slug}`} className="inline-flex h-12 items-center rounded-2xl bg-brand px-5 font-semibold text-white">
          View business profile
        </Link>
        <button type="button" onClick={() => window.print()} className="inline-flex h-12 items-center gap-2 rounded-2xl px-5 font-semibold text-ink ring-1 ring-line">
          <PrinterIcon className="h-4 w-4" aria-hidden="true" /> Print
        </button>
      </div>
      <section className="no-print mt-10">
        <h2 className="font-semibold text-ink">Verify this certificate</h2>
        <p className="text-sm text-muted">Got a different certificate? Check its ID.</p>
        {form}
      </section>
    </div>);

}