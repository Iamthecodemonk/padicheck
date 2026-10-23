import {
  BriefcaseIcon,
  CarIcon,
  CpuIcon,
  HomeIcon,
  LandmarkIcon,
  ScaleIcon,
  ShirtIcon,
  StoreIcon,
  TruckIcon,
  UtensilsIcon,
  type LucideIcon } from
'lucide-react';
import type { Business, Review } from '../types/trust';

/** Yearly fee for a PadiCheck Directory listing, in naira. */
export const DIRECTORY_FEE = 6000;

export interface DirectoryCategory {
  slug: string;
  /** Must match Business.category. */
  label: string;
  icon: LucideIcon;
  tile: string;
}

export const directoryCategories: DirectoryCategory[] = [
{ slug: 'real-estate', label: 'Real estate', icon: HomeIcon, tile: 'bg-brand-soft text-brand-dark' },
{ slug: 'logistics', label: 'Logistics & delivery', icon: TruckIcon, tile: 'bg-sky-soft text-sky' },
{ slug: 'fashion', label: 'Fashion & textiles', icon: ShirtIcon, tile: 'bg-rose-soft text-rose' },
{ slug: 'electronics', label: 'Electronics', icon: CpuIcon, tile: 'bg-violet-soft text-violet' },
{ slug: 'food', label: 'Food & catering', icon: UtensilsIcon, tile: 'bg-amber-soft text-amber' },
{ slug: 'lending', label: 'Lending', icon: LandmarkIcon, tile: 'bg-teal-soft text-teal' },
{ slug: 'recruitment', label: 'Recruitment', icon: BriefcaseIcon, tile: 'bg-sky-soft text-sky' },
{ slug: 'automotive', label: 'Automotive', icon: CarIcon, tile: 'bg-caution-soft text-caution' },
{ slug: 'professional', label: 'Professional services', icon: ScaleIcon, tile: 'bg-violet-soft text-violet' },
{ slug: 'other', label: 'Other', icon: StoreIcon, tile: 'bg-canvas text-muted' }];


export const categoryBySlug = (slug?: string) => directoryCategories.find((c) => c.slug === slug);
export const categoryForBusiness = (category: string) => directoryCategories.find((c) => c.label === category) ?? directoryCategories[directoryCategories.length - 1];

export const directoryBenefits = [
{ title: 'Be found', text: 'Appear in Explore Businesses under your category and in PadiCheck search.' },
{ title: 'Collect reviews', text: 'Customers can leave reviews on your public page. You can reply to every one.' },
{ title: 'Look trustworthy', text: 'A shareable profile with your contacts, hours and Trust Score — upgrade to Verified any time.' }];


const active = (approvedAt: string): Business['directory'] => ({
  status: 'active',
  feeNaira: DIRECTORY_FEE,
  submittedAt: approvedAt,
  paidAt: approvedAt,
  approvedAt,
  reference: `PCK-DIR-${approvedAt.slice(0, 10).replace(/-/g, '')}`,
  expiresAt: new Date(new Date(approvedAt).getTime() + 365 * 86_400_000).toISOString(),
  hours: 'Mon–Sat · 9am–6pm'
});

export { active as activeListing };

/** Extra listed businesses so every main category has something to explore. */
export const directorySeedBusinesses: Business[] = [
{
  id: 'biz-mama-put',
  slug: 'mama-titi-kitchen',
  name: 'Mama Titi’s Kitchen',
  category: 'Food & catering',
  description: 'Home-style Nigerian meals, small chops and event catering for up to 300 guests.',
  location: 'Surulere, Lagos',
  website: 'mamatitikitchen.ng',
  phone: '+234 802 555 0161',
  email: 'orders@mamatitikitchen.ng',
  socials: ['instagram.com/mamatitikitchen'],
  regNumber: 'BN 3118870',
  owner: 'Titilayo Bello',
  verification: 'none',
  tier: 'Basic Verification',
  score: 74,
  views30d: 940,
  checks30d: 58,
  documents: [],
  directory: active('2026-03-10T10:00:00')
},
{
  id: 'biz-autocare',
  slug: 'autocare-garage-ikeja',
  name: 'AutoCare Garage Ikeja',
  category: 'Automotive',
  description: 'Diagnostics, servicing and genuine parts for Toyota, Honda and Lexus.',
  location: 'Allen Avenue, Ikeja, Lagos',
  website: 'autocareikeja.com',
  phone: '+234 806 555 0148',
  email: 'service@autocareikeja.com',
  socials: [],
  regNumber: 'RC 1650934',
  owner: 'Emeka Obi',
  verification: 'verified',
  tier: 'Basic Verification',
  verifiedAt: '2026-05-20T10:00:00',
  lastVerifiedAt: '2026-05-20T10:00:00',
  certificateId: 'PC-BV-2026-015530',
  score: 83,
  views30d: 1120,
  checks30d: 96,
  documents: [{ name: 'CAC certificate.pdf', kind: 'Registration', status: 'accepted' }],
  directory: active('2026-05-21T10:00:00')
},
{
  id: 'biz-okafor-legal',
  slug: 'okafor-and-partners',
  name: 'Okafor & Partners',
  category: 'Professional services',
  description: 'Property, tenancy and small-business legal advice. Fixed-fee document reviews.',
  location: 'Garki, Abuja',
  website: 'okaforpartners.law',
  phone: '+234 809 555 0119',
  email: 'chambers@okaforpartners.law',
  socials: ['linkedin.com/company/okafor-partners'],
  regNumber: 'RC 1201457',
  owner: 'Chidi Okafor',
  verification: 'none',
  tier: 'Basic Verification',
  score: 77,
  views30d: 610,
  checks30d: 40,
  documents: [],
  directory: active('2026-07-02T10:00:00')
},
{
  id: 'biz-talentbridge',
  slug: 'talentbridge-recruitment',
  name: 'TalentBridge Recruitment',
  category: 'Recruitment',
  description: 'Hiring for tech, finance and customer support roles. We never charge candidates.',
  location: 'Victoria Island, Lagos',
  website: 'talentbridge.ng',
  phone: '+234 817 555 0102',
  email: 'jobs@talentbridge.ng',
  socials: ['linkedin.com/company/talentbridge-ng'],
  regNumber: 'RC 1789011',
  owner: 'Bisi Coker',
  verification: 'verified',
  tier: 'Verified Business',
  verifiedAt: '2026-02-11T10:00:00',
  lastVerifiedAt: '2026-08-11T10:00:00',
  certificateId: 'PC-VB-2026-006021',
  score: 88,
  views30d: 2050,
  checks30d: 230,
  documents: [{ name: 'CAC certificate.pdf', kind: 'Registration', status: 'accepted' }],
  directory: active('2026-02-12T10:00:00')
},
{
  id: 'biz-gadgethub',
  slug: 'gadget-hub-computer-village',
  name: 'Gadget Hub Computer Village',
  category: 'Electronics',
  description: 'UK-used and new phones and laptops with a 3-month shop warranty.',
  location: 'Computer Village, Ikeja, Lagos',
  website: 'gadgethub.com.ng',
  phone: '+234 703 555 0186',
  email: 'sales@gadgethub.com.ng',
  socials: ['instagram.com/gadgethubcv'],
  regNumber: 'BN 3420078',
  owner: 'Musa Danjuma',
  verification: 'none',
  tier: 'Basic Verification',
  score: 69,
  views30d: 1480,
  checks30d: 175,
  documents: [],
  directory: active('2026-08-15T10:00:00')
},
{
  id: 'biz-freshbake',
  slug: 'freshbake-ibadan',
  name: 'FreshBake Ibadan',
  category: 'Food & catering',
  description: 'Celebration cakes, bread and pastries baked daily. Delivery across Ibadan.',
  location: 'Bodija, Ibadan',
  website: 'freshbake.ng',
  phone: '+234 805 555 0174',
  email: 'hello@freshbake.ng',
  socials: ['instagram.com/freshbakeibadan'],
  regNumber: 'BN 3561102',
  owner: 'Kemi Adeyemi',
  verification: 'none',
  tier: 'Basic Verification',
  score: 70,
  views30d: 120,
  checks30d: 9,
  documents: [],
  directory: { status: 'pending', feeNaira: DIRECTORY_FEE, submittedAt: '2026-10-03T16:40:00', paidAt: '2026-10-03T16:40:00', reference: 'PCK-DIR-MG7H2K', hours: 'Daily · 7am–7pm' }
}];


export const directorySeedReviews: Review[] = [
{ id: 'rv-d1', businessId: 'biz-mama-put', author: 'Uche N.', rating: 5, text: 'Catered our office end-of-year for 80 people. Food was hot, on time and the jollof was the talk of the day.', at: '2026-09-22T12:00:00', verifiedTransaction: true, status: 'published' },
{ id: 'rv-d2', businessId: 'biz-mama-put', author: 'Halima S.', rating: 4, text: 'Tasty small chops. Delivery came 40 minutes late but they apologised and added extra.', at: '2026-08-30T12:00:00', verifiedTransaction: false, status: 'published', response: 'Thank you Halima — we’ve added a second rider for weekends.' },
{ id: 'rv-d3', businessId: 'biz-autocare', author: 'Femi A.', rating: 5, text: 'Honest diagnosis — they told me I didn’t need a new gearbox when two other garages said I did.', at: '2026-09-15T12:00:00', verifiedTransaction: true, status: 'published' },
{ id: 'rv-d4', businessId: 'biz-talentbridge', author: 'Grace O.', rating: 5, text: 'Got placed in 3 weeks and never paid a kobo. Recruiter kept me updated throughout.', at: '2026-09-02T12:00:00', verifiedTransaction: true, status: 'published' },
{ id: 'rv-d5', businessId: 'biz-gadgethub', author: 'Tunde B.', rating: 3, text: 'Phone works well but the charger they gave was not original.', at: '2026-09-27T12:00:00', verifiedTransaction: false, status: 'published' },
{ id: 'rv-d6', businessId: 'biz-okafor-legal', author: 'Amaka E.', rating: 5, text: 'Reviewed my tenancy agreement in a day and spotted two unfair clauses. Clear fixed fee.', at: '2026-09-10T12:00:00', verifiedTransaction: true, status: 'published' }];