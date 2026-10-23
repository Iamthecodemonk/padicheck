import type { Invoice, PlanId } from '../types/trust';

export interface Plan {
  id: PlanId;
  audience: 'consumer' | 'business';
  name: string;
  tagline: string;
  monthly: number;
  yearly: number;
  highlight?: boolean;
  features: string[];
}

export const plans: Plan[] = [
{ id: 'free', audience: 'consumer', name: 'Free', tagline: 'For occasional checks', monthly: 0, yearly: 0, features: ['3 basic checks a month', 'Trust Score and band', 'Report suspicious activity', 'Save up to 5 checks'] },
{ id: 'plus', audience: 'consumer', name: 'Plus', tagline: 'For regular buyers and renters', monthly: 2500, yearly: 25000, highlight: true, features: ['30 checks a month', 'Full reports with evidence', 'Alerts when a saved score changes', 'Download PDF reports', 'Unlimited saved checks'] },
{ id: 'pro', audience: 'consumer', name: 'Pro', tagline: 'For agents and power users', monthly: 7500, yearly: 75000, features: ['150 checks a month', 'Everything in Plus', 'Priority deep research', 'Bulk checks (CSV)', 'Priority support'] },
{ id: 'biz-basic', audience: 'business', name: 'Basic Verification', tagline: 'Show customers you’re real', monthly: 5000, yearly: 50000, features: ['Registration & identity check', 'Basic verified badge', 'Public business profile', 'Respond to reviews'] },
{ id: 'biz-verified', audience: 'business', name: 'Verified Business', tagline: 'The full PadiCheck trust badge', monthly: 15000, yearly: 150000, highlight: true, features: ['Everything in Basic', 'Address & director verification', 'Digital certificate + QR code', 'Dispute inaccurate reports', 'Profile analytics'] },
{ id: 'biz-pro', audience: 'business', name: 'Business Pro', tagline: 'For teams and platforms', monthly: 45000, yearly: 450000, features: ['Everything in Verified', '5 team members', 'API access (5,000 calls/month)', 'Reputation alerts', 'Dedicated account manager'] }];


export const comparisonRows: {label: string;values: Record<'free' | 'plus' | 'pro', string | boolean>;}[] = [
{ label: 'Checks per month', values: { free: '3', plus: '30', pro: '150' } },
{ label: 'Trust Score', values: { free: true, plus: true, pro: true } },
{ label: 'Full evidence & AI analysis', values: { free: false, plus: true, pro: true } },
{ label: 'Score change alerts', values: { free: false, plus: true, pro: true } },
{ label: 'PDF reports', values: { free: false, plus: true, pro: true } },
{ label: 'Bulk checks', values: { free: false, plus: false, pro: true } },
{ label: 'Priority support', values: { free: false, plus: false, pro: true } }];


export const planById = (id: string) => plans.find((p) => p.id === id);

export const initialInvoices: Invoice[] = [
{ id: 'INV-2026-0912', label: 'Plus · monthly', amountNaira: 2500, status: 'paid', method: 'Visa •••• 4242', at: '2026-09-12T10:00:00' },
{ id: 'INV-2026-0812', label: 'Plus · monthly', amountNaira: 2500, status: 'paid', method: 'Visa •••• 4242', at: '2026-08-12T10:00:00' },
{ id: 'INV-2026-0712', label: 'Plus · monthly', amountNaira: 2500, status: 'failed', method: 'Visa •••• 4242', at: '2026-07-12T10:00:00' }];


export const paymentMethods = [
{ id: 'card', label: 'Card', hint: 'Visa, Mastercard, Verve' },
{ id: 'transfer', label: 'Bank transfer', hint: 'Pay from any Nigerian bank' },
{ id: 'ussd', label: 'USSD', hint: 'No internet banking needed' },
{ id: 'intl', label: 'International card', hint: 'Charged in USD' }] as
const;