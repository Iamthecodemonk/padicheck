import type { AnalysisResult, CheckType } from '../types/check';

export const results: AnalysisResult[] = [
{
  id: 'r-iphone',
  type: 'shopping',
  categoryLabel: 'Product opportunity',
  title: 'iPhone 17 Pro 256GB',
  price: '₦1,250,000',
  source: 'jiji.ng',
  createdAt: '2026-10-03T09:12:00',
  verdict: 'caution',
  summary: "The price is in line with the market, but the seller is new and hasn't shown proof the phone is unlocked.",
  sections: [
  { label: 'Price', verdict: 'good', headline: 'Competitive', detail: 'Within 4% of the average across 23 similar listings in Lagos this month.' },
  { label: 'Seller', verdict: 'caution', headline: 'Some information still needs verification', detail: 'Account created 3 weeks ago, 2 reviews, no verified phone number.' },
  { label: 'Product', verdict: 'good', headline: 'Specs match the model', detail: 'Storage, colour and box contents match Apple’s published specs.' },
  { label: 'Payment', verdict: 'caution', headline: 'Transfer before inspection', detail: 'The listing asks for a deposit by bank transfer before you see the phone.' }],

  looksGood: ['Price matches recent sales of the same model', 'Photos are original — not found elsewhere online', 'Box photo shows a readable serial number'],
  toCheck: ['Meet in a public place and inspect before paying', 'Check the serial on Apple’s coverage page', 'Ask for the original purchase receipt', 'Avoid paying any deposit by transfer'],
  creditsUsed: 2,
  availableOffline: true
},
{
  id: 'r-doubleup',
  type: 'link',
  categoryLabel: 'Link',
  title: 'DoubleUp Naira investment plan',
  price: 'Promises 40% monthly',
  source: 'doubleup-naira.com',
  createdAt: '2026-10-02T18:40:00',
  verdict: 'risk',
  summary: 'This shows several signs of a Ponzi-style scheme. We recommend not sending money.',
  sections: [
  { label: 'Returns', verdict: 'risk', headline: 'Unrealistic', detail: '40% a month is over 5,000% a year. No regulated investment offers this.' },
  { label: 'Registration', verdict: 'risk', headline: 'Not registered with SEC Nigeria', detail: 'No matching entity in the SEC register or CAC search.' },
  { label: 'Website', verdict: 'risk', headline: 'Domain is 11 days old', detail: 'Registered privately on 21 September with no company address.' }],

  looksGood: ['The site uses HTTPS'],
  toCheck: ['Search the SEC Nigeria register before investing anywhere', 'Be wary of referral bonuses for bringing friends', 'Report the site if you were contacted unsolicited'],
  creditsUsed: 1,
  availableOffline: true
},
{
  id: 'r-lekki',
  type: 'property',
  categoryLabel: 'Property opportunity',
  title: '2-bedroom flat, Lekki Phase 1',
  price: '₦4,500,000 / year',
  source: 'propertypro.ng',
  createdAt: '2026-10-01T14:05:00',
  verdict: 'caution',
  summary: 'A fair listing from a registered agent, but the upfront fees are high for the area.',
  sections: [
  { label: 'Rent', verdict: 'caution', headline: 'Slightly above average', detail: '8% above the median for 2-bedroom flats within 1 km.' },
  { label: 'Agent', verdict: 'good', headline: 'Registered, with history', detail: 'Listed on the platform for 4 years with 31 active listings.' },
  { label: 'Fees', verdict: 'risk', headline: 'Fees add 25% upfront', detail: 'Agency 10%, legal 10% and caution fee 5% — above the usual 15–20%.' },
  { label: 'Location', verdict: 'good', headline: 'Good access', detail: '6 minutes to Admiralty Way; no recent flood reports on this street.' }],

  looksGood: ['Agent is verifiable and long-standing', 'Photos match the street view', 'Price is negotiable according to the listing'],
  toCheck: ['Inspect in person before paying anything', 'Ask for fees in writing and negotiate the legal fee', 'Confirm the landlord’s ownership documents'],
  creditsUsed: 3,
  availableOffline: true
},
{
  id: 'r-remote-job',
  type: 'job',
  categoryLabel: 'Job opportunity',
  title: 'Remote Customer Success Associate',
  price: '$900 / month',
  source: 'linkedin.com',
  createdAt: '2026-09-29T11:20:00',
  verdict: 'good',
  summary: 'The company is real and the role looks legitimate. Pay is fair for the region.',
  sections: [
  { label: 'Employer', verdict: 'good', headline: 'Verified company', detail: 'Registered in Delaware, 120 employees, active since 2019.' },
  { label: 'Pay', verdict: 'good', headline: 'Fair for the role', detail: 'In line with similar remote roles hiring in West Africa.' },
  { label: 'Process', verdict: 'good', headline: 'No upfront fees', detail: 'Interview is on the company’s own domain. No payment requested.' }],

  looksGood: ['Recruiter profile is 6 years old with real connections', 'Job also listed on the company’s careers page'],
  toCheck: ['Only share your ID after a signed offer', 'Confirm how and when you’ll be paid'],
  creditsUsed: 2,
  availableOffline: false
},
{
  id: 'r-logo-client',
  type: 'freelance',
  categoryLabel: 'Freelance opportunity',
  title: 'Brand identity for a fintech startup',
  price: '$1,200 fixed',
  source: 'upwork.com',
  createdAt: '2026-09-27T16:45:00',
  verdict: 'good',
  summary: 'A real client with a fair budget. Agree on milestones before you start.',
  sections: [
  { label: 'Client', verdict: 'good', headline: 'Payment verified', detail: '14 past hires, 4.9 average rating, $28k spent on the platform.' },
  { label: 'Scope', verdict: 'caution', headline: 'Scope is broad', detail: 'Logo, guidelines and “all social assets” — clarify what’s included.' }],

  looksGood: ['Payment is held in escrow', 'Client responds within hours'],
  toCheck: ['Split the work into 3 funded milestones', 'Limit revision rounds in writing'],
  creditsUsed: 2,
  availableOffline: true
},
{
  id: 'r-tenancy',
  type: 'contract',
  categoryLabel: 'Contract',
  title: 'Tenancy agreement — Yaba',
  source: 'Uploaded PDF · 6 pages',
  createdAt: '2026-09-24T10:02:00',
  verdict: 'caution',
  summary: 'Mostly standard, but two clauses put repair costs and early exit penalties on you.',
  sections: [
  { label: 'Repairs', verdict: 'risk', headline: 'All repairs on the tenant', detail: 'Clause 7 makes you responsible for structural repairs, which is unusual.' },
  { label: 'Exit', verdict: 'caution', headline: '3 months’ penalty', detail: 'Leaving early forfeits 3 months of rent with no sublet option.' },
  { label: 'Renewal', verdict: 'good', headline: 'Clear renewal terms', detail: 'Rent increases are capped at 10% per renewal.' }],

  looksGood: ['Deposit refund timeline is defined (14 days)', 'Both parties’ details are complete'],
  toCheck: ['Ask to limit Clause 7 to minor repairs', 'Negotiate a sublet option or shorter penalty'],
  creditsUsed: 4,
  availableOffline: true
}];


export const demoResultByType: Record<CheckType, string> = {
  any: 'r-iphone',
  link: 'r-doubleup',
  shopping: 'r-iphone',
  property: 'r-lekki',
  job: 'r-remote-job',
  freelance: 'r-logo-client',
  contract: 'r-tenancy'
};