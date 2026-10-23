import React, { useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { BriefcaseIcon, SearchIcon, SparklesIcon, UsersIcon, WifiOffIcon } from 'lucide-react';
import { PageHeader } from '../../components/consumer/PageHeader';
import { Skeleton } from '../../components/Skeleton';
import { CandidateCard } from '../../components/talent/CandidateCard';
import { HiringForm } from '../../components/talent/HiringForm';
import { JobMatchCard } from '../../components/talent/JobMatchCard';
import { SeekerForm } from '../../components/talent/SeekerForm';
import { usePwa } from '../../contexts/PwaContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useTalentMatches } from '../../hooks/useTalentMatches';

type Mode = 'job' | 'hire';

export function Talent() {
  const [params, setParams] = useSearchParams();
  const mode: Mode = params.get('mode') === 'hire' ? 'hire' : 'job';
  const { online } = usePwa();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const resultsRef = useRef<HTMLDivElement>(null);
  const t = useTalentMatches();

  const status = mode === 'job' ? t.jobStatus : t.hireStatus;
  const ready = mode === 'job' ? t.profileReady : t.briefReady;

  const submit = () => {
    if (!online) return toast('You’re offline', { description: 'Matching needs a connection. Your answers are saved.' });
    if (mode === 'job') t.findJobs();else
    t.findCandidates();
    if (!isDesktop) window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const tabs: {id: Mode;label: string;icon: typeof BriefcaseIcon;}[] = [
  { id: 'job', label: 'Find a job', icon: BriefcaseIcon },
  { id: 'hire', label: 'Find staff', icon: UsersIcon }];


  return (
    <>
      <PageHeader title="Jobs & Talent" back="/" />
      <div className="mx-auto w-full max-w-6xl px-4 pb-10 lg:grid lg:grid-cols-[420px_minmax(0,1fr)] lg:items-start lg:gap-10 lg:px-10">
        <section aria-label={mode === 'job' ? 'Your profile' : 'Who you need'}>
          <div className="rounded-[28px] bg-brand-soft p-5">
            <p className="text-[15px] leading-relaxed text-ink-soft">
              {mode === 'job' ?
              'Tell us what you’re interested in and what you’re qualified for. We’ll recommend roles from verified employers — free.' :
              'Describe the person you need. We’ll recommend candidates whose skills and qualifications fit — free.'}
            </p>
            <div role="tablist" aria-label="What are you looking for?" className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1">
              {tabs.map((tab) =>
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={mode === tab.id}
                onClick={() => setParams(tab.id === 'hire' ? { mode: 'hire' } : {}, { replace: true })}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors ${
                mode === tab.id ? 'bg-brand text-white' : 'text-ink-soft hover:text-ink'}`
                }>
                
                  <tab.icon className="h-4 w-4" aria-hidden="true" /> {tab.label}
                </button>
              )}
            </div>
          </div>

          <div className="mt-5">
            {mode === 'job' ? <SeekerForm profile={t.profile} onChange={t.setProfile} /> : <HiringForm brief={t.brief} onChange={t.setBrief} />}
          </div>

          <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+12px)] z-20 mt-6 lg:static">
            <button
              type="button"
              onClick={submit}
              disabled={!ready || status === 'loading'}
              className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-semibold text-white shadow-float transition-colors hover:bg-brand-dark disabled:bg-line disabled:text-muted disabled:shadow-none lg:shadow-none">
              
              <SparklesIcon className="h-5 w-5" aria-hidden="true" />
              {mode === 'job' ? 'Recommend jobs' : 'Recommend candidates'}
            </button>
            {!ready && <p className="mt-2 text-center text-sm text-muted">{mode === 'job' ? 'Pick at least one interest' : 'Add at least one must-have skill'}</p>}
            {!online &&
            <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-caution">
                <WifiOffIcon className="h-4 w-4" aria-hidden="true" /> Matching needs a connection
              </p>
            }
          </div>
        </section>

        <div ref={resultsRef} className="mt-10 scroll-mt-20 lg:mt-0" aria-live="polite">
          {status === 'idle' &&
          <div className="rounded-3xl border-2 border-dashed border-line px-6 py-12 text-center">
              <SearchIcon className="mx-auto h-8 w-8 text-muted" aria-hidden="true" />
              <p className="mt-3 font-semibold text-ink">{mode === 'job' ? 'Your recommended jobs will appear here' : 'Recommended candidates will appear here'}</p>
              <p className="mt-1 text-sm text-muted">Ranked by how well they fit your {mode === 'job' ? 'interests and qualifications' : 'requirements'}.</p>
              {mode === 'job' && t.savedJobListings.length > 0 && <p className="mt-4 text-sm font-medium text-brand-dark">{t.savedJobListings.length} saved job(s) — run a search to see them ranked.</p>}
            </div>
          }

          {status === 'loading' &&
          <div className="space-y-3" role="status">
              <p className="font-medium text-ink">Finding the best matches…</p>
              {[0, 1, 2].map((i) =>
            <Skeleton key={i} className="h-48 rounded-3xl" />
            )}
            </div>
          }

          {status === 'done' && mode === 'job' &&
          <>
              <h2 className="text-xl font-bold text-ink">{t.jobMatches.length ? `${t.jobMatches.length} jobs for you` : 'No strong matches yet'}</h2>
              <p className="mt-1 text-sm text-muted">{t.jobMatches.length ? 'Verified employers are ranked first. Always check a job before sharing documents or paying anything.' : 'Try adding more skills or another interest.'}</p>
              <ul className="mt-4 grid gap-3 xl:grid-cols-2">
                {t.jobMatches.map((m) =>
              <li key={m.item.id}>
                    <JobMatchCard match={m} saved={t.savedJobs.includes(m.item.id)} onToggleSave={() => t.toggleSavedJob(m.item.id)} />
                  </li>
              )}
              </ul>
            </>
          }

          {status === 'done' && mode === 'hire' &&
          <>
              <h2 className="text-xl font-bold text-ink">
                {t.candidateMatches.length ? `${t.candidateMatches.length} candidates${t.brief.role ? ` for ${t.brief.role}` : ''}` : 'No strong matches yet'}
              </h2>
              <p className="mt-1 text-sm text-muted">{t.candidateMatches.length ? 'Contact details are shared only after a candidate accepts your intro.' : 'Try fewer must-have skills or a lower minimum.'}</p>
              <ul className="mt-4 grid gap-3 xl:grid-cols-2">
                {t.candidateMatches.map((m) =>
              <li key={m.item.id}>
                    <CandidateCard
                  match={m}
                  shortlisted={t.shortlist.includes(m.item.id)}
                  introRequested={t.intros.includes(m.item.id)}
                  onToggleShortlist={() => t.toggleShortlist(m.item.id)}
                  onRequestIntro={() => {
                    t.requestIntro(m.item.id);
                    toast.success(`Intro sent to ${m.item.name.split(' ')[0]}`, { description: 'We’ll notify you when they reply.' });
                  }} />
                
                  </li>
              )}
              </ul>
            </>
          }
        </div>
      </div>
    </>);

}