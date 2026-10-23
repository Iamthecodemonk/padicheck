import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckIcon, LoaderCircleIcon } from 'lucide-react';

const steps = [
'Understanding your opportunity...',
'Checking available information...',
'Comparing relevant data...',
'Identifying risks...',
'Preparing your report...'];


export function AnalysisProgress({ title, onDone }: {title: string;onDone: () => void;}) {
  const [step, setStep] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (step >= steps.length) {
      doneRef.current();
      return;
    }
    const t = window.setTimeout(() => setStep((s) => s + 1), 1100);
    return () => window.clearTimeout(t);
  }, [step]);

  return (
    <section className="mx-auto flex min-h-[70dvh] w-full max-w-md flex-col justify-center px-6" aria-live="polite">
      <p className="text-sm font-medium text-brand-dark">Analyzing</p>
      <h1 className="mt-1 text-2xl font-bold leading-tight text-ink">{title}</h1>
      <ol className="mt-8 space-y-4">
        {steps.map((label, i) => {
          const state = i < step ? 'done' : i === step ? 'active' : 'upcoming';
          return (
            <motion.li
              key={label}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04, ease: [0.23, 1, 0.32, 1] }}
              className="flex items-center gap-3">
              
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                state === 'done' ? 'bg-brand text-white' : state === 'active' ? 'bg-ink text-white' : 'bg-line text-muted'}`
                }>
                
                {state === 'done' ?
                <CheckIcon className="h-4 w-4" aria-hidden="true" /> :
                state === 'active' ?
                <LoaderCircleIcon className="h-4 w-4 animate-spin" aria-hidden="true" /> :

                <span className="h-1.5 w-1.5 rounded-full bg-muted/60" />
                }
              </span>
              <span className={`text-[15px] ${state === 'upcoming' ? 'text-muted' : 'font-medium text-ink'}`}>{label}</span>
            </motion.li>);

        })}
      </ol>
      <p className="mt-10 text-sm text-muted">You can leave this screen. We’ll notify you when your report is ready.</p>
    </section>);

}