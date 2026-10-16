export class ResearchError extends Error {
  constructor(public code: string) { super(code); }
}
export type SearchResult = { url: string; title: string; snippet: string };
export type RetrievedPage = { url: string; title: string; text: string; truncated: boolean };
export type Evidence = { source_id: string; title: string | null; url: string | null; excerpt: string; source_type: string; content_kind?: string };
export type FindingDraft = {
  finding_type: 'claim' | 'positive_signal' | 'risk_signal' | 'missing_information' | 'recommendation';
  category: string; title: string; explanation: string; confidence: number | null;
  evidence: { source_id: string; quote: string; support_type: 'supports' | 'contradicts' | 'context' }[];
};
export type AnalysisDraft = { summary: string; limitations: string[]; findings: FindingDraft[] };
export type ModelResult = {
  output: unknown; requestId?: string; inputTokens?: number; outputTokens?: number;
};
export type Assignment = {
  assignment_id: string; task_id: string; task_code: string; agent_id: string; model_id: string;
  provider_code: string; provider_model_id: string; credential_secret_ref: string | null;
  instructions_template: string; prompt_version: string; priority: number;
  model_config: Record<string, unknown>; config_override: Record<string, unknown>;
};
export interface ResearchAdapters {
  search(query: string, maxResults: number, secretRef: string | null): Promise<SearchResult[]>;
  fetchPage(url: string): Promise<RetrievedPage>;
  extractPdf(data: Buffer): Promise<{ text: string; pages: number; truncated: boolean }>;
  downloadDocument(publicId: string): Promise<Buffer>;
  analyze(assignment: Assignment, question: string, evidence: Evidence[]): Promise<ModelResult>;
}
