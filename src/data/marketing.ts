import { BrainCircuitIcon, FileCheck2Icon, GaugeIcon, ScaleIcon, SearchIcon, ShieldCheckIcon, UsersIcon, EyeIcon, type LucideIcon } from 'lucide-react';

export const howSteps: {title: string;body: string;icon: LucideIcon;}[] = [
{ title: 'Search', body: 'Enter a phone number, business, website, profile or listing — or paste a link.', icon: SearchIcon },
{ title: 'Analyse', body: 'We look at public records, community reports, reviews and patterns linked to scams.', icon: BrainCircuitIcon },
{ title: 'Verify', body: 'Anything confirmed by an official or authorised source is clearly marked as verified.', icon: FileCheck2Icon },
{ title: 'Score', body: 'Everything is combined into a PadiCheck Score from 0 to 100, with a confidence level.', icon: GaugeIcon },
{ title: 'Decide', body: 'You get a plain-language recommendation. You stay in control of the decision.', icon: ScaleIcon }];


export const popularChecks = [
{ type: 'phone', q: '+2348035550142', label: 'A seller’s WhatsApp number', result: 'Generally Trusted · 82' },
{ type: 'website', q: 'cheap-iphones-ng.shop', label: 'An online phone store', result: 'High Risk · 24' },
{ type: 'job', q: 'hr.globalhire@gmail.com', label: 'A remote job offer', result: 'High Risk · 18' },
{ type: 'business', q: 'Lekki Prime Homes', label: 'A property agency', result: 'Highly Trusted · 91' }] as
const;

export const whyPoints: {title: string;body: string;icon: LucideIcon;}[] = [
{ title: 'Facts are labelled', body: 'Verified information, user reports and AI signals are always shown separately. We never present a guess as a fact.', icon: EyeIcon },
{ title: 'People review reports', body: 'Reports only count in full after a moderator reviews them. Businesses can dispute anything inaccurate.', icon: UsersIcon },
{ title: 'Built for how we buy', body: 'WhatsApp sellers, Instagram vendors, rental agents and remote jobs — the places trust is hardest.', icon: ShieldCheckIcon }];


export const safetyTips = [
{ title: 'Never pay to get a job', body: 'Real employers don’t charge registration, training or uniform fees before you start.' },
{ title: 'Inspect before you pay', body: 'For rentals and cars, see it in person and confirm who owns it before any money moves.' },
{ title: 'Match the account name', body: 'The name on the bank account should match the business you’re dealing with.' },
{ title: 'Too cheap is a warning', body: 'Prices far below the market are the most common sign of an online scam.' }];


export const testimonials = [
{ quote: 'The “agent” wanted ₦50,000 before showing me the flat. PadiCheck showed the photos were on three other listings. I walked away.', name: 'Halima S.', role: 'Renter, Abuja' },
{ quote: 'Our verified badge and QR code on delivery vans mean customers stop asking if we’re legit.', name: 'Adaeze O.', role: 'Founder, BrightPath Logistics' },
{ quote: 'I check every new supplier’s number before sending a deposit. It takes thirty seconds.', name: 'Tunde A.', role: 'Electronics retailer, Ikeja' }];


export const helpCategories = ['Getting Started', 'Checking', 'Verification', 'Reports', 'Business', 'Payments', 'Privacy', 'Account', 'API'] as const;

export const helpArticles: {id: string;category: (typeof helpCategories)[number];q: string;a: string;}[] = [
{ id: 'h1', category: 'Getting Started', q: 'What is PadiCheck?', a: 'PadiCheck helps you check people, businesses, phone numbers, websites, listings and jobs before you buy, pay, hire, rent or engage. Each check gives you a PadiCheck Score from 0–100 and a plain-language recommendation.' },
{ id: 'h2', category: 'Getting Started', q: 'Do I need an account?', a: 'You can browse and read public business profiles without an account. Running a check needs a free account so we can protect the service from abuse.' },
{ id: 'h3', category: 'Checking', q: 'What does the PadiCheck Score mean?', a: '90–100 Highly Trusted, 75–89 Generally Trusted, 60–74 Proceed With Caution, 40–59 High Caution, 0–39 High Risk. The score is guidance based on the information available — not a guarantee.' },
{ id: 'h4', category: 'Checking', q: 'Why does a check say “low confidence”?', a: 'Confidence shows how much information we found. A new number or website with little history gets a provisional score with low confidence.' },
{ id: 'h5', category: 'Checking', q: 'What if nothing is found?', a: 'You get your credits back. No result isn’t proof something is safe — ask for more details and use the safety tips.' },
{ id: 'h6', category: 'Verification', q: 'What does “Verified” mean?', a: 'Verified means PadiCheck confirmed the information through an official or authorised source, such as a business registry or documents we reviewed. We never claim property ownership is verified without an authorised land registry source.' },
{ id: 'h7', category: 'Reports', q: 'How do I report a scam?', a: 'Open any report and tap “Report an issue”, or go to Account → My reports → New report. Add evidence if you can. You can track the status of every report you send.' },
{ id: 'h8', category: 'Reports', q: 'What happens after I report?', a: 'A moderator reviews your report, may ask for more information, and then resolves or rejects it. Only reviewed reports count fully towards a score.' },
{ id: 'h9', category: 'Business', q: 'How do I verify my business?', a: 'Open the Business portal, go to Verification, add your registration details and upload documents. Most reviews finish within 2 working days.' },
{ id: 'h10', category: 'Business', q: 'Can I dispute a report about my business?', a: 'Yes. In the Business portal, open Reports & disputes, choose the report and submit your evidence. A person reviews every dispute and you’ll be notified of the decision.' },
{ id: 'h11', category: 'Payments', q: 'Which payment methods do you accept?', a: 'Nigerian cards, bank transfer and USSD, plus international Visa and Mastercard. Subscriptions renew automatically until you cancel.' },
{ id: 'h12', category: 'Payments', q: 'How do I cancel?', a: 'Account → Subscription & billing → Cancel plan. You keep access until the end of the period you’ve paid for.' },
{ id: 'h13', category: 'Privacy', q: 'Do you sell my data?', a: 'No. We never sell personal data. Your checks are private to you unless you choose to share a report.' },
{ id: 'h14', category: 'Account', q: 'How do I turn on two-factor authentication?', a: 'Account → Security → Two-factor authentication. You can use an authenticator app or SMS.' },
{ id: 'h15', category: 'API', q: 'How do I get an API key?', a: 'Open the Developer portal, go to API keys and create a sandbox key. Live keys need a verified business and an API plan.' }];