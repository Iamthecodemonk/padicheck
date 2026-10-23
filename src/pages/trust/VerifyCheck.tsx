import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckIcon, InfoIcon, LoaderCircleIcon, SearchIcon } from 'lucide-react';
import { ConfirmCheckSheet } from '../../components/check/ConfirmCheckSheet';
import { PageHeader } from '../../components/consumer/PageHeader';
import { StateView, type StateKind } from '../../components/trust/StateView';
import { usePwa } from '../../contexts/PwaContext';
import { useTrust } from '../../contexts/TrustContext';
import { useUser } from '../../contexts/UserContext';
import { entityTypeById } from '../../data/entityTypes';
import { track } from '../../utils/analytics';
import { ApiError, runTrustCheck, validateCheckInput } from '../../utils/trustApi';

const steps = ['Searching sources…', 'Analysing signals…', 'Verifying records…', 'Calculating the PadiCheck Score…'];

type Phase = 'input' | 'loading' | StateKind;

export function VerifyCheck() {
  const { type = '' } = useParams<{type: string;}>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const meta = entityTypeById(type);
  const { online } = usePwa();
  const { credits, spendCredits, addCredits } = useUser();
  const { entities, upsertEntity, recordCheck } = useTrust();
  const [value, setValue] = useState(params.get('q') ?? '');
  const [country, setCountry] = useState('+234');
  const [touched, setTouched] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('input');
  const [step, setStep] = useState(0);
  const [retryAfter, setRetryAfter] = useState(0);

  useEffect(() => {
    if (phase !== 'loading') return;
    setStep(0);
    const t = window.setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 700);
    return () => window.clearInterval(t);
  }, [phase]);

  if (!meta) return <Navigate to="/verify" replace />;

  const fullInput = meta.id === 'phone' && !value.trim().startsWith('+') && !value.trim().startsWith('0') ? `${country}${value}` : value;
  const error = validateCheckInput(meta.id, fullInput);

  const start = () => {
    setTouched(true);
    if (error) return;
    setConfirmOpen(true);
  };

  const run = async () => {
    setConfirmOpen(false);
    if (!spendCredits(meta.credits, meta.checkLabel)) return;
    setPhase('loading');
    track('check_started', { type: meta.id });
    try {
      const result = await runTrustCheck(meta.id, fullInput, entities);
      if (!result) {
        addCredits(meta.credits, 'Refund · no result found');
        setPhase('no-result');
        return;
      }
      upsertEntity(result);
      recordCheck(result.id);
      track('check_completed', { type: meta.id, score: result.score });
      navigate(`/report/${result.id}`, { replace: true });
    } catch (e) {
      addCredits(meta.credits, 'Refund · check did not run');
      if (e instanceof ApiError) {
        setRetryAfter(e.retryAfter ?? 0);
        setPhase(e.code === 'rate_limited' ? 'rate-limited' : e.code === 'network' ? 'network' : 'unavailable');
      } else setPhase('error');
    }
  };

  if (phase === 'loading') {
    return (
      <section className="mx-auto flex min-h-[80dvh] w-full max-w-md flex-col justify-center px-6" aria-live="polite">
        <p className="text-sm font-medium text-brand-dark">{meta.checkLabel}</p>
        <h1 className="mt-1 break-words text-2xl font-bold leading-tight text-ink">{value}</h1>
        <ol className="mt-8 space-y-4">
          {steps.map((label, i) => {
            const state = i < step ? 'done' : i === step ? 'active' : 'upcoming';
            return (
              <motion.li key={label} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: i * 0.04 }} className="flex items-center gap-3">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${state === 'done' ? 'bg-brand text-white' : state === 'active' ? 'bg-ink text-canvas' : 'bg-line text-muted'}`}>
                  {state === 'done' ? <CheckIcon className="h-4 w-4" aria-hidden="true" /> : state === 'active' ? <LoaderCircleIcon className="h-4 w-4 animate-spin" aria-hidden="true" /> : <span className="h-1.5 w-1.5 rounded-full bg-muted/60" />}
                </span>
                <span className={`text-[15px] ${state === 'upcoming' ? 'text-muted' : 'font-medium text-ink'}`}>{label}</span>
              </motion.li>);

          })}
        </ol>
      </section>);

  }

  if (phase !== 'input') {
    return (
      <>
        <PageHeader title={meta.checkLabel} back="/verify" />
        <div className="mx-auto w-full max-w-xl px-4">
          <StateView
            kind={phase}
            body={phase === 'rate-limited' ? `Please wait about ${retryAfter} seconds, then try again. Your credits were returned.` : phase === 'no-result' ? `No public information matched “${value}”. Your credits were returned. That isn’t proof it’s safe — ask for more details.` : undefined}
            action={
            <>
                <button type="button" onClick={() => setPhase('input')} className="h-12 rounded-2xl bg-brand px-6 font-semibold text-white hover:bg-brand-dark">
                  {phase === 'no-result' ? 'Edit and try again' : 'Try again'}
                </button>
                {phase === 'no-result' &&
              <button type="button" onClick={() => navigate(`/report-issue?name=${encodeURIComponent(value)}&type=${meta.id}`)} className="h-12 rounded-2xl px-6 font-semibold text-ink ring-1 ring-line hover:bg-canvas">
                    Report it anyway
                  </button>
              }
              </>
            } />
          
        </div>
      </>);

  }

  return (
    <>
      <PageHeader title={meta.checkLabel} back="/verify" />
      <div className="mx-auto w-full max-w-6xl px-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12 lg:px-10">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            start();
          }}>
          
          <span className={`grid h-12 w-12 place-items-center rounded-2xl ${meta.tile}`}>
            <meta.icon className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-2xl font-bold text-ink lg:text-3xl">What are we checking?</h2>
          <p className="mt-2 max-w-xl text-ink-soft">{meta.why}</p>

          <label htmlFor="verify-input" className="mt-6 block text-sm font-medium text-ink">
            {meta.inputLabel}
          </label>
          <div className={`mt-1.5 flex rounded-2xl bg-surface ring-1 focus-within:ring-2 ${touched && error ? 'ring-danger' : 'ring-line focus-within:ring-brand'}`}>
            {meta.id === 'phone' &&
            <>
                <label htmlFor="country" className="sr-only">
                  Country code
                </label>
                <select id="country" value={country} onChange={(e) => setCountry(e.target.value)} className="h-14 rounded-l-2xl border-r border-line bg-transparent pl-4 pr-2 text-base text-ink outline-none">
                  <option value="+234">NG +234</option>
                  <option value="+233">GH +233</option>
                  <option value="+254">KE +254</option>
                  <option value="+27">ZA +27</option>
                  <option value="+44">UK +44</option>
                </select>
              </>
            }
            <input
              id="verify-input"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => setTouched(true)}
              inputMode={meta.inputMode}
              type={meta.inputMode === 'url' ? 'url' : meta.inputMode === 'tel' ? 'tel' : 'text'}
              placeholder={meta.placeholder}
              aria-invalid={touched && Boolean(error)}
              aria-describedby="verify-error"
              className="h-14 min-w-0 flex-1 rounded-2xl bg-transparent px-4 text-[17px] text-ink outline-none placeholder:text-muted/80" />
            
          </div>
          <p id="verify-error" role="alert" className="mt-1.5 min-h-[20px] text-sm text-danger">
            {touched && error ? error : ''}
          </p>

          <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+12px)] z-10 mt-4">
            <button type="submit" className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-semibold text-white shadow-float transition-colors hover:bg-brand-dark sm:w-auto sm:px-8 lg:shadow-none">
              <SearchIcon className="h-5 w-5" aria-hidden="true" /> Check Now · {meta.credits} credit{meta.credits > 1 ? 's' : ''}
            </button>
          </div>
        </form>

        <aside className="mt-10 space-y-4 lg:mt-16">
          <section className="rounded-3xl bg-surface p-5">
            <h3 className="font-semibold text-ink">Good things to check</h3>
            <ul className="mt-3 space-y-2">
              {meta.examples.map((ex) =>
              <li key={ex} className="flex gap-2 text-[15px] text-ink-soft">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" /> {ex}
                </li>
              )}
            </ul>
          </section>
          <p className="flex gap-2 rounded-3xl bg-sky-soft p-5 text-sm leading-relaxed text-sky">
            <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Results combine verified records, user reports and AI risk signals. Each is labelled so you know what’s confirmed and what isn’t. If nothing is found, your credits come back.
          </p>
        </aside>
      </div>
      <ConfirmCheckSheet open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={run} checkLabel={meta.checkLabel} summary={value} cost={meta.credits} credits={credits} online={online} />
    </>);

}