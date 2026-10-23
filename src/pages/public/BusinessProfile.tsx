import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { BadgeCheckIcon, CopyIcon, GlobeIcon, MapPinIcon, PhoneIcon, QrCodeIcon, SearchIcon, Share2Icon, ShieldAlertIcon, StarIcon, AtSignIcon } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { Field } from '../../components/admin/Field';
import { QrCode } from '../../components/trust/QrCode';
import { ReviewList, Stars } from '../../components/trust/ReviewList';
import { ScoreGauge } from '../../components/trust/ScoreGauge';
import { StateView } from '../../components/trust/StateView';
import { useTrust } from '../../contexts/TrustContext';
import { useUser } from '../../contexts/UserContext';
import { usePageMeta } from '../../hooks/usePageMeta';
import { formatDate } from '../../utils/checks';
import { primaryButton, textareaClass } from '../../utils/formStyles';
import { scoreBand } from '../../utils/trustScore';
import { hasPublicProfile, isListed } from '../../utils/directory';
import { categoryForBusiness } from '../../data/directory';
import { ClockIcon, StoreIcon } from 'lucide-react';

export function BusinessProfile() {
  const { slug = '' } = useParams<{slug: string;}>();
  const navigate = useNavigate();
  const { session } = useUser();
  const { getBusinessBySlug, reviews, saveReview, reports } = useTrust();
  const biz = getBusinessBySlug(slug);
  const [qrOpen, setQrOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);

  usePageMeta({
    title: biz ? `${biz.name} — ${biz.verification === 'verified' ? 'PadiCheck Verified' : 'PadiCheck profile'}` : 'Business not found',
    description: biz?.description,
    structuredData: biz ? { '@type': 'LocalBusiness', name: biz.name, address: biz.location, telephone: biz.phone, url: `https://${biz.website}` } : undefined
  });

  if (!biz || !hasPublicProfile(biz)) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-12">
        <StateView kind="no-result" title="This business doesn’t have a public profile" body="It may not have joined PadiCheck yet. You can still run a check." action={<Link to="/verify/business" className="inline-flex h-12 items-center rounded-2xl bg-brand px-6 font-semibold text-white">Check a business</Link>} />
      </div>);

  }

  const verified = biz.verification === 'verified';
  const listed = isListed(biz);
  const suspended = biz.verification === 'suspended';
  const list = reviews.filter((r) => r.businessId === biz.id && r.status === 'published');
  const avg = list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0;
  const openReports = reports.filter((r) => r.entityName === biz.name && (r.status === 'pending' || r.status === 'review')).length;
  const band = scoreBand(biz.score);
  const profileUrl = `${window.location.origin}/b/${biz.slug}`;
  const certUrl = `${window.location.origin}/certificate/${biz.certificateId}`;

  const submitReview = () => {
    setTried(true);
    if (!rating || text.trim().length < 10) return;
    saveReview({ id: `rv-${Date.now()}`, businessId: biz.id, author: session?.name.split(' ')[0] ?? 'Customer', rating, text: text.trim(), at: new Date().toISOString(), verifiedTransaction: false, status: 'published' });
    setReviewOpen(false);
    setRating(0);
    setText('');
    toast.success('Review published', { description: 'Thanks for helping others decide.' });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 lg:px-10 lg:pt-12">
      {suspended &&
      <p role="alert" className="mb-5 flex gap-2 rounded-2xl bg-danger-soft p-4 text-danger">
          <ShieldAlertIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> This business’s verification has been suspended while we review new information.
        </p>
      }
      {!verified && !suspended &&
      <p className="mb-5 rounded-2xl bg-caution-soft p-4 text-sm text-caution">
          This business is listed on PadiCheck but hasn’t completed verification. Read the reviews and run a check before you pay.
        </p>
      }
      <header className="grid gap-8 rounded-[28px] bg-surface p-6 md:p-8 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex gap-5">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-brand-soft text-2xl font-bold text-brand-dark" aria-hidden="true">
            {biz.name[0]}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              {verified &&
              <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-dark">
                  <BadgeCheckIcon className="h-4 w-4" aria-hidden="true" /> PadiCheck Verified · {biz.tier}
                </p>
              }
              {listed &&
              <Link to={`/directory/${categoryForBusiness(biz.category).slug}`} className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1 text-sm font-semibold text-ink-soft ring-1 ring-line hover:text-ink">
                  <StoreIcon className="h-4 w-4" aria-hidden="true" /> Listed in {biz.category}
                </Link>
              }
            </div>
            <h1 className="mt-2 text-3xl font-bold text-ink">{biz.name}</h1>
            <p className="text-ink-soft">{biz.category}</p>
            <p className="mt-3 max-w-xl text-ink-soft">{biz.description}</p>
            <p className="mt-3 flex items-center gap-2 text-sm text-muted">
              <Stars rating={Math.round(avg)} /> {avg ? avg.toFixed(1) : '—'} · {list.length} reviews
            </p>
          </div>
        </div>
        <div className="flex items-center gap-5 lg:flex-col lg:items-end">
          <ScoreGauge score={biz.score} size="sm" />
          <p className={`font-semibold ${band.text}`}>{band.label}</p>
        </div>
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => navigate(`/verify/business?q=${encodeURIComponent(biz.name)}`)} className={primaryButton}>
          <SearchIcon className="h-4 w-4" aria-hidden="true" /> Check Business
        </button>
        <button
          type="button"
          onClick={async () => {
            if (navigator.share) await navigator.share({ title: biz.name, url: profileUrl }).catch(() => undefined);else
            {
              await navigator.clipboard?.writeText(profileUrl);
              toast.success('Profile link copied');
            }
          }}
          className="inline-flex h-12 items-center gap-2 rounded-2xl px-5 font-semibold text-ink ring-1 ring-line hover:bg-surface">
          
          <Share2Icon className="h-4 w-4" aria-hidden="true" /> Share
        </button>
        {verified &&
        <>
            <button
            type="button"
            onClick={async () => {
              await navigator.clipboard?.writeText(certUrl);
              toast.success('Verification link copied');
            }}
            className="inline-flex h-12 items-center gap-2 rounded-2xl px-5 font-semibold text-ink ring-1 ring-line hover:bg-surface">
            
              <CopyIcon className="h-4 w-4" aria-hidden="true" /> Copy Verification Link
            </button>
            <button type="button" onClick={() => setQrOpen(true)} className="inline-flex h-12 items-center gap-2 rounded-2xl px-5 font-semibold text-ink ring-1 ring-line hover:bg-surface">
              <QrCodeIcon className="h-4 w-4" aria-hidden="true" /> Scan QR
            </button>
          </>
        }
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <dl className="divide-y divide-line rounded-3xl bg-surface p-2">
            {[
            { icon: MapPinIcon, label: 'Location', value: biz.location },
            { icon: GlobeIcon, label: 'Website', value: biz.website },
            { icon: PhoneIcon, label: 'Phone', value: biz.phone },
            ...(biz.directory?.hours ? [{ icon: ClockIcon, label: 'Opening hours', value: biz.directory.hours }] : []),
            ...biz.socials.map((s) => ({ icon: AtSignIcon, label: 'Social', value: s }))].
            map((r) =>
            <div key={r.value} className="flex gap-3 px-3 py-3">
                <r.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="text-xs text-muted">{r.label}</dt>
                  <dd className="break-words font-medium text-ink">{r.value}</dd>
                </div>
              </div>
            )}
          </dl>
          <dl className="grid grid-cols-2 gap-3 rounded-3xl bg-surface p-5 text-sm">
            <div>
              <dt className="text-muted">Verification</dt>
              <dd className="font-semibold capitalize text-ink">{verified ? 'Verified' : biz.verification === 'review' ? 'In review' : biz.verification}</dd>
            </div>
            <div>
              <dt className="text-muted">Registration</dt>
              <dd className="font-semibold text-ink">{biz.regNumber}</dd>
            </div>
            <div>
              <dt className="text-muted">Verified on</dt>
              <dd className="font-semibold text-ink">{biz.verifiedAt ? formatDate(biz.verifiedAt) : '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">Last verified</dt>
              <dd className="font-semibold text-ink">{biz.lastVerifiedAt ? formatDate(biz.lastVerifiedAt) : '—'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted">Open reports</dt>
              <dd className="font-semibold text-ink">{openReports}</dd>
            </div>
          </dl>
          <Link to={`/report-issue?name=${encodeURIComponent(biz.name)}&type=business`} className="flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-danger ring-1 ring-line hover:bg-danger-soft">
            Report this business
          </Link>
        </aside>

        <section aria-labelledby="reviews-heading">
          <div className="flex items-center justify-between">
            <h2 id="reviews-heading" className="text-xl font-bold text-ink">
              Reviews
            </h2>
            <button type="button" onClick={() => session ? setReviewOpen(true) : navigate('/signin', { state: { from: `/b/${biz.slug}` } })} className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-brand-dark hover:bg-surface">
              <StarIcon className="h-4 w-4" aria-hidden="true" /> Write a review
            </button>
          </div>
          <div className="mt-3">
            <ReviewList reviews={list} />
          </div>
        </section>
      </div>

      <BottomSheet open={qrOpen} onClose={() => setQrOpen(false)} title="Scan to verify" description="Opens the live PadiCheck verification page for this business.">
        <div className="text-center">
          <QrCode value={certUrl} size={220} label={`QR code linking to ${biz.name} verification`} />
          <p className="mt-3 font-mono text-sm text-muted">{biz.certificateId}</p>
          <Link to={`/certificate/${biz.certificateId}`} className="mt-3 inline-flex h-11 items-center font-semibold text-brand-dark">
            Open verification page
          </Link>
        </div>
      </BottomSheet>
      <BottomSheet open={reviewOpen} onClose={() => setReviewOpen(false)} title={`Review ${biz.name}`} footer={<button type="button" onClick={submitReview} className={`${primaryButton} w-full`}>Publish review</button>}>
        <div className="space-y-4">
          <div role="radiogroup" aria-label="Rating" className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) =>
            <button key={i} type="button" role="radio" aria-checked={rating === i} aria-label={`${i} star${i > 1 ? 's' : ''}`} onClick={() => setRating(i)} className="grid h-12 w-12 place-items-center rounded-xl text-amber hover:bg-canvas">
                <StarIcon className="h-7 w-7" fill={i <= rating ? 'currentColor' : 'none'} aria-hidden="true" />
              </button>
            )}
          </div>
          {tried && !rating && <p className="text-sm text-danger">Choose a rating</p>}
          <Field label="Your experience" error={tried && text.trim().length < 10 ? 'Write at least 10 characters' : undefined}>
            <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} className={textareaClass} placeholder="What happened? Be specific and fair." />
          </Field>
          <p className="text-xs text-muted">Reviews must be about a real experience. Reviews that break our guidelines are removed.</p>
        </div>
      </BottomSheet>
    </div>);

}