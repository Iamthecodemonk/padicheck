import {
  BriefcaseIcon,
  Building2Icon,
  GlobeIcon,
  HouseIcon,
  AtSignIcon,
  PhoneIcon,
  TagIcon,
  UserRoundIcon,
  type LucideIcon } from
'lucide-react';
import type { EntityType, FactorKey } from '../types/trust';

export interface EntityTypeMeta {
  id: EntityType;
  label: string;
  checkLabel: string;
  icon: LucideIcon;
  tile: string;
  accent: string;
  inputLabel: string;
  placeholder: string;
  why: string;
  examples: string[];
  inputMode: 'text' | 'tel' | 'url';
  credits: number;
}

/** The eight things people can check. Order is the order shown in "What do you want to check?". */
export const entityTypes: EntityTypeMeta[] = [
{
  id: 'phone',
  label: 'Phone',
  checkLabel: 'Check a phone number',
  icon: PhoneIcon,
  tile: 'bg-brand-soft text-brand-dark',
  accent: 'text-brand-dark',
  inputLabel: 'Phone number',
  placeholder: '803 555 0142',
  why: 'Before you send money or meet someone, see whether this number has been reported and whether its identity is consistent.',
  examples: ['A seller’s WhatsApp number', 'An agent who called you', 'A number that sent a payment request'],
  inputMode: 'tel',
  credits: 1
},
{
  id: 'business',
  label: 'Business',
  checkLabel: 'Check a business',
  icon: Building2Icon,
  tile: 'bg-sky-soft text-sky',
  accent: 'text-sky',
  inputLabel: 'Business name, RC number or website',
  placeholder: 'e.g. Lekki Prime Homes or RC 1234567',
  why: 'See registration details, verification status, reviews and reports before you pay a business.',
  examples: ['A vendor you found on Instagram', 'A company offering a contract', 'A registration (RC/BN) number'],
  inputMode: 'text',
  credits: 2
},
{
  id: 'website',
  label: 'Website',
  checkLabel: 'Check a website',
  icon: GlobeIcon,
  tile: 'bg-violet-soft text-violet',
  accent: 'text-violet',
  inputLabel: 'Website or link',
  placeholder: 'https://',
  why: 'Look at domain age, security, contact consistency and known scam patterns before you enter card details.',
  examples: ['An online store with low prices', 'A login or payment page', 'An investment platform'],
  inputMode: 'url',
  credits: 1
},
{
  id: 'person',
  label: 'Person',
  checkLabel: 'Check a person',
  icon: UserRoundIcon,
  tile: 'bg-rose-soft text-rose',
  accent: 'text-rose',
  inputLabel: 'Full name plus a phone, email or profile',
  placeholder: 'e.g. Emeka Obi, 0803 555 0142',
  why: 'Check whether the identity someone gives you is consistent across public sources. We only use information that is lawful to share.',
  examples: ['A landlord or caretaker', 'A buyer arranging pickup', 'Someone you met online'],
  inputMode: 'text',
  credits: 2
},
{
  id: 'property',
  label: 'Property',
  checkLabel: 'Check a property',
  icon: HouseIcon,
  tile: 'bg-amber-soft text-amber',
  accent: 'text-amber',
  inputLabel: 'Listing link, address or agent phone',
  placeholder: 'Paste a listing or type an address',
  why: 'Spot duplicate listings, price anomalies and unverified agents before you pay an inspection or agency fee.',
  examples: ['A rental listing', 'An agent’s phone number', 'A property address'],
  inputMode: 'text',
  credits: 3
},
{
  id: 'job',
  label: 'Job',
  checkLabel: 'Check a job or employer',
  icon: BriefcaseIcon,
  tile: 'bg-teal-soft text-teal',
  accent: 'text-teal',
  inputLabel: 'Job link, employer, recruiter email or phone',
  placeholder: 'e.g. recruiter@company.com',
  why: 'Confirm the employer exists, the email domain matches, and there are no payment requests before you share documents.',
  examples: ['A job offer by email', 'A recruitment agency', 'A job posted on social media'],
  inputMode: 'text',
  credits: 1
},
{
  id: 'social',
  label: 'Social Profile',
  checkLabel: 'Check a social profile',
  icon: AtSignIcon,
  tile: 'bg-violet-soft text-violet',
  accent: 'text-violet',
  inputLabel: 'Profile link or @username',
  placeholder: '@username or profile link',
  why: 'See account consistency, public presence and reports for an online seller or business page.',
  examples: ['An Instagram vendor', 'A TikTok shop', 'A Facebook marketplace seller'],
  inputMode: 'text',
  credits: 1
},
{
  id: 'listing',
  label: 'Listing',
  checkLabel: 'Check a listing',
  icon: TagIcon,
  tile: 'bg-sky-soft text-sky',
  accent: 'text-sky',
  inputLabel: 'Listing link',
  placeholder: 'Paste a marketplace listing',
  why: 'Check the seller, price and photos of a marketplace listing for duplicates and warning signs.',
  examples: ['A car on Jiji', 'A phone on Facebook Marketplace', 'Furniture on Instagram'],
  inputMode: 'url',
  credits: 1
}];


export const entityTypeById = (id: string) => entityTypes.find((t) => t.id === id);

export const factorLabels: Record<FactorKey, string> = {
  identity: 'Identity',
  business: 'Business',
  website: 'Website',
  phone: 'Phone',
  social: 'Social presence',
  reports: 'Reports',
  reviews: 'Reviews',
  history: 'Historical signals',
  ai: 'AI risk signals'
};

export const factorDescriptions: Record<FactorKey, string> = {
  identity: 'How consistent the identity is across independent sources.',
  business: 'Registration and verification of any linked business.',
  website: 'Domain age, security and contact consistency.',
  phone: 'Number age, reports and identity consistency.',
  social: 'Account age, activity and consistency of public profiles.',
  reports: 'User reports, weighted by whether they were reviewed and upheld.',
  reviews: 'Ratings from people who dealt with them, especially verified transactions.',
  history: 'How long this has existed and whether past signals changed.',
  ai: 'Patterns our models associate with risk. These are signals, never facts.'
};

export const reportCategories = [
'Suspicious business',
'Suspicious seller',
'Suspicious phone number',
'Suspicious website',
'Suspicious listing',
'Suspicious job',
'Misleading information',
'Fraudulent behaviour'];