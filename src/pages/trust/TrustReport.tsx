import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  BadgeCheckIcon,
  BookmarkIcon,
  CopyIcon,
  DownloadIcon,
  FlagIcon,
  LoaderCircleIcon,
  MessageCircleIcon,
  RefreshCwIcon,
  Share2Icon,
  ShieldAlertIcon,
  SearchIcon,
  StarIcon } from
'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { PageHeader } from '../../components/consumer/PageHeader';
import { ScoreBreakdown } from '../../components/trust/ScoreBreakdown';
import { ScoreGauge } from '../../components/trust/ScoreGauge';
import { SignalGroups } from '../../components/trust/SignalGroups';
import { StateView } from '../../components/trust/StateView';
import { usePwa } from '../../contexts/PwaContext';
import { useTrust } from '../../contexts/TrustContext';
import { entityTypeById } from '../../data/entityTypes';
import { track } from '../../utils/analytics';
import { formatDate, formatWhen } from '../../utils/checks';
import { refreshEntity } from '../../utils/trustApi';
import { scoreBand } from '../../utils/trustScore';

const sourceLabel = { verified: 'Verified', public: 'Public source', ai: 'AI estimate', user: 'User reported' };
const sourceTone = { verified: 'bg-brand-soft text-brand-dark', public: 'bg-canvas text-muted', ai: 'bg-violet-soft text-violet', user: 'bg-sky-soft text-sky' };
const verificationLabel = { verified: 'Verified', partial: 'Partly verified', unverified: 'Not verified' };

export function TrustReport() {
  const { id = '' } = useParams<{id: string;}>();
  const navigate = useNavigate();
  const { online } = usePwa();
  const { getEntity, upsertEntity, savedEntityIds, toggleSavedEntity, scoreConfig, reviews, businesses, reports } = useTrust();
  const entity = getEntity(id);
  const [shareOpen, setShareOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (entity) track('score_viewed', { type: entity.type, score: entity.score });
  }, [entity?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!entity) {
    return (
      <>
        <PageHeader title="Report" back="/verify" />
        <div className="mx-auto max-w-xl px-4">
          <StateView kind="no-result" title="This report isn’t available" body="It may have been removed, or the link is incorrect." action={<Link to="/verify" className="inline-flex h-12 items-center rounded-2xl bg-brand px-6 font-semibold text-white">Start a check</Link>} />
        </div>
      </>);

  }

  const meta = entityTypeById(entity.type);
  const band = scoreBand(entity.score, scoreConfig.bands);
  const saved = savedEntityIds.includes(entity.id);
  const business = entity.businessSlug ? businesses.find((b) => b.slug === entity.businessSlug) : undefined;
  const bizReviews = business ? reviews.filter((r) => r.businessId === business.id && r.status === 'published') : [];
  const entityReports = reports.filter((r) => r.entityId === entity.id);
  const shareUrl = `${window.location.origin}/report/${entity.id}`;
  const summary = `PadiCheck: ${entity.name} scored ${entity.score}/100 (${band.label}). ${entity.recommendation}`;

  const refresh = async () => {
    setRefreshing(true);
    try {
      upsertEntity(await refreshEntity(entity));
      toast.success('Report refreshed', { description: 'Latest information loaded.' });
    } catch {
      toast.error('Couldn’t refresh', { description: 'Check your connection and try again.' });
    } finally {
      setRefreshing(false);
    }
  };

  const share = async (how: 'native' | 'copy' | 'whatsapp' | 'summary') => {
    track('report_shared', { how });
    if (how === 'native' && navigator.share) {
      await navigator.share({ title: `PadiCheck report: ${entity.name}`, text: summary, url: shareUrl }).catch(() => undefined);
    } else if (how === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${summary} ${shareUrl}`)}`, '_blank', 'noopener');
    } else {
      await navigator.clipboard?.writeText(how === 'summary' ? summary : shareUrl);
      toast.success(how === 'summary' ? 'Summary copied' : 'Link copied');
    }
    setShareOpen(false);
  };

  const actionBtn = 'inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition-colors';

  return (
    <>
      <PageHeader
        title="Report"
        back
        actions={
        <button type="button" onClick={() => setShareOpen(true)} aria-label="Share report" className="no-print grid h-11 w-11 place-items-center rounded-full text-ink hover:bg-ink/5">
            <Share2Icon className="h-5 w-5" />
          </button>
        } />
      
      <article className="mx-auto w-full max-w-6xl px-4 pb-28 lg:px-10 lg:pb-10">
        {/* Overview */}
        <header className="rounded-[28px] bg-surface p-5 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <ScoreGauge score={entity.score} bands={scoreConfig.bands} />
            <div className="min-w-0 flex-1">
              <p className={`inline-flex items-center gap-1.5 text-sm font-semibold ${meta?.accent}`}>
                {meta && <meta.icon className="h-4 w-4" aria-hidden="true" />}
                {meta?.label} check
              </p>
              <h1 className="mt-1 break-words text-2xl font-bold leading-tight text-ink md:text-3xl">{entity.name}</h1>
              <p className="mt-1 text-ink-soft">{entity.subtitle}</p>
              <p className={`mt-4 inline-flex rounded-full px-3.5 py-1.5 text-base font-bold ${band.soft}`}>{band.label}</p>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-muted">Verification</dt>
                  <dd className="mt-0.5 flex items-center gap-1 font-semibold text-ink">
                    {entity.verification === 'verified' && <BadgeCheckIcon className="h-4 w-4 text-brand" aria-hidden="true" />}
                    {verificationLabel[entity.verification]}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Confidence</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{entity.confidence}</dd>
                </div>
                <div>
                  <dt className="text-muted">Unresolved reports</dt>
                  <dd className={`mt-0.5 font-semibold ${entity.unresolvedReports ? 'text-danger' : 'text-ink'}`}>{entity.unresolvedReports}</dd>
                </div>
                <div>
                  <dt className="text-muted">Last checked</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{formatWhen(entity.lastChecked)}</dd>
                </div>
              </dl>
            </div>
          </div>
          <div className={`mt-6 rounded-2xl p-4 ${band.soft}`}>
            <p className="text-sm font-semibold">Our recommendation</p>
            <p className="mt-1 text-[15px] leading-relaxed text-ink">{entity.recommendation}</p>
          </div>
        </header>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <SignalGroups signals={entity.signals} />
            <ScoreBreakdown factors={entity.factors} weights={scoreConfig.weights} version={scoreConfig.version} />

            <section aria-labelledby="evidence-heading" className="rounded-3xl bg-surface p-5">
              <h2 id="evidence-heading" className="text-lg font-semibold text-ink">
                Evidence
              </h2>
              <dl className="mt-3 divide-y divide-line">
                {entity.facts.map((f) =>
                <div key={f.label} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
                    <dt className="text-sm text-muted sm:w-44 sm:shrink-0">{f.label}</dt>
                    <dd className="flex flex-1 flex-wrap items-center gap-2 font-medium text-ink">
                      {f.value}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${sourceTone[f.source]}`}>{sourceLabel[f.source]}</span>
                    </dd>
                  </div>
                )}
              </dl>
            </section>

            <section aria-labelledby="ai-heading" className="rounded-3xl bg-violet-soft p-5">
              <h2 id="ai-heading" className="font-semibold text-violet">
                About the AI analysis
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                AI risk signals are patterns, not proof. They never decide a score on their own and are reviewed by people before reports are upheld. Use this report as guidance — the final decision is yours.{' '}
                <Link to="/legal/ai-disclaimer" className="font-semibold text-violet underline">
                  AI disclaimer
                </Link>
              </p>
            </section>
          </div>

          <aside className="space-y-5">
            <section aria-labelledby="reports-heading" className="rounded-3xl bg-surface p-5">
              <h2 id="reports-heading" className="font-semibold text-ink">
                Reports
              </h2>
              <p className="mt-1 text-sm text-muted">
                {entity.totalReports ? `${entity.totalReports} report${entity.totalReports > 1 ? 's' : ''}, ${entity.unresolvedReports} still under review.` : 'No reports from the community.'}
              </p>
              {entityReports.slice(0, 2).map((r) =>
              <p key={r.id} className="mt-3 rounded-2xl bg-canvas p-3 text-sm text-ink-soft">
                  “{r.description}” <span className="block pt-1 text-xs text-muted">{r.category} · {formatDate(r.at)}</span>
                </p>
              )}
              <Link to={`/report-issue?entity=${entity.id}`} className="no-print mt-4 inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-danger ring-1 ring-line hover:bg-danger-soft">
                <FlagIcon className="h-4 w-4" aria-hidden="true" /> Report an issue
              </Link>
            </section>

            {business &&
            <section aria-labelledby="reviews-heading" className="rounded-3xl bg-surface p-5">
                <h2 id="reviews-heading" className="font-semibold text-ink">
                  Reviews
                </h2>
                <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                  <StarIcon className="h-4 w-4 text-amber" fill="currentColor" aria-hidden="true" />
                  {bizReviews.length ? (bizReviews.reduce((s, r) => s + r.rating, 0) / bizReviews.length).toFixed(1) : '—'} · {bizReviews.length} reviews
                </p>
                <Link to={`/b/${business.slug}`} className="mt-3 inline-flex h-11 items-center rounded-xl px-3 text-sm font-semibold text-brand-dark ring-1 ring-line hover:bg-canvas">
                  View business profile
                </Link>
              </section>
            }

            <section className="rounded-3xl bg-canvas p-5 ring-1 ring-line">
              <p className="flex items-center gap-2 font-semibold text-ink">
                <ShieldAlertIcon className="h-4 w-4" aria-hidden="true" /> Is this about you?
              </p>
              <p className="mt-1 text-sm text-muted">If information here is inaccurate, you can dispute it with evidence. A person reviews every dispute.</p>
              <Link to="/business/reports" className="mt-3 inline-flex h-11 items-center text-sm font-semibold text-brand-dark">
                Dispute this information
              </Link>
            </section>
          </aside>
        </div>
      </article>

      <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur-md lg:static lg:mx-auto lg:max-w-6xl lg:border-0 lg:bg-transparent lg:px-10 lg:pb-10">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={saved}
            onClick={() => {
              toggleSavedEntity(entity.id);
              toast(saved ? 'Removed from saved' : 'Saved — we’ll alert you if the score changes');
            }}
            className={`${actionBtn} flex-1 sm:flex-none ${saved ? 'bg-brand-soft text-brand-dark' : 'bg-canvas text-ink ring-1 ring-line'}`}>
            
            <BookmarkIcon className="h-4 w-4" fill={saved ? 'currentColor' : 'none'} aria-hidden="true" /> {saved ? 'Saved' : 'Save'}
          </button>
          <button type="button" onClick={() => setShareOpen(true)} className={`${actionBtn} flex-1 bg-brand text-white hover:bg-brand-dark sm:flex-none`}>
            <Share2Icon className="h-4 w-4" aria-hidden="true" /> Share
          </button>
          <button
            type="button"
            onClick={() => {
              track('report_downloaded');
              window.print();
            }}
            className={`${actionBtn} hidden bg-canvas text-ink ring-1 ring-line sm:inline-flex`}>
            
            <DownloadIcon className="h-4 w-4" aria-hidden="true" /> Download PDF
          </button>
          <button type="button" disabled={!online || refreshing} onClick={refresh} aria-label="Refresh report" className={`${actionBtn} bg-canvas text-ink ring-1 ring-line disabled:opacity-50`}>
            {refreshing ? <LoaderCircleIcon className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCwIcon className="h-4 w-4" aria-hidden="true" />}
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button type="button" onClick={() => navigate('/verify')} className={`${actionBtn} hidden text-brand-dark sm:inline-flex`}>
            <SearchIcon className="h-4 w-4" aria-hidden="true" /> Start another check
          </button>
        </div>
      </div>

      <BottomSheet open={shareOpen} onClose={() => setShareOpen(false)} title="Share this report" description="People you share with see the score and summary, never your account details.">
        <ul className="grid grid-cols-2 gap-2.5">
          {[
          { id: 'whatsapp' as const, label: 'WhatsApp', icon: MessageCircleIcon },
          { id: 'copy' as const, label: 'Copy link', icon: CopyIcon },
          { id: 'summary' as const, label: 'Copy summary', icon: CopyIcon },
          { id: 'native' as const, label: 'More options', icon: Share2Icon }].
          map((o) =>
          <li key={o.id}>
              <button type="button" onClick={() => share(o.id)} className="flex h-20 w-full flex-col items-center justify-center gap-2 rounded-2xl bg-canvas font-medium text-ink hover:bg-line/60">
                <o.icon className="h-5 w-5" aria-hidden="true" /> {o.label}
              </button>
            </li>
          )}
        </ul>
        <button
          type="button"
          onClick={() => {
            setShareOpen(false);
            track('report_downloaded');
            window.setTimeout(() => window.print(), 250);
          }}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-semibold text-ink ring-1 ring-line">
          
          <DownloadIcon className="h-4 w-4" aria-hidden="true" /> Download PDF
        </button>
      </BottomSheet>
    </>);

}