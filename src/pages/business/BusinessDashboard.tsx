import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, TriangleAlertIcon } from 'lucide-react';
import { ScoreGauge } from '../../components/trust/ScoreGauge';
import { useTrust } from '../../contexts/TrustContext';
import { profileViews14d, verificationStatusMeta } from '../../data/businessPortal';
import { scoreBand } from '../../utils/trustScore';

export function BusinessDashboard() {
  const { myBusiness: b, reviews, reports, disputes } = useTrust();
  const myReviews = reviews.filter((r) => r.businessId === b.id && r.status !== 'removed');
  const myReports = reports.filter((r) => r.entityName === b.name);
  const resolved = myReports.filter((r) => r.status === 'resolved' || r.status === 'rejected').length;
  const openDisputes = disputes.filter((d) => d.businessId === b.id && !['upheld', 'corrected', 'removed'].includes(d.status));
  const unanswered = myReviews.filter((r) => !r.response && r.status === 'published').length;
  const status = verificationStatusMeta[b.verification];
  const peak = Math.max(...profileViews14d);
  const band = scoreBand(b.score);

  const tasks = [
  b.verification === 'none' && { to: '/business/verification', text: 'Verify your business to get the PadiCheck Verified badge', tone: 'bg-brand-soft text-brand-dark' },
  b.verification === 'info' && { to: '/business/verification', text: b.infoRequest ?? 'Our team needs more information', tone: 'bg-caution-soft text-caution' },
  unanswered > 0 && { to: '/business/reviews', text: `${unanswered} review${unanswered > 1 ? 's' : ''} waiting for your reply`, tone: 'bg-sky-soft text-sky' },
  myReports.some((r) => r.status === 'review' || r.status === 'pending') && { to: '/business/reports', text: 'A report about your business is under review', tone: 'bg-caution-soft text-caution' }].
  filter(Boolean) as {to: string;text: string;tone: string;}[];

  return (
    <div className="space-y-5 pb-10">
      {tasks.length > 0 &&
      <ul className="space-y-2">
          {tasks.map((t) =>
        <li key={t.text}>
              <Link to={t.to} className={`flex items-center gap-3 rounded-2xl p-4 font-medium ${t.tone}`}>
                <TriangleAlertIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="flex-1">{t.text}</span>
                <ArrowRightIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              </Link>
            </li>
        )}
        </ul>
      }

      <div className="grid gap-5 lg:grid-cols-3">
        <section aria-labelledby="score-h" className="flex items-center gap-5 rounded-3xl bg-surface p-6 lg:row-span-2 lg:flex-col lg:items-start">
          <ScoreGauge score={b.score} />
          <div>
            <h2 id="score-h" className="text-sm font-medium text-muted">
              Trust Score
            </h2>
            <p className={`text-xl font-bold ${band.text}`}>{band.label}</p>
            <p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${status.soft}`}>{status.label}</p>
            <p className="mt-3 text-sm text-muted">Verifying, replying to reviews and resolving reports all help your score.</p>
          </div>
        </section>

        <section aria-labelledby="views-h" className="rounded-3xl bg-surface p-6 lg:col-span-2">
          <h2 id="views-h" className="text-sm font-medium text-muted">
            Profile views, last 14 days
          </h2>
          <p className="mt-1 text-3xl font-bold text-ink">{profileViews14d.reduce((a, c) => a + c, 0)}</p>
          <div className="mt-4 flex h-28 items-end gap-1" role="img" aria-label={`Daily profile views, peaking at ${peak}`}>
            {profileViews14d.map((v, i) =>
            <div key={i} className={`flex-1 rounded-t ${v === peak ? 'bg-brand' : 'bg-brand/35'}`} style={{ height: `${v / peak * 100}%` }} />
            )}
          </div>
        </section>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-2">
          {[
          ['Checks this month', b.checks30d],
          ['Reviews', myReviews.length],
          ['Reports', myReports.length],
          ['Resolution rate', myReports.length ? `${Math.round(resolved / myReports.length * 100)}%` : '—']].
          map(([k, v]) =>
          <div key={k} className="rounded-3xl bg-surface p-5">
              <dt className="text-sm text-muted">{k}</dt>
              <dd className="mt-1 text-2xl font-bold text-ink">{v}</dd>
            </div>
          )}
        </dl>
      </div>

      {openDisputes.length > 0 &&
      <p className="rounded-2xl bg-violet-soft p-4 text-sm text-violet">
          {openDisputes.length} dispute{openDisputes.length > 1 ? 's' : ''} in progress.{' '}
          <Link to="/business/reports" className="font-semibold underline">
            View
          </Link>
        </p>
      }
    </div>);

}