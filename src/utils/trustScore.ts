import type { FactorKey, ScoreBand, ScoreFactor } from '../types/trust';

export const defaultBands: ScoreBand[] = [
{ min: 90, label: 'Highly Trusted' },
{ min: 75, label: 'Generally Trusted' },
{ min: 60, label: 'Proceed With Caution' },
{ min: 40, label: 'High Caution' },
{ min: 0, label: 'High Risk' }];


export type BandTone = 'trusted' | 'good' | 'caution' | 'warning' | 'risk';

export interface BandMeta {
  label: string;
  tone: BandTone;
  /** Short risk level for compact lists. */
  risk: 'Low risk' | 'Medium risk' | 'High risk';
  text: string;
  soft: string;
  stroke: string;
}

const toneStyles: Record<BandTone, Omit<BandMeta, 'label' | 'tone' | 'risk'>> = {
  trusted: { text: 'text-brand-dark', soft: 'bg-brand-soft text-brand-dark', stroke: 'stroke-brand' },
  good: { text: 'text-teal', soft: 'bg-teal-soft text-teal', stroke: 'stroke-teal' },
  caution: { text: 'text-amber', soft: 'bg-amber-soft text-amber', stroke: 'stroke-amber' },
  warning: { text: 'text-caution', soft: 'bg-caution-soft text-caution', stroke: 'stroke-caution' },
  risk: { text: 'text-danger', soft: 'bg-danger-soft text-danger', stroke: 'stroke-danger' }
};

const tones: BandTone[] = ['trusted', 'good', 'caution', 'warning', 'risk'];

export function scoreBand(score: number, bands: ScoreBand[] = defaultBands): BandMeta {
  const sorted = [...bands].sort((a, b) => b.min - a.min);
  const index = Math.max(0, sorted.findIndex((b) => score >= b.min));
  const tone = tones[Math.min(index, tones.length - 1)];
  const risk = index <= 1 ? 'Low risk' : index === 2 ? 'Medium risk' : 'High risk';
  return { label: sorted[index]?.label ?? 'Unscored', tone, risk, ...toneStyles[tone] };
}

/** Weighted average of the factors that apply. Weights are relative, not percentages. */
export function weightedScore(factors: ScoreFactor[], weights: Record<FactorKey, number>): number {
  const total = factors.reduce((s, f) => s + (weights[f.key] ?? 0), 0);
  if (!total) return 0;
  return Math.round(factors.reduce((s, f) => s + f.score * (weights[f.key] ?? 0), 0) / total);
}

/** Share of the score each factor contributed, for the "How was this calculated?" explainer. */
export function factorShares(factors: ScoreFactor[], weights: Record<FactorKey, number>) {
  const total = factors.reduce((s, f) => s + (weights[f.key] ?? 0), 0) || 1;
  return factors.map((f) => ({ ...f, share: Math.round((weights[f.key] ?? 0) / total * 100) }));
}

/** Qualitative strength label, so we explain factors without exposing exact internals. */
export function factorStrength(score: number): {label: string;tone: string;} {
  if (score >= 80) return { label: 'Strong', tone: 'bg-brand' };
  if (score >= 60) return { label: 'Fair', tone: 'bg-teal' };
  if (score >= 40) return { label: 'Weak', tone: 'bg-amber' };
  return { label: 'Concern', tone: 'bg-danger' };
}