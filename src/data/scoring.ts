import { defaultBands } from '../utils/trustScore';
import type { ScoreConfig } from '../types/trust';

export const initialScoreConfig: ScoreConfig = {
  version: '3.2',
  bands: defaultBands,
  weights: { identity: 18, business: 14, website: 10, phone: 10, social: 8, reports: 16, reviews: 8, history: 8, ai: 8 },
  minConfidenceEvidence: 3,
  rules: [
  { id: 'rule-fee', text: 'Upfront fee requested for a job', effect: 'Cap score at 30', enabled: true },
  { id: 'rule-domain', text: 'Domain younger than 30 days', effect: '−15 points', enabled: true },
  { id: 'rule-upheld', text: 'Two or more upheld fraud reports', effect: 'Cap score at 25', enabled: true },
  { id: 'rule-verified', text: 'PadiCheck Verified Business', effect: '+8 points, minimum 70', enabled: true },
  { id: 'rule-ai-only', text: 'AI signals alone can lower a score by at most', effect: '−10 points', enabled: true }],

  history: [
  { version: '3.2', by: 'Tunde Bakare', at: '2026-09-20T10:00:00', reason: 'Reduce influence of unreviewed AI signals', summary: 'AI weight 12 → 8, added AI-only cap' },
  { version: '3.1', by: 'Amara Nwosu', at: '2026-08-02T10:00:00', reason: 'Fake-job reports rising', summary: 'Added upfront-fee rule' }]

};