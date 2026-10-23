export type CheckType = 'any' | 'link' | 'shopping' | 'property' | 'job' | 'freelance' | 'contract';
export type InputMode = 'link' | 'text' | 'camera' | 'upload';
export type Verdict = 'good' | 'caution' | 'risk';

export interface ResultSection {
  label: string;
  verdict: Verdict;
  headline: string;
  detail: string;
}

export interface AnalysisResult {
  id: string;
  type: Exclude<CheckType, 'any'>;
  categoryLabel: string;
  title: string;
  price?: string;
  source: string;
  createdAt: string;
  verdict: Verdict;
  summary: string;
  sections: ResultSection[];
  looksGood: string[];
  toCheck: string[];
  creditsUsed: number;
  availableOffline: boolean;
}

export type QueueStatus = 'waiting' | 'uploading' | 'processing' | 'done' | 'failed';

export interface QueuedTask {
  id: string;
  type: CheckType;
  mode: InputMode;
  label: string;
  sizeBytes?: number;
  credits: number;
  createdAt: string;
  status: QueueStatus;
  resultId?: string;
  error?: string;
}

export interface CreditTransaction {
  id: string;
  label: string;
  amount: number;
  at: string;
}

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  priceNaira: number;
  note?: string;
  active?: boolean;
  featured?: boolean;
}

export interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'reading' | 'ready' | 'error';
  error?: string;
}

export interface ConsumerSession {
  name: string;
  email: string;
  provider: 'email' | 'google' | 'apple' | 'otp';
}