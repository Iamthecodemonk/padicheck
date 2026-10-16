import { ResearchError, type AnalysisDraft, type Evidence } from './types.js';

export const analysisSchema = { type: 'object', additionalProperties: false,
  required: ['summary', 'limitations', 'findings'], properties: {
    summary: { type: 'string' }, limitations: { type: 'array', items: { type: 'string' } },
    findings: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['finding_type', 'category', 'title', 'explanation', 'confidence', 'evidence'], properties: {
        finding_type: { type: 'string', enum: ['claim', 'positive_signal', 'risk_signal', 'missing_information', 'recommendation'] },
        category: { type: 'string' }, title: { type: 'string' }, explanation: { type: 'string' },
        confidence: { type: ['number', 'null'] },
        evidence: { type: 'array', items: { type: 'object', additionalProperties: false,
          required: ['source_id', 'quote', 'support_type'], properties: {
            source_id: { type: 'string' }, quote: { type: 'string' },
            support_type: { type: 'string', enum: ['supports', 'contradicts', 'context'] },
          } } },
      } } },
  } };

const text = (value: unknown, max: number): value is string => typeof value === 'string' && !!value.trim() && value.length <= max;
export function validateAnalysis(value: unknown, sources: Evidence[]): AnalysisDraft {
  const bad = () => { throw new ResearchError('invalid_model_output'); };
  if (!value || typeof value !== 'object') return bad();
  const result = value as AnalysisDraft;
  if (!text(result.summary, 3000) || !Array.isArray(result.limitations) || !result.limitations.length || result.limitations.length > 10 ||
      result.limitations.some(limit => !text(limit, 500)) || !Array.isArray(result.findings) || !result.findings.length || result.findings.length > 20) return bad();
  for (const finding of result.findings) {
    if (!finding || !['claim', 'positive_signal', 'risk_signal', 'missing_information', 'recommendation'].includes(finding.finding_type) ||
        !text(finding.category, 100) || !text(finding.title, 200) || !text(finding.explanation, 3000) ||
        (finding.confidence !== null && (typeof finding.confidence !== 'number' || !Number.isFinite(finding.confidence) || finding.confidence < 0 || finding.confidence > 1)) ||
        !Array.isArray(finding.evidence) || !finding.evidence.length || finding.evidence.length > 5) return bad();
    const used = new Set<string>();
    for (const evidence of finding.evidence) {
      if (!evidence || !text(evidence.source_id, 36) || !text(evidence.quote, 1000) || !['supports', 'contradicts', 'context'].includes(evidence.support_type)) return bad();
      const source = sources.find(source => source.source_id === evidence.source_id);
      if (!source || !source.excerpt.includes(evidence.quote) || used.has(evidence.source_id)) return bad();
      used.add(evidence.source_id);
    }
  }
  // This is an additional guard, not a replacement for evidence and review.
  const claims = [result.summary, ...result.findings.map(finding => finding.title + ' ' + finding.explanation)].join(' ');
  if (/\b(this (investigation|evidence)|the investigation|these sources)\s+(conclusively\s+)?proves?\b|\bguaranteed safe\b|\bdefinitely (a )?scam\b/i.test(claims)) return bad();
  return result;
}
