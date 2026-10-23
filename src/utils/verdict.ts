import type { Verdict } from '../types/check';

export const verdictLabels: Record<Verdict, string> = {
  good: 'Looks good',
  caution: 'Check first',
  risk: 'High risk'
};

export const verdictTone: Record<Verdict, {badge: string;text: string;dot: string;}> = {
  good: { badge: 'bg-brand-soft text-brand-dark', text: 'text-brand-dark', dot: 'bg-brand' },
  caution: { badge: 'bg-caution-soft text-caution', text: 'text-caution', dot: 'bg-caution' },
  risk: { badge: 'bg-danger-soft text-danger', text: 'text-danger', dot: 'bg-danger' }
};