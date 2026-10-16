export const investigationTypes = ['company_research', 'web_analysis', 'job_search', 'contract_review', 'phone_lookup', 'general_research'] as const;
export type InvestigationType = typeof investigationTypes[number];
export const entityTypes = ['business', 'person', 'website', 'job_listing', 'property_listing', 'service_provider', 'other'] as const;
export const identifierTypes = ['phone', 'email', 'url', 'domain', 'social_profile', 'registration_number', 'address', 'other'] as const;
export type Status = 'queued' | 'collecting_sources' | 'analyzing' | 'completed' | 'failed' | 'cancelled';
export type IdentifierInput = { identifier_type: typeof identifierTypes[number]; value: string };
export type TargetInput = {
  entity_type: typeof entityTypes[number]; canonical_name: string;
  target_role?: 'primary' | 'candidate' | 'comparison'; identifiers?: IdentifierInput[];
};
export type InvestigationInput = { urls?: string[]; media_ids?: string[]; targets?: TargetInput[] };
export type CreateInvestigation = {
  investigation_type: InvestigationType; title?: string; user_prompt: string; input_data?: InvestigationInput;
};
export type Investigation = {
  investigation_id: string; user_id: string; investigation_type: InvestigationType;
  title: string | null; user_prompt: string; input_data: InvestigationInput; status: Status;
  result_summary: string | null; error_code: string | null; created_at: Date; updated_at: Date;
  started_at: Date | null; completed_at: Date | null;
};
export type QueueState = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'waiting-children' | 'unknown' | 'paused' | 'prioritized';
export interface InvestigationJobs {
  enqueue(id: string, restartFinished: boolean, revision: string): Promise<QueueState>;
  ping(): Promise<void>;
  close(): Promise<void>;
}
