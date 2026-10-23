import React, { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRightIcon, CameraIcon, ClipboardPasteIcon, HourglassIcon, Link2Icon, PencilLineIcon, StoreIcon, UploadIcon, UsersRoundIcon } from 'lucide-react';
import { ThemeToggle } from '../../components/ThemeToggle';
import { CreditPill } from '../../components/consumer/CreditPill';
import { PageHeader } from '../../components/consumer/PageHeader';
import { ResultRow } from '../../components/consumer/ResultRow';
import { InstallCard } from '../../components/pwa/InstallCard';
import { usePlatform } from '../../contexts/PlatformContext';
import { useUser } from '../../contexts/UserContext';
import { usePersistentState } from '../../hooks/usePersistentState';
import { HomeTrustPanel } from '../../components/consumer/HomeTrustPanel';
import { checkTypes } from '../../data/checkTypes';
import { entityTypes } from '../../data/entityTypes';
import { results } from '../../data/results';
import { domainOf, extractUrl, looksLikeUrl } from '../../utils/checks';

const typeShortcuts = checkTypes.filter((t) => t.id !== 'link');

export function Home() {
  const navigate = useNavigate();
  const { queue } = useUser();
  const [draft, setDraft] = usePersistentState('pc-draft-home', '');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const trimmed = draft.trim();
  const url = looksLikeUrl(trimmed) ? extractUrl(trimmed) : null;
  const pending = queue.filter((t) => t.status !== 'done').length;
  const { getDoc } = usePlatform();
  const heading = getDoc('home-heading')?.body || 'What opportunity are you considering?';
  const subtext = getDoc('home-subtext')?.body || '';
  const headingParts = heading.split('opportunity');

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!trimmed) return;
    setDraft('');
    if (url) navigate(`/check/link?mode=link&url=${encodeURIComponent(url)}`);else
    navigate(`/check/any?mode=text&text=${encodeURIComponent(trimmed)}`);
  };

  const paste = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        toast('Your clipboard is empty');
        return;
      }
      setDraft(text);
      inputRef.current?.focus();
    } catch {
      inputRef.current?.focus();
      toast('Tap and hold the box, then choose Paste', { description: 'Clipboard access isn’t available here.' });
    }
  };

  const captureTiles = [
  { label: 'Paste Link', icon: ClipboardPasteIcon, onClick: paste, tone: 'bg-sky-soft text-sky' },
  { label: 'Camera', icon: CameraIcon, to: '/check/any?mode=camera', tone: 'bg-violet-soft text-violet' },
  { label: 'Upload', icon: UploadIcon, to: '/check/any?mode=upload', tone: 'bg-amber-soft text-amber' },
  { label: 'Describe', icon: PencilLineIcon, to: '/check/any?mode=text', tone: 'bg-rose-soft text-rose' }];

  const tileClass =
  'flex min-h-[88px] w-full flex-col items-center justify-center gap-2 rounded-2xl bg-surface text-ink ring-1 ring-line transition-colors hover:bg-canvas active:bg-line/60';

  return (
    <>
      <PageHeader brand actions={<><ThemeToggle className="lg:hidden" /><CreditPill /></>} />
      <div className="mx-auto w-full max-w-6xl px-4 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14 lg:px-10 lg:pt-4">
        <div>
          <section className="mt-3 rounded-[28px] bg-brand-soft p-4 sm:p-6 lg:mt-0 lg:p-8">
          <h1 className="text-[28px] font-bold leading-[1.15] tracking-tight text-ink sm:text-4xl lg:text-[44px]">
            {headingParts.length === 2 ?
              <>
                {headingParts[0]}
                <span className="text-brand-dark">opportunity</span>
                {headingParts[1]}
              </> :

              heading
              }
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-soft lg:text-lg">{subtext}</p>

          <form onSubmit={submit} className="mt-6 rounded-3xl bg-surface p-2 shadow-card ring-1 ring-line focus-within:ring-2 focus-within:ring-brand">
            <label htmlFor="home-input" className="sr-only">
              Paste a link or describe an opportunity
            </label>
            <textarea
                id="home-input"
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={3}
                enterKeyHint="go"
                placeholder="Paste a link or describe an opportunity"
                className="block min-h-[96px] w-full resize-none bg-transparent px-3 pt-3 text-[17px] leading-relaxed text-ink outline-none placeholder:text-muted/80" />
              
            <div className="flex items-center gap-2 p-1">
              {url ?
                <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark">
                  <Link2Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">Link · {domainOf(url)}</span>
                </span> :

                <span className="px-2 text-xs text-muted">{trimmed ? 'We’ll work out what kind of check this is' : ''}</span>
                }
              <button
                  type="submit"
                  disabled={!trimmed}
                  className="ml-auto inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-brand px-5 font-semibold text-white transition-colors hover:bg-brand-dark disabled:bg-line disabled:text-muted">
                  
                Analyze <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </form>
          </section>

          <ul className="mt-3 grid grid-cols-4 gap-2" aria-label="Start from">
            {captureTiles.map((tile) =>
            <li key={tile.label}>
                {tile.to ?
              <Link to={tile.to} className={tileClass}>
                    <span className={`grid h-10 w-10 place-items-center rounded-full ${tile.tone}`}>
                      <tile.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-[13px] font-medium">{tile.label}</span>
                  </Link> :

              <button type="button" onClick={tile.onClick} className={tileClass}>
                    <span className={`grid h-10 w-10 place-items-center rounded-full ${tile.tone}`}>
                      <tile.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="whitespace-nowrap text-[13px] font-medium">{tile.label}</span>
                  </button>
              }
              </li>
            )}
          </ul>

          <section aria-labelledby="checknow-heading" className="mt-7">
            <div className="flex items-center justify-between">
              <h2 id="checknow-heading" className="font-semibold text-ink">
                What do you want to check?
              </h2>
              <Link to="/verify" className="-mr-2 inline-flex h-11 items-center rounded-xl px-2 text-sm font-semibold text-brand-dark hover:bg-surface">
                Check Now
              </Link>
            </div>
            <ul className="mt-2 grid grid-cols-4 gap-2" aria-label="Quick checks">
              {entityTypes.map((t) =>
              <li key={t.id}>
                  <Link to={`/verify/${t.id}`} aria-label={t.checkLabel} className="flex min-h-[88px] w-full flex-col items-center justify-center gap-2 rounded-2xl bg-surface px-1 text-ink ring-1 ring-line transition-colors hover:bg-canvas active:bg-line/60">
                    <span className={`grid h-10 w-10 place-items-center rounded-xl ${t.tile}`}>
                      <t.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-center text-[12px] font-semibold leading-tight sm:text-[13px]">{t.id === 'social' ? 'Social' : t.label}</span>
                  </Link>
                </li>
              )}
            </ul>
          </section>

          <h2 className="mt-7 text-sm font-medium text-muted">Or analyse an offer, contract or message</h2>
          <ul className="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
            {typeShortcuts.map((type) =>
            <li key={type.id} className="shrink-0">
                <Link
                to={`/check/${type.id}`}
                className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full bg-surface px-4 text-[15px] font-medium text-ink ring-1 ring-line transition-colors hover:bg-canvas">
                
                  <type.icon className={`h-4 w-4 ${type.accent}`} aria-hidden="true" />
                  {type.id === 'shopping' ? 'Shopping' : type.label}
                </Link>
              </li>
            )}
          </ul>

          <Link to="/directory" className="mt-6 flex items-center gap-4 rounded-3xl bg-sky-soft p-4 transition-opacity hover:opacity-90 sm:p-5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sky text-white dark:text-navy">
              <StoreIcon className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">Explore businesses</span>
              <span className="block text-sm text-ink-soft">Find listed businesses by category, read reviews, then check before you pay.</span>
            </span>
            <ArrowRightIcon className="h-5 w-5 shrink-0 text-sky" aria-hidden="true" />
          </Link>

          <Link
            to="/talent"
            className="mt-3 flex items-center gap-4 rounded-3xl bg-violet-soft p-4 transition-opacity hover:opacity-90 sm:p-5">
            
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet text-white dark:text-navy">
              <UsersRoundIcon className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">Jobs & Talent</span>
              <span className="block text-sm text-ink-soft">Get job recommendations from your interests and qualifications — or find the right staff.</span>
            </span>
            <ArrowRightIcon className="h-5 w-5 shrink-0 text-violet" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-9 space-y-4 lg:mt-0">
          {pending > 0 &&
          <Link to="/history?tab=pending" className="flex items-center gap-3 rounded-3xl bg-caution-soft p-4 transition-colors hover:bg-caution-soft/70">
              <HourglassIcon className="h-5 w-5 shrink-0 text-caution" aria-hidden="true" />
              <span className="flex-1 text-sm text-caution">
                <strong className="font-semibold">
                  {pending} check{pending > 1 ? 's' : ''} in your queue
                </strong>
                <span className="block">They’ll run automatically when you’re online.</span>
              </span>
              <ArrowRightIcon className="h-4 w-4 text-caution" aria-hidden="true" />
            </Link>
          }
          <HomeTrustPanel />
          <InstallCard />
          <section aria-labelledby="recent-heading">
            <div className="flex items-center justify-between">
              <h2 id="recent-heading" className="font-semibold text-ink">
                Recent checks
              </h2>
              <Link to="/history" className="-mr-2 inline-flex h-11 items-center rounded-xl px-2 text-sm font-semibold text-brand-dark hover:bg-surface">
                See all
              </Link>
            </div>
            <ul className="mt-1 divide-y divide-line overflow-hidden rounded-3xl bg-surface">
              {results.slice(0, 4).map((r) =>
              <ResultRow key={r.id} result={r} />
              )}
            </ul>
          </section>
        </div>
      </div>
    </>);

}