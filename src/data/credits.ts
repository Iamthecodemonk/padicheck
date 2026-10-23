import type { CreditPackage, CreditTransaction } from '../types/check';

export const creditPackages: CreditPackage[] = [
{ id: 'starter', name: 'Starter', credits: 20, priceNaira: 2000, active: true },
{ id: 'standard', name: 'Standard', credits: 60, priceNaira: 5000, note: 'Best value for most people', active: true, featured: true },
{ id: 'pro', name: 'Pro', credits: 150, priceNaira: 11000, note: 'For agents and frequent buyers', active: true }];


export const initialTransactions: CreditTransaction[] = [
{ id: 'tx-6', label: 'Shopping opportunity', amount: -2, at: '2026-10-03T09:12:00' },
{ id: 'tx-5', label: 'Check a link', amount: -1, at: '2026-10-02T18:40:00' },
{ id: 'tx-4', label: 'Property check', amount: -3, at: '2026-10-01T14:05:00' },
{ id: 'tx-3', label: 'Standard pack', amount: 60, at: '2026-09-30T08:00:00' },
{ id: 'tx-2', label: 'Job check', amount: -2, at: '2026-09-29T11:20:00' },
{ id: 'tx-1', label: 'Welcome credits', amount: 5, at: '2026-09-20T12:00:00' }];