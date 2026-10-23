import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheckIcon, FileBadgeIcon, LineChartIcon, QrCodeIcon, Share2Icon, ShieldCheckIcon, ArrowRightIcon } from 'lucide-react';
import { QrCode } from '../../components/trust/QrCode';
import { usePageMeta } from '../../hooks/usePageMeta';

const benefits = [
{ icon: BadgeCheckIcon, title: 'Trust badge', body: 'A PadiCheck Verified badge on your profile and every check of your business.' },
{ icon: Share2Icon, title: 'Shareable profile', body: 'A public page with your verified details, Trust Score and reviews to share anywhere.' },
{ icon: FileBadgeIcon, title: 'Digital certificate', body: 'A certificate with a unique ID that anyone can verify in seconds.' },
{ icon: QrCodeIcon, title: 'QR verification', body: 'Put your QR code on vans, receipts and shopfronts. Scanning shows your live status.' },
{ icon: ShieldCheckIcon, title: 'Reputation management', body: 'Respond to reviews and dispute inaccurate reports with evidence.' },
{ icon: LineChartIcon, title: 'Insights', body: 'See how many people view and check your business each month.' }];


const steps = ['Create your business profile', 'Add registration details and upload documents', 'Our verification team reviews them — usually within 2 working days', 'Get your badge, certificate and QR code'];

export function ForBusiness() {
  usePageMeta({ title: 'Verify your business', description: 'Get the PadiCheck Verified badge, a certificate and a QR code customers can scan.' });
  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 pt-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-10 lg:pt-16">
        <div>
          <h1 className="text-4xl font-bold leading-tight text-ink sm:text-5xl">Prove you’re real. Win more customers.</h1>
          <p className="mt-4 max-w-xl text-lg text-ink-soft">Customers check before they trust. Verified businesses on PadiCheck get chosen more often — and scammers can’t copy a live verification.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/business/verification" className="inline-flex h-14 items-center gap-2 rounded-2xl bg-brand px-7 font-semibold text-white hover:bg-brand-dark">
              Get Verified <ArrowRightIcon className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link to="/b/lekki-prime-homes" className="inline-flex h-14 items-center rounded-2xl px-7 font-semibold text-ink ring-1 ring-line hover:bg-surface">
              See an example profile
            </Link>
          </div>
        </div>
        <div className="rounded-[28px] bg-surface p-6 text-center ring-1 ring-line">
          <QrCode value="https://padicheck.com/certificate/PC-VB-2026-004812" size={150} label="Example verification QR code" />
          <p className="mt-3 flex items-center justify-center gap-1.5 font-semibold text-ink">
            <BadgeCheckIcon className="h-5 w-5 text-brand" aria-hidden="true" /> PadiCheck Verified
          </p>
          <p className="text-sm text-muted">Scan to verify</p>
        </div>
      </section>

      <section aria-labelledby="why" className="mx-auto max-w-6xl px-4 py-14 lg:px-10">
        <h2 id="why" className="text-3xl font-bold text-ink">Why verify</h2>
        <ul className="mt-8 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b) =>
          <li key={b.title}>
              <b.icon className="h-7 w-7 text-brand" aria-hidden="true" />
              <h3 className="mt-3 text-lg font-semibold text-ink">{b.title}</h3>
              <p className="mt-1 text-ink-soft">{b.body}</p>
            </li>
          )}
        </ul>
      </section>

      <section aria-labelledby="process" className="bg-surface py-14">
        <div className="mx-auto max-w-6xl px-4 lg:px-10">
          <h2 id="process" className="text-3xl font-bold text-ink">The verification process</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-4">
            {steps.map((s, i) =>
            <li key={s}>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-brand text-base font-bold text-white">{i + 1}</span>
                <p className="mt-3 font-medium text-ink">{s}</p>
              </li>
            )}
          </ol>
          <Link to="/pricing" className="mt-10 inline-flex h-12 items-center font-semibold text-brand-dark">
            See business plans
          </Link>
        </div>
      </section>
    </>);

}