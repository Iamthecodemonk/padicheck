import { activeListing } from './directory';
import type { Business, Review } from '../types/trust';

/** The business owned by the signed-in demo user. Its portal starts unverified so the full flow can be walked. */
export const MY_BUSINESS_ID = 'biz-brightpath';

export const initialBusinesses: Business[] = [
{
  id: 'biz-lekki-prime',
  slug: 'lekki-prime-homes',
  name: 'Lekki Prime Homes Ltd',
  category: 'Real estate',
  description: 'Residential lettings and sales across Lekki, Ikoyi and Victoria Island since 2018.',
  location: '14 Admiralty Way, Lekki Phase 1, Lagos',
  website: 'lekkiprimehomes.com',
  phone: '+234 803 555 0101',
  email: 'hello@lekkiprimehomes.com',
  socials: ['instagram.com/lekkiprimehomes', 'linkedin.com/company/lekki-prime'],
  regNumber: 'RC 1489023',
  owner: 'Funke Adebayo',
  verification: 'verified',
  tier: 'Verified Business',
  verifiedAt: '2026-01-14T10:00:00',
  lastVerifiedAt: '2026-09-14T10:00:00',
  certificateId: 'PC-VB-2026-004812',
  score: 91,
  views30d: 4820,
  checks30d: 612,
  documents: [
  { name: 'CAC certificate.pdf', kind: 'Registration', status: 'accepted' },
  { name: 'Director ID.jpg', kind: 'Identity', status: 'accepted' },
  { name: 'Utility bill — office.pdf', kind: 'Address', status: 'accepted' }],

  entityId: 'e-biz-lekki-prime',
  directory: activeListing('2026-01-15T10:00:00')
},
{
  id: 'biz-ada-fabrics',
  slug: 'ada-fabrics',
  name: 'Ada Fabrics & Co.',
  category: 'Fashion & textiles',
  description: 'Ankara, lace and aso-oke fabrics delivered nationwide.',
  location: 'Balogun Market, Lagos Island',
  website: 'adafabrics.ng',
  phone: '+234 812 555 0177',
  email: 'orders@adafabrics.ng',
  socials: ['instagram.com/ada_fabrics_lagos'],
  regNumber: 'BN 2984411',
  owner: 'Ada Nnaji',
  verification: 'verified',
  tier: 'Basic Verification',
  verifiedAt: '2026-04-02T10:00:00',
  lastVerifiedAt: '2026-04-02T10:00:00',
  certificateId: 'PC-BV-2026-011207',
  score: 78,
  views30d: 1310,
  checks30d: 204,
  documents: [{ name: 'BN certificate.pdf', kind: 'Registration', status: 'accepted' }],
  entityId: 'e-social-adafabrics',
  directory: activeListing('2026-04-03T10:00:00')
},
{
  id: 'biz-swiftfix',
  slug: 'swiftfix-repairs',
  name: 'SwiftFix Phone Repairs',
  category: 'Electronics repair',
  description: 'Screen and battery replacement in 1 hour.',
  location: 'Wuse 2, Abuja',
  website: 'swiftfix.com.ng',
  phone: '+234 909 555 0133',
  email: 'help@swiftfix.com.ng',
  socials: [],
  regNumber: 'BN 3301876',
  owner: 'Yakubu Garba',
  verification: 'review',
  tier: 'Basic Verification',
  submittedAt: '2026-10-02T15:20:00',
  score: 70,
  views30d: 220,
  checks30d: 31,
  documents: [
  { name: 'BN certificate.pdf', kind: 'Registration', status: 'pending' },
  { name: 'Owner NIN slip.jpg', kind: 'Identity', status: 'pending' }]

},
{
  id: 'biz-quickloans',
  slug: 'quickcash-loans',
  name: 'QuickCash Loans NG',
  category: 'Lending',
  description: 'Instant loans with no collateral.',
  location: 'Ikeja, Lagos',
  website: 'quickcashloans.ng',
  phone: '+234 701 555 0190',
  email: 'support@quickcashloans.ng',
  socials: [],
  regNumber: 'RC 1923004',
  owner: 'Unknown',
  verification: 'info',
  tier: 'Verified Business',
  submittedAt: '2026-09-29T09:00:00',
  infoRequest: 'Please upload your CBN or state lending licence.',
  score: 46,
  views30d: 540,
  checks30d: 188,
  documents: [{ name: 'CAC certificate.pdf', kind: 'Registration', status: 'accepted' }]
},
{
  id: MY_BUSINESS_ID,
  slug: 'brightpath-logistics',
  name: 'BrightPath Logistics',
  category: 'Logistics & delivery',
  description: 'Same-day delivery for online sellers in Lagos and Ibadan.',
  location: 'Yaba, Lagos',
  website: 'brightpath.ng',
  phone: '+234 815 555 0123',
  email: 'hello@brightpath.ng',
  socials: ['instagram.com/brightpathng'],
  regNumber: 'RC 1734520',
  owner: 'Adaeze Okafor',
  verification: 'none',
  tier: 'Verified Business',
  score: 68,
  views30d: 386,
  checks30d: 47,
  documents: []
}];


export const initialReviews: Review[] = [
{
  id: 'rv-1',
  businessId: 'biz-lekki-prime',
  author: 'Tolu A.',
  rating: 5,
  text: 'Showed me 3 flats in one afternoon and the documents were all in order. Paid into their company account.',
  at: '2026-09-28T12:00:00',
  verifiedTransaction: true,
  response: 'Thank you Tolu — enjoy the new place!',
  status: 'published'
},
{
  id: 'rv-2',
  businessId: 'biz-lekki-prime',
  author: 'Ibrahim K.',
  rating: 4,
  text: 'Professional, but the agency fee was only explained at the end.',
  at: '2026-09-11T09:00:00',
  verifiedTransaction: true,
  status: 'published'
},
{
  id: 'rv-3',
  businessId: 'biz-ada-fabrics',
  author: 'Ngozi E.',
  rating: 4,
  text: 'Lovely lace, delivery took 6 days instead of 3.',
  at: '2026-09-20T09:00:00',
  verifiedTransaction: false,
  status: 'published'
},
{
  id: 'rv-4',
  businessId: MY_BUSINESS_ID,
  author: 'Kemi’s Bakery',
  rating: 5,
  text: 'They deliver our cakes across Lagos every day and nothing has been damaged yet.',
  at: '2026-09-30T10:00:00',
  verifiedTransaction: true,
  status: 'published'
},
{
  id: 'rv-5',
  businessId: MY_BUSINESS_ID,
  author: 'Anonymous',
  rating: 1,
  text: 'Scammers!!! Call 0809 555 0000 for a better courier.',
  at: '2026-10-02T21:00:00',
  verifiedTransaction: false,
  status: 'flagged',
  flagReason: 'Contains a competitor’s phone number'
},
{
  id: 'rv-6',
  businessId: MY_BUSINESS_ID,
  author: 'Segun O.',
  rating: 3,
  text: 'Delivery was fine but the rider called 10 times.',
  at: '2026-09-18T10:00:00',
  verifiedTransaction: true,
  status: 'published'
}];