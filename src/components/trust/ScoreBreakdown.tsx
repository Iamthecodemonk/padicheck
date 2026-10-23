import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDownIcon } from 'lucide-react';
import { factorDescriptions, factorLabels } from '../../data/entityTypes';
import { factorShares, factorStrength } from '../../utils/trustScore';
import type { FactorKey, ScoreFactor } from '../../types/trust';

interface ScoreBreakdownProps {
  factors: ScoreFactor[];
  weights: Record<FactorKey, number>;
  version: string;
  defaultOpen?: boolean;
}

/**
 * Explains the score in qualitative terms (Strong / Fair / Weak / Concern) and relative influence.
 * Exact rule thresholds are deliberately not shown, so the score can't be gamed.
 */
export function ScoreBreakdown({ factors, weights, version, defaultOpen = false }: ScoreBreakdownProps) {
  const [open, setOpen] = useState(defaultOpen);
  const rows = factorShares(factors, weights).sort((a, b) => b.share - a.share);

  return (
    <section className="rounded-3xl bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-[64px] w-full items-center gap-3 px-5 text-left">
        
        <span className="flex-1 font-semibold text-ink">How was this score calculated?</span>
        <ChevronDownIcon className={`h-5 w-5 text-muted transition-transform duration-200 ease-out ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open &&
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          className="overflow-hidden">
          
            <div className="px-5 pb-5">
              <p className="text-sm leading-relaxed text-ink-soft">
                The PadiCheck Score combines the categories below. Categories that don’t apply to this check are left out. Bigger bars carried more influence.
              </p>
              <ul className="mt-4 space-y-4">
                {rows.map((f) => {
                const s = factorStrength(f.score);
                return (
                  <li key={f.key}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-ink">{factorLabels[f.key]}</span>
                        <span className="text-sm font-semibold text-ink-soft">{s.label}</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-canvas" aria-hidden="true">
                        <div className={`h-full rounded-full ${s.tone}`} style={{ width: `${Math.max(8, f.share * 3)}%` }} />
                      </div>
                      <p className="mt-1 text-sm text-muted">{f.note || factorDescriptions[f.key]}</p>
                    </li>);

              })}
              </ul>
              <p className="mt-5 text-xs text-muted">Scoring model v{version}. AI signals alone can only move a score a small amount, and every report is reviewed by a person before it counts in full.</p>
            </div>
          </motion.div>
        }
      </AnimatePresence>
    </section>);

}