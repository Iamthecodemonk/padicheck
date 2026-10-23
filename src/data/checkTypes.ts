import {
  BriefcaseIcon,
  Building2Icon,
  CameraIcon,
  FileTextIcon,
  LaptopIcon,
  Link2Icon,
  PencilLineIcon,
  ScrollTextIcon,
  ShoppingBagIcon,
  SparklesIcon,
  UploadIcon,
  type LucideIcon } from
'lucide-react';
import type { CheckType } from '../types/check';

export interface CheckTypeOption {
  id: CheckType;
  label: string;
  longLabel: string;
  hint: string;
  icon: LucideIcon;
  credits: number;
  focusAreas: string[];
  tile: string;
  accent: string;
}

export const checkTypes: CheckTypeOption[] = [
{
  id: 'link',
  label: 'Link',
  longLabel: 'Check a link',
  hint: 'Any listing, post or offer',
  icon: Link2Icon,
  credits: 1,
  tile: 'bg-sky-soft text-sky',
  accent: 'text-sky',
  focusAreas: ['Who owns the site and how old it is', 'What the page is really offering', 'Known scam patterns and reports']
},
{
  id: 'shopping',
  label: 'Product',
  longLabel: 'Shopping opportunity',
  hint: 'Price, seller, authenticity',
  icon: ShoppingBagIcon,
  credits: 2,
  tile: 'bg-violet-soft text-violet',
  accent: 'text-violet',
  focusAreas: ['Price against similar listings', 'Seller history and reviews', 'Whether photos are original', 'Payment and delivery terms']
},
{
  id: 'property',
  label: 'Property',
  longLabel: 'Property check',
  hint: 'Rent, sale, agent, location',
  icon: Building2Icon,
  credits: 3,
  tile: 'bg-amber-soft text-amber',
  accent: 'text-amber',
  focusAreas: ['Rent or price against the area', 'Agent registration and history', 'Fees, deposits and hidden costs', 'Location and access']
},
{
  id: 'job',
  label: 'Job',
  longLabel: 'Job check',
  hint: 'Employer, pay, red flags',
  icon: BriefcaseIcon,
  credits: 2,
  tile: 'bg-brand-soft text-brand-dark',
  accent: 'text-brand',
  focusAreas: ['Whether the employer is real', 'Pay against the market', 'Upfront fees or data requests', 'How the role was advertised']
},
{
  id: 'freelance',
  label: 'Freelance',
  longLabel: 'Freelance check',
  hint: 'Client, scope, payment',
  icon: LaptopIcon,
  credits: 2,
  tile: 'bg-rose-soft text-rose',
  accent: 'text-rose',
  focusAreas: ['Client identity and history', 'Scope against the budget', 'Payment protection and milestones']
},
{
  id: 'contract',
  label: 'Contract',
  longLabel: 'Contract review',
  hint: 'Clauses, obligations, risks',
  icon: ScrollTextIcon,
  credits: 4,
  tile: 'bg-teal-soft text-teal',
  accent: 'text-teal',
  focusAreas: ['What you are agreeing to', 'Unusual or one-sided clauses', 'Penalties, notice and renewal terms']
}];


export const anyCheck: CheckTypeOption = {
  id: 'any',
  label: 'Anything',
  longLabel: 'New check',
  hint: 'PadiCheck works out what it is',
  icon: SparklesIcon,
  credits: 2,
  tile: 'bg-brand-soft text-brand-dark',
  accent: 'text-brand',
  focusAreas: ['What kind of opportunity this is', 'The details that matter for that kind', 'What to verify before you commit']
};

export interface CaptureMode {
  id: 'upload' | 'camera' | 'describe' | 'document';
  label: string;
  hint: string;
  icon: LucideIcon;
  to: string;
  tile: string;
}

export const captureModes: CaptureMode[] = [
{ id: 'upload', label: 'Upload', hint: 'Photos & screenshots', icon: UploadIcon, to: '/check/any?mode=upload', tile: 'bg-amber-soft text-amber' },
{ id: 'camera', label: 'Camera', hint: 'Snap it now', icon: CameraIcon, to: '/check/any?mode=camera', tile: 'bg-violet-soft text-violet' },
{ id: 'describe', label: 'Describe', hint: 'Type what happened', icon: PencilLineIcon, to: '/check/any?mode=text', tile: 'bg-rose-soft text-rose' },
{ id: 'document', label: 'Document', hint: 'PDF, DOCX, TXT', icon: FileTextIcon, to: '/check/contract?mode=upload', tile: 'bg-teal-soft text-teal' }];