import type { AiProvider, Analyzer, FailedAnalysis, Payment, ServiceHealth } from '../types/admin';

export const payments: Payment[] = [
{ id: 'PAY-88213', user: 'Tolu Adeyemi', userId: 'u-1005', amountNaira: 11000, credits: 150, method: 'Card', status: 'succeeded', at: '2026-10-03T08:50:00' },
{ id: 'PAY-88212', user: 'Adaeze Okafor', userId: 'u-1001', amountNaira: 5000, credits: 60, method: 'Bank transfer', status: 'pending', at: '2026-10-03T08:31:00' },
{ id: 'PAY-88210', user: 'Grace Achieng', userId: 'u-1008', amountNaira: 2000, credits: 20, method: 'Card', status: 'failed', at: '2026-10-03T07:12:00' },
{ id: 'PAY-88207', user: 'Fatima Bello', userId: 'u-1004', amountNaira: 5000, credits: 60, method: 'USSD', status: 'succeeded', at: '2026-10-02T21:40:00' },
{ id: 'PAY-88201', user: 'Emeka Nwosu', userId: 'u-1007', amountNaira: 5000, credits: 60, method: 'Card', status: 'pending', at: '2026-10-02T18:02:00' },
{ id: 'PAY-88195', user: 'Amina Yusuf', userId: 'u-1006', amountNaira: 2000, credits: 20, method: 'Card', status: 'succeeded', at: '2026-10-02T10:15:00' }];


export const failedAnalyses: FailedAnalysis[] = [
{ id: 'FA-3021', user: 'Kwame Mensah', userId: 'u-1002', type: 'property', input: 'meqasa.com/listing/east-legon-3br', reason: 'Listing page blocked automated access', provider: 'Web fetcher', creditsHeld: 3, at: '2026-10-03T07:48:00' },
{ id: 'FA-3019', user: 'Fatima Bello', userId: 'u-1004', type: 'shopping', input: 'Screenshot · 2.1 MB', reason: 'Vision provider timed out after 30s', provider: 'Google Vision OCR', creditsHeld: 2, at: '2026-10-02T22:10:00' },
{ id: 'FA-3018', user: 'Emeka Nwosu', userId: 'u-1007', type: 'link', input: 'cheapflights-naija.com', reason: 'Domain lookup service unavailable', provider: 'WHOIS lookup', creditsHeld: 1, at: '2026-10-03T06:15:00' },
{ id: 'FA-3012', user: 'Grace Achieng', userId: 'u-1008', type: 'freelance', input: 'Screenshot · 1 image', reason: 'Image too blurry to read', provider: 'Vision OCR', creditsHeld: 3, at: '2026-10-01T13:05:00' },
{ id: 'FA-3009', user: 'Chidi Eze', userId: 'u-1003', type: 'contract', input: 'Supplier agreement.pdf · 6 pages', reason: 'PDF is password-protected', provider: 'Document reader', creditsHeld: 4, at: '2026-09-28T16:20:00' }];


export const analyzers: Analyzer[] = [
{ id: 'link', name: 'Link analyzer', successRate: 98.7, runs24h: 1840, enabled: true },
{ id: 'shopping', name: 'Shopping analyzer', successRate: 96.2, runs24h: 1215, enabled: true },
{ id: 'property', name: 'Property analyzer', successRate: 94.8, runs24h: 642, enabled: true },
{ id: 'job', name: 'Job analyzer', successRate: 99.1, runs24h: 488, enabled: true },
{ id: 'freelance', name: 'Freelance analyzer', successRate: 97.4, runs24h: 203, enabled: true },
{ id: 'contract', name: 'Contract reviewer', successRate: 95.5, runs24h: 156, enabled: true }];


export const aiProviders: AiProvider[] = [
{ id: 'gpt', name: 'OpenAI GPT-5', role: 'Primary reasoning', status: 'operational', latencyMs: 1820, errorRate: 0.4, requests24h: 14820, fallback: 'Anthropic Claude', routing: true },
{ id: 'claude', name: 'Anthropic Claude', role: 'Fallback reasoning', status: 'operational', latencyMs: 2140, errorRate: 0.2, requests24h: 2310, fallback: 'OpenAI GPT-5', routing: true },
{ id: 'vision', name: 'Google Vision OCR', role: 'Images & screenshots', status: 'degraded', latencyMs: 4930, errorRate: 6.1, requests24h: 3402, fallback: 'Azure Document Intelligence', routing: true },
{ id: 'azure-di', name: 'Azure Document Intelligence', role: 'Documents & PDFs', status: 'operational', latencyMs: 2680, errorRate: 0.9, requests24h: 1118, fallback: 'Google Vision OCR', routing: true },
{ id: 'vision-ocr', name: 'Vision OCR', role: 'Screenshots & photos', status: 'operational', latencyMs: 1310, errorRate: 1.2, requests24h: 905, fallback: 'None', routing: true }];


export const services: ServiceHealth[] = [
{ id: 'api', name: 'API gateway', status: 'operational', uptime: '99.99%', detail: 'p95 210 ms' },
{ id: 'workers', name: 'Analysis workers', status: 'operational', uptime: '99.95%', detail: '12 of 12 healthy · queue 18' },
{ id: 'ocr', name: 'Image & OCR pipeline', status: 'degraded', uptime: '98.70%', detail: 'Vision provider slow — failover ready' },
{ id: 'payments', name: 'Payments', status: 'operational', uptime: '100%', detail: 'Webhooks delivering normally' },
{ id: 'push', name: 'Push notifications', status: 'operational', uptime: '99.90%', detail: 'Delivered 8,412 today' },
{ id: 'storage', name: 'Private file storage', status: 'operational', uptime: '100%', detail: 'Signed URLs · 15 min expiry' }];