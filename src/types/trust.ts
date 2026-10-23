/** Data models for the trust layer. Shapes mirror what the PadiCheck API is expected to return. */

export type EntityType = 'phone' | 'business' | 'website' | 'person' | 'property' | 'job' | 'social' | 'listing';

export type FactorKey = 'identity' | 'business' | 'website' | 'phone' | 'social' | 'reports' | 'reviews' | 'history' | 'ai';

/** Where a piece of information came from. Drives the labels users see. */
export type SignalSource = 'verified' | 'reports' | 'ai' | 'warning';

export interface TrustSignal {
  source: SignalSource;
  positive: boolean;
  text: string;
}

export interface ScoreFactor {
  key: FactorKey;
  score: number;
  note: string;
}

export interface EntityFact {
  label: string;
  value: string;
  source: 'verified' | 'public' | 'ai' | 'user';
}

export type Confidence = 'High' | 'Medium' | 'Low';
export type VerificationLevel = 'verified' | 'partial' | 'unverified';

export interface TrustEntity {
  id: string;
  type: EntityType;
  name: string;
  identifier: string;
  subtitle: string;
  score: number;
  previousScore?: number;
  confidence: Confidence;
  verification: VerificationLevel;
  lastChecked: string;
  facts: EntityFact[];
  signals: TrustSignal[];
  factors: ScoreFactor[];
  unresolvedReports: number;
  totalReports: number;
  recommendation: string;
  businessSlug?: string;
}

export type ReportStatus = 'pending' | 'review' | 'resolved' | 'rejected' | 'info';

export interface ReportUpdate {
  at: string;
  text: string;
  by: string;
}

export interface UserReport {
  id: string;
  entityId: string;
  entityName: string;
  entityType: EntityType;
  category: string;
  description: string;
  evidence: string[];
  reporter: string;
  contact?: string;
  status: ReportStatus;
  risk: 'low' | 'medium' | 'high';
  flagged?: boolean;
  escalated?: boolean;
  aiSuggested?: string;
  at: string;
  updates: ReportUpdate[];
}

export type DisputeStatus = 'open' | 'review' | 'info' | 'upheld' | 'corrected' | 'removed';

export interface DisputeMessage {
  from: 'business' | 'admin';
  author: string;
  text: string;
  at: string;
}

export interface Dispute {
  id: string;
  reportId: string;
  businessId: string;
  businessName: string;
  request: 'correction' | 'removal' | 'review';
  statement: string;
  evidence: string[];
  status: DisputeStatus;
  at: string;
  messages: DisputeMessage[];
  decision?: string;
}

export interface Review {
  id: string;
  businessId: string;
  author: string;
  rating: number;
  text: string;
  at: string;
  verifiedTransaction: boolean;
  response?: string;
  status: 'published' | 'flagged' | 'removed';
  flagReason?: string;
}

export type VerificationStatus = 'none' | 'review' | 'info' | 'verified' | 'rejected' | 'suspended';
export type VerificationTier = 'Basic Verification' | 'Verified Business' | 'Business Pro';

export interface BusinessDocument {
  name: string;
  kind: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface Business {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  location: string;
  website: string;
  phone: string;
  email: string;
  socials: string[];
  regNumber: string;
  owner: string;
  verification: VerificationStatus;
  tier: VerificationTier;
  verifiedAt?: string;
  lastVerifiedAt?: string;
  submittedAt?: string;
  certificateId?: string;
  infoRequest?: string;
  score: number;
  views30d: number;
  checks30d: number;
  documents: BusinessDocument[];
  entityId?: string;
  /** Paid yearly listing in the public business directory. */
  directory?: DirectoryListing;
}

export type ListingStatus = 'pending' | 'active' | 'rejected' | 'expired' | 'suspended';

export interface DirectoryListing {
  status: ListingStatus;
  feeNaira: number;
  submittedAt: string;
  paidAt?: string;
  reference?: string;
  approvedAt?: string;
  expiresAt?: string;
  note?: string;
  hours?: string;
}

export interface ScoreBand {
  min: number;
  label: string;
}

export interface ScoreRule {
  id: string;
  text: string;
  effect: string;
  enabled: boolean;
}

export interface ScoreChange {
  version: string;
  by: string;
  at: string;
  reason: string;
  summary: string;
}

export interface ScoreConfig {
  version: string;
  bands: ScoreBand[];
  weights: Record<FactorKey, number>;
  minConfidenceEvidence: number;
  rules: ScoreRule[];
  history: ScoreChange[];
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  env: 'live' | 'sandbox';
  createdAt: string;
  lastUsed?: string;
  revoked?: boolean;
}

export interface ApiRequestLog {
  id: string;
  method: 'GET' | 'POST';
  path: string;
  status: number;
  ms: number;
  at: string;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  lastDelivery?: {at: string;status: number;};
}

export type NotificationCategory =
'check' |
'report' |
'dispute' |
'verification' |
'subscription' |
'payment' |
'security' |
'score' |
'saved';

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  at: string;
  read: boolean;
  to?: string;
}

export type PlanId = 'free' | 'plus' | 'pro' | 'biz-basic' | 'biz-verified' | 'biz-pro';

export interface Subscription {
  planId: PlanId;
  period: 'monthly' | 'yearly';
  status: 'active' | 'cancelled' | 'past_due';
  renewsAt: string;
}

export interface Invoice {
  id: string;
  label: string;
  amountNaira: number;
  status: 'paid' | 'failed' | 'refunded';
  method: string;
  at: string;
}

export interface AiFlag {
  id: string;
  entityName: string;
  entityType: EntityType;
  signal: string;
  confidence: number;
  model: string;
  at: string;
  status: 'pending' | 'confirmed' | 'overridden';
  reviewer?: string;
}