import type { EntityFact, FactorKey, ScoreFactor, TrustEntity, TrustSignal } from '../types/trust';

const order: FactorKey[] = ['identity', 'business', 'website', 'phone', 'social', 'reports', 'reviews', 'history', 'ai'];

/** Compact factor builder: pass scores in `order`; null means "not applicable to this check". */
const factors = (scores: (number | null)[], notes: Partial<Record<FactorKey, string>> = {}): ScoreFactor[] =>
scores.flatMap((s, i) => s === null ? [] : [{ key: order[i], score: s, note: notes[order[i]] ?? '' }]);

const v = (text: string, positive = true): TrustSignal => ({ source: 'verified', positive, text });
const r = (text: string, positive = false): TrustSignal => ({ source: 'reports', positive, text });
const ai = (text: string, positive = false): TrustSignal => ({ source: 'ai', positive, text });
const w = (text: string): TrustSignal => ({ source: 'warning', positive: false, text });
const f = (label: string, value: string, source: EntityFact['source'] = 'public'): EntityFact => ({ label, value, source });

export const trustEntities: TrustEntity[] = [
{
  id: 'e-phone-0142',
  type: 'phone',
  name: '+234 803 555 0142',
  identifier: '+2348035550142',
  subtitle: 'Registered to “Chidi Electronics” · MTN Nigeria',
  score: 82,
  previousScore: 79,
  confidence: 'High',
  verification: 'partial',
  lastChecked: '2026-10-03T14:20:00',
  facts: [
  f('Network', 'MTN Nigeria', 'verified'),
  f('Number active since', '2019', 'verified'),
  f('Linked business', 'Chidi Electronics (BN 3318290)', 'verified'),
  f('WhatsApp Business', 'Yes — same business name'),
  f('Location signals', 'Computer Village, Ikeja')],

  signals: [
  v('Consistent identity information across 3 independent sources'),
  v('Established presence — number active for over 6 years'),
  r('1 resolved complaint about late delivery (2025)', true),
  w('Limited verification history for the linked business')],

  factors: factors([86, 74, null, 90, 78, 88, 80, 92, 84], {
    identity: 'Name matches across telecom, business register and WhatsApp.',
    reports: 'One complaint, resolved by the business.'
  }),
  unresolvedReports: 0,
  totalReports: 1,
  recommendation: 'Proceed with normal precautions. Pay through a method that offers buyer protection where possible.'
},
{
  id: 'e-biz-lekki-prime',
  type: 'business',
  name: 'Lekki Prime Homes Ltd',
  identifier: 'RC 1489023',
  subtitle: 'Real estate agency · Lekki, Lagos',
  score: 91,
  confidence: 'High',
  verification: 'verified',
  lastChecked: '2026-10-02T09:00:00',
  facts: [
  f('Registration', 'RC 1489023 · Active', 'verified'),
  f('Registered', 'March 2018', 'verified'),
  f('Directors', '2 directors on file', 'verified'),
  f('Website', 'lekkiprimehomes.com · 7 years old', 'verified'),
  f('PadiCheck verification', 'Verified Business since Jan 2026', 'verified'),
  f('Office', '14 Admiralty Way, Lekki Phase 1')],

  signals: [
  v('Registration active with the Corporate Affairs Commission'),
  v('Verified by PadiCheck — documents and office address confirmed'),
  v('Website, phone and email all match the registered business'),
  r('42 reviews, average 4.6 · 31 from verified transactions', true)],

  factors: factors([94, 96, 90, 88, 85, 92, 93, 90, 91]),
  unresolvedReports: 0,
  totalReports: 0,
  recommendation: 'Highly trusted. Still inspect the property in person and pay into the registered business account only.',
  businessSlug: 'lekki-prime-homes'
},
{
  id: 'e-web-cheap-iphones',
  type: 'website',
  name: 'cheap-iphones-ng.shop',
  identifier: 'cheap-iphones-ng.shop',
  subtitle: 'Online store · registered 11 days ago',
  score: 24,
  previousScore: 31,
  confidence: 'Medium',
  verification: 'unverified',
  lastChecked: '2026-10-03T18:05:00',
  facts: [
  f('Domain registered', '23 September 2026 (11 days ago)', 'verified'),
  f('HTTPS', 'Valid certificate (free, 90-day)', 'verified'),
  f('Registrant', 'Privacy-protected'),
  f('Contact details', 'WhatsApp only — no address', 'public'),
  f('Prices', 'iPhone 17 Pro at ₦480,000 — about 62% below market', 'ai')],

  signals: [
  v('Secure connection (HTTPS) is in place', true),
  r('6 users reported paying and receiving nothing', false),
  ai('Product photos match images from 4 other stores'),
  ai('Checkout asks for bank transfer only'),
  w('Domain is less than 2 weeks old'),
  w('Prices far below the market average')],

  factors: factors([20, 5, 18, null, 25, 10, 15, 8, 14], {
    website: 'New domain, hidden registrant, no business address.',
    reports: '6 reports in the last 7 days, 4 under review.'
  }),
  unresolvedReports: 4,
  totalReports: 6,
  recommendation: 'High risk. Do not pay by bank transfer. If you have already paid, contact your bank immediately and report this site.'
},
{
  id: 'e-person-emeka',
  type: 'person',
  name: 'Emeka Obi',
  identifier: 'emeka obi 08035550199',
  subtitle: 'Presents as a property caretaker · Yaba, Lagos',
  score: 63,
  confidence: 'Low',
  verification: 'unverified',
  lastChecked: '2026-10-01T11:30:00',
  facts: [
  f('Phone', '0803 555 0199 · active since 2021', 'verified'),
  f('Name on number', 'Partial match (“E. Obi”)'),
  f('Public profiles', '1 Facebook profile, created 2023')],

  signals: [
  v('Phone number is active and has a matching name', true),
  r('1 open report: asked for inspection fee before viewing'),
  w('Limited public information — confidence is low')],

  factors: factors([60, null, null, 70, 52, 55, null, 62, 66]),
  unresolvedReports: 1,
  totalReports: 1,
  recommendation: 'Proceed with caution. Never pay an inspection fee before you see the property and confirm who owns it.'
},
{
  id: 'e-prop-admiralty',
  type: 'property',
  name: '3-bedroom flat, Admiralty Way, Lekki',
  identifier: 'propertypro.ng/listing/88213',
  subtitle: 'Listed at ₦4.5m/year · agent “Tayo Homes”',
  score: 52,
  confidence: 'Medium',
  verification: 'partial',
  lastChecked: '2026-10-03T10:15:00',
  facts: [
  f('Listing source', 'PropertyPro.ng', 'verified'),
  f('Agent', 'Tayo Homes · not PadiCheck verified'),
  f('Location', 'Address matches map pin', 'verified'),
  f('Price', '₦4.5m vs area median ₦7.2m', 'ai'),
  f('Ownership', 'Not verified — no authorised land registry source', 'public')],

  signals: [
  v('Listing location is consistent with the address', true),
  ai('Same photos appear on 3 other listings with different agents'),
  ai('Price is about 38% below similar flats nearby'),
  w('Agent is not verified and has no registered business'),
  w('Ownership cannot be confirmed by PadiCheck')],

  factors: factors([48, 30, null, 60, 45, 70, null, 50, 35]),
  unresolvedReports: 0,
  totalReports: 0,
  recommendation: 'High caution. Inspect in person, ask for the owner’s documents, and never pay before signing a tenancy agreement.'
},
{
  id: 'e-job-globalhire',
  type: 'job',
  name: 'GlobalHire Recruitment — Data Entry (Remote)',
  identifier: 'hr.globalhire@gmail.com',
  subtitle: 'Recruiter email · ₦500k/week offer',
  score: 18,
  confidence: 'High',
  verification: 'unverified',
  lastChecked: '2026-10-03T07:40:00',
  facts: [
  f('Recruiter email', 'Free Gmail address, not a company domain', 'verified'),
  f('Company registration', 'No match found', 'verified'),
  f('Payment request', '₦15,000 “registration fee”', 'user')],

  signals: [
  r('11 people reported being asked for a registration fee'),
  ai('Salary is far above market for the role'),
  w('Legitimate employers do not charge you to get a job'),
  w('No registered company with this name')],

  factors: factors([15, 5, null, 20, 25, 5, null, 20, 10]),
  unresolvedReports: 3,
  totalReports: 11,
  recommendation: 'High risk. Do not pay any fee and do not share your BVN, NIN or bank details.'
},
{
  id: 'e-social-adafabrics',
  type: 'social',
  name: '@ada_fabrics_lagos',
  identifier: '@ada_fabrics_lagos',
  subtitle: 'Instagram business account · 18.4k followers',
  score: 78,
  confidence: 'Medium',
  verification: 'verified',
  lastChecked: '2026-09-30T16:00:00',
  facts: [
  f('Account created', 'May 2020', 'verified'),
  f('Linked business', 'Ada Fabrics & Co. · PadiCheck Basic Verification', 'verified'),
  f('Engagement', 'Consistent with follower count')],

  signals: [
  v('Linked to a PadiCheck-verified business'),
  v('Account has existed for over 6 years with steady activity'),
  r('3 reports about slow delivery, all resolved', true),
  w('Payment link points to a personal account name')],

  factors: factors([80, 76, null, 74, 84, 78, 82, 86, 75]),
  unresolvedReports: 0,
  totalReports: 3,
  recommendation: 'Generally trusted. Confirm the account name on any transfer matches the business.',
  businessSlug: 'ada-fabrics'
},
{
  id: 'e-listing-camry',
  type: 'listing',
  name: 'Toyota Camry 2018 — ₦9.8m',
  identifier: 'jiji.ng/cars/toyota-camry-2018-x91',
  subtitle: 'Jiji listing · seller joined 2 months ago',
  score: 61,
  confidence: 'Medium',
  verification: 'partial',
  lastChecked: '2026-10-02T20:10:00',
  facts: [
  f('Marketplace', 'Jiji.ng', 'verified'),
  f('Seller since', 'August 2026'),
  f('Price', 'Within normal range for the model', 'ai')],

  signals: [
  v('Seller phone verified by the marketplace', true),
  ai('Photos are unique to this listing', true),
  w('New seller account with no reviews')],

  factors: factors([62, null, null, 70, 50, 75, 40, 45, 72]),
  unresolvedReports: 0,
  totalReports: 0,
  recommendation: 'Proceed with caution. Inspect the car with a mechanic and verify papers before paying.'
}];