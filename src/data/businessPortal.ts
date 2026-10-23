import type { VerificationStatus } from '../types/trust';

export const verificationStatusMeta: Record<VerificationStatus, {label: string;text: string;soft: string;}> = {
  none: { label: 'Not verified', text: 'text-muted', soft: 'bg-canvas text-muted' },
  review: { label: 'Verification in review', text: 'text-sky', soft: 'bg-sky-soft text-sky' },
  info: { label: 'More information needed', text: 'text-caution', soft: 'bg-caution-soft text-caution' },
  verified: { label: 'PadiCheck Verified', text: 'text-brand-dark', soft: 'bg-brand-soft text-brand-dark' },
  rejected: { label: 'Verification not approved', text: 'text-danger', soft: 'bg-danger-soft text-danger' },
  suspended: { label: 'Verification suspended', text: 'text-danger', soft: 'bg-danger-soft text-danger' }
};

export const requiredDocuments = [
{ kind: 'Registration', label: 'CAC certificate or business name registration', hint: 'PDF or photo of the certificate' },
{ kind: 'Identity', label: 'Owner or director ID', hint: 'NIN slip, passport or driver’s licence' },
{ kind: 'Address', label: 'Proof of business address', hint: 'Utility bill or tenancy agreement from the last 3 months' }];


export const businessCategories = ['Real estate', 'Logistics & delivery', 'Fashion & textiles', 'Electronics', 'Food & catering', 'Lending', 'Recruitment', 'Automotive', 'Professional services', 'Other'];

export const profileViews14d = [18, 22, 31, 25, 28, 19, 15, 26, 34, 29, 37, 33, 21, 27];

export const businessTeamRoles = ['Owner', 'Admin', 'Member'] as const;