import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { BookmarkCheckIcon, BookmarkIcon, CircleCheckIcon, CloudOffIcon, CopyIcon, LinkIcon, MessageCircleIcon, Share2Icon } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { PageHeader } from '../../components/consumer/PageHeader';
import { VerdictBadge } from '../../components/consumer/VerdictBadge';
import { InstallCard } from '../../components/pwa/InstallCard';
import { usePwa } from '../../contexts/PwaContext';
import { useUser } from '../../contexts/UserContext';
import { results } from '../../data/results';
import { formatWhen } from '../../utils/checks';
import { verdictTone } from '../../utils/verdict';

const summaryBg = { good: 'bg-brand-soft', caution: 'bg-caution-soft', risk: 'bg-danger-soft' };

export function Result() {
  const { id } = useParams<{id: string;}>();
  const [params] = useSearchParams();
  const isNew = params.get('new') === '1';
  const result = results.find((r) => r.id === id);
  const { online, install } = usePwa();
  const { isSaved, toggleSaved } = useUser();
  const [shareOpen, setShareOpen] = useState(false);
  const [done, setDone] = useState<string[]>([]);

  useEffect(() => {
    if (isNew) install.markEngaged();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew]);

  if (!result || !online && !result.availableOffline) {
    const offline = Boolean(result);
    return (
      <>
        <PageHeader back title="Report" />
        <div className="mx-auto flex max-w-md flex-col items-center px-6 pt-16 text-center">
          <CloudOffIcon className="h-10 w-10 text-muted" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-semibold text-ink">{offline ? 'This report isn’t on your device' : 'Report not found'}</h1>
          <p className="mt-2 text-muted">
            {offline ? 'Reconnect to open it. Saved reports are always available offline.' : 'It may have been deleted or the link is incomplete.'}
          </p>
          <Link to="/history" className="mt-6 inline-flex h-12 items-center rounded-2xl bg-ink px-6 font-semibold text-white">
            Go to history
          </Link>
        </div>
      </>);

  }

  const saved = isSaved(result.id);
  const shareUrl = `${window.location.origin}/result/${result.id}`;
  const shareText = `PadiCheck on “${result.title}”: ${result.summary}`;

  const nativeShare = async () => {
    try {
      await navigator.share({ title: result.title, text: shareText, url: shareUrl });
      setShareOpen(false);
    } catch {

      // User cancelled the system share sheet.
    }};
  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Couldn’t copy on this device');
    }
    setShareOpen(false);
  };
  const toggleSave = () => {
    toggleSaved(result.id);
    toast(saved ? 'Removed from Saved' : 'Saved — available offline');
  };

  const actionButtons =
  <>
      <button
      type="button"
      onClick={toggleSave}
      aria-pressed={saved}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-surface font-semibold text-ink transition-colors hover:bg-canvas">
      
        {saved ? <BookmarkCheckIcon className="h-5 w-5 text-brand" aria-hidden="true" /> : <BookmarkIcon className="h-5 w-5" aria-hidden="true" />}
        {saved ? 'Saved' : 'Save'}
      </button>
      <button
      type="button"
      onClick={() => setShareOpen(true)}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-ink font-semibold text-white transition-colors hover:bg-ink-soft">
      
        <Share2Icon className="h-5 w-5" aria-hidden="true" /> Share
      </button>
    </>;


  return (
    <>
      <PageHeader
        back="/history"
        title=""
        actions={
        <button type="button" onClick={() => setShareOpen(true)} aria-label="Share report" className="grid h-11 w-11 place-items-center rounded-full text-ink hover:bg-ink/5 lg:hidden">
            <Share2Icon className="h-5 w-5" />
          </button>
        } />
      
      <article className="mx-auto w-full max-w-6xl px-4 lg:grid lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start lg:gap-12 lg:px-10">
        <header className="lg:sticky lg:top-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{result.categoryLabel}</p>
          <h1 className="mt-1.5 text-[26px] font-bold leading-tight text-ink lg:text-[32px]">{result.title}</h1>
          {result.price && <p className="mt-1 text-xl font-semibold text-ink">{result.price}</p>}
          <p className="mt-1.5 text-sm text-muted">
            {result.source} · {formatWhen(result.createdAt)}
          </p>
          <div className={`mt-5 rounded-3xl p-5 ${summaryBg[result.verdict]}`}>
            <VerdictBadge verdict={result.verdict} size="lg" />
            <p className="mt-3 text-[17px] font-medium leading-snug text-ink">{result.summary}</p>
          </div>
          <div className="mt-4 hidden grid-cols-2 gap-3 lg:grid">{actionButtons}</div>
          <p className="mt-3 text-xs text-muted">
            Used {result.creditsUsed} credit{result.creditsUsed > 1 ? 's' : ''}
            {result.availableOffline ? ' · Available offline' : ''}
          </p>
        </header>

        <div className="mt-6 space-y-7 lg:mt-0">
          <section aria-label="Breakdown">
            <ul className="grid gap-3 sm:grid-cols-2">
              {result.sections.map((section) =>
              <li key={section.label} className="rounded-3xl bg-surface p-4">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
                    <span className={`h-2 w-2 rounded-full ${verdictTone[section.verdict].dot}`} aria-hidden="true" />
                    {section.label}
                  </p>
                  <p className={`mt-2 text-[17px] font-semibold leading-snug ${verdictTone[section.verdict].text}`}>{section.headline}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{section.detail}</p>
                </li>
              )}
            </ul>
          </section>

          <section aria-labelledby="good-heading">
            <h2 id="good-heading" className="text-lg font-semibold text-ink">
              What looks good
            </h2>
            <ul className="mt-3 space-y-3">
              {result.looksGood.map((item) =>
              <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-ink">
                  <CircleCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                  {item}
                </li>
              )}
            </ul>
          </section>

          <section aria-labelledby="check-heading">
            <h2 id="check-heading" className="text-lg font-semibold text-ink">
              What to check
            </h2>
            <p className="text-sm text-muted">Tick these off as you go.</p>
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-3xl bg-surface">
              {result.toCheck.map((item) => {
                const ticked = done.includes(item);
                return (
                  <li key={item}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={ticked}
                      onClick={() => setDone((d) => ticked ? d.filter((x) => x !== item) : [...d, item])}
                      className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas/60">
                      
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors ${ticked ? 'border-brand bg-brand text-white' : 'border-line'}`}>
                        
                        {ticked && <CircleCheckIcon className="h-4 w-4" aria-hidden="true" />}
                      </span>
                      <span className={`text-[15px] ${ticked ? 'text-muted line-through' : 'text-ink'}`}>{item}</span>
                    </button>
                  </li>);

              })}
            </ul>
          </section>

          {isNew && <InstallCard context="Get notified when reports are ready and open PadiCheck straight from your home screen." />}
        </div>
      </article>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur-md lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-2 gap-3">{actionButtons}</div>
      </div>

      <BottomSheet open={shareOpen} onClose={() => setShareOpen(false)} title="Share this report">
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-canvas">
          {typeof navigator.share === 'function' &&
          <li>
              <button type="button" onClick={nativeShare} className="flex h-14 w-full items-center gap-3 px-4 font-medium text-ink hover:bg-line/50">
                <Share2Icon className="h-5 w-5 text-muted" aria-hidden="true" /> Share via…
              </button>
            </li>
          }
          <li>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => setShareOpen(false)}
              className="flex h-14 w-full items-center gap-3 px-4 font-medium text-ink hover:bg-line/50">
              
              <MessageCircleIcon className="h-5 w-5 text-muted" aria-hidden="true" /> WhatsApp
            </a>
          </li>
          <li>
            <button type="button" onClick={() => copy(shareUrl, 'Link')} className="flex h-14 w-full items-center gap-3 px-4 font-medium text-ink hover:bg-line/50">
              <LinkIcon className="h-5 w-5 text-muted" aria-hidden="true" /> Copy link
            </button>
          </li>
          <li>
            <button type="button" onClick={() => copy(shareText, 'Summary')} className="flex h-14 w-full items-center gap-3 px-4 font-medium text-ink hover:bg-line/50">
              <CopyIcon className="h-5 w-5 text-muted" aria-hidden="true" /> Copy summary
            </button>
          </li>
        </ul>
        <p className="mt-3 text-xs text-muted">Shared links only show the summary. Your uploaded files are never included.</p>
      </BottomSheet>
    </>);

}