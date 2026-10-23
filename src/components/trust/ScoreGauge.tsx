import React from 'react';
import { motion } from 'framer-motion';
import { scoreBand } from '../../utils/trustScore';
import type { ScoreBand } from '../../types/trust';

interface ScoreGaugeProps {
  score: number;
  size?: 'sm' | 'lg';
  bands?: ScoreBand[];
}

/** Circular PadiCheck Score. The number is the hero; the band name explains it in words. */
export function ScoreGauge({ score, size = 'lg', bands }: ScoreGaugeProps) {
  const band = scoreBand(score, bands);
  const dim = size === 'lg' ? 168 : 64;
  const stroke = size === 'lg' ? 12 : 6;
  const r = (dim - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div className="relative shrink-0" style={{ width: dim, height: dim }} role="img" aria-label={`PadiCheck Score ${score} out of 100, ${band.label}`}>
      <svg width={dim} height={dim} className="-rotate-90" aria-hidden="true">
        <circle cx={dim / 2} cy={dim / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-line" />
        <motion.circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={band.stroke}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - score / 100 * c }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }} />
        
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <span className={`font-bold tabular-nums leading-none text-ink ${size === 'lg' ? 'text-5xl' : 'text-lg'}`}>{score}</span>
        {size === 'lg' && <span className="mt-1 text-sm text-muted">out of 100</span>}
      </div>
    </div>);

}

export function ScoreChip({ score, bands }: {score: number;bands?: ScoreBand[];}) {
  const band = scoreBand(score, bands);
  return (
    <span className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-bold tabular-nums ${band.soft}`} title={band.label}>
      {score}
      <span className="sr-only">out of 100, {band.label}</span>
    </span>);

}