import type { ApiKey, ApiRequestLog, Webhook } from '../types/trust';

export interface ApiEndpoint {
  id: string;
  method: 'GET' | 'POST';
  path: string;
  title: string;
  description: string;
  body: string;
  response: string;
}

export const apiEndpoints: ApiEndpoint[] = [
{
  id: 'business',
  method: 'POST',
  path: '/v1/verify/business',
  title: 'Verify a business',
  description: 'Look up registration, PadiCheck verification status and Trust Score for a business.',
  body: `{\n  "name": "Lekki Prime Homes",\n  "registration_number": "RC 1489023",\n  "country": "NG"\n}`,
  response: `{\n  "id": "ent_biz_7Hk2",\n  "name": "Lekki Prime Homes Ltd",\n  "verification": "verified",\n  "registration": { "number": "RC 1489023", "status": "active" },\n  "trust_score": { "value": 91, "band": "highly_trusted", "confidence": "high" },\n  "certificate_id": "PC-VB-2026-004812",\n  "checked_at": "2026-10-04T09:00:00Z"\n}`
},
{
  id: 'phone',
  method: 'POST',
  path: '/v1/verify/phone',
  title: 'Verify a phone number',
  description: 'Network, age, linked identity consistency and report history for a number.',
  body: `{\n  "phone": "+2348035550142"\n}`,
  response: `{\n  "phone": "+2348035550142",\n  "network": "MTN",\n  "active_since": "2019",\n  "identity_consistency": "high",\n  "reports": { "total": 1, "unresolved": 0 },\n  "trust_score": { "value": 82, "band": "generally_trusted", "confidence": "high" }\n}`
},
{
  id: 'url',
  method: 'POST',
  path: '/v1/verify/url',
  title: 'Verify a website',
  description: 'Domain age, HTTPS, contact consistency and risk signals for a URL.',
  body: `{\n  "url": "https://cheap-iphones-ng.shop"\n}`,
  response: `{\n  "domain": "cheap-iphones-ng.shop",\n  "domain_age_days": 11,\n  "https": true,\n  "signals": [\n    { "type": "user_reports", "count": 6 },\n    { "type": "ai_risk", "code": "price_anomaly", "confidence": 0.94 }\n  ],\n  "trust_score": { "value": 24, "band": "high_risk", "confidence": "medium" }\n}`
},
{
  id: 'listing',
  method: 'POST',
  path: '/v1/verify/listing',
  title: 'Verify a listing',
  description: 'Duplicate images, price anomalies and seller signals for a marketplace or property listing.',
  body: `{\n  "url": "https://propertypro.ng/listing/88213"\n}`,
  response: `{\n  "duplicates_found": 3,\n  "price_vs_median": -0.38,\n  "agent_verified": false,\n  "trust_score": { "value": 52, "band": "high_caution", "confidence": "medium" }\n}`
},
{
  id: 'risk',
  method: 'GET',
  path: '/v1/risk-score/{entity_id}',
  title: 'Get a risk score',
  description: 'Fetch the latest Trust Score and band for any previously checked entity.',
  body: '',
  response: `{\n  "entity_id": "ent_biz_7Hk2",\n  "trust_score": 91,\n  "band": "highly_trusted",\n  "updated_at": "2026-10-02T09:00:00Z"\n}`
}];


export const webhookEvents = ['check.completed', 'score.changed', 'report.created', 'verification.updated', 'dispute.updated'];

export const initialApiKeys: ApiKey[] = [
{ id: 'key-1', name: 'Production server', prefix: 'pc_live_9fK2', env: 'live', createdAt: '2026-07-01T10:00:00', lastUsed: '2026-10-04T08:59:00' },
{ id: 'key-2', name: 'Local testing', prefix: 'pc_test_Q81m', env: 'sandbox', createdAt: '2026-06-12T10:00:00', lastUsed: '2026-10-01T15:00:00' }];


export const initialRequestLogs: ApiRequestLog[] = [
{ id: 'rq-1', method: 'POST', path: '/v1/verify/business', status: 200, ms: 412, at: '2026-10-04T08:59:00' },
{ id: 'rq-2', method: 'POST', path: '/v1/verify/phone', status: 200, ms: 238, at: '2026-10-04T08:57:00' },
{ id: 'rq-3', method: 'POST', path: '/v1/verify/url', status: 422, ms: 41, at: '2026-10-04T08:51:00' },
{ id: 'rq-4', method: 'GET', path: '/v1/risk-score/ent_biz_7Hk2', status: 200, ms: 88, at: '2026-10-04T08:40:00' },
{ id: 'rq-5', method: 'POST', path: '/v1/verify/listing', status: 429, ms: 12, at: '2026-10-04T08:31:00' },
{ id: 'rq-6', method: 'POST', path: '/v1/verify/business', status: 200, ms: 501, at: '2026-10-04T08:12:00' }];


export const initialWebhooks: Webhook[] = [
{ id: 'wh-1', url: 'https://api.brightpath.ng/hooks/padicheck', events: ['check.completed', 'score.changed'], active: true, lastDelivery: { at: '2026-10-04T08:59:00', status: 200 } }];


export const usageByDay = [820, 940, 1120, 980, 1310, 760, 690, 1240, 1380, 1290, 1460, 1520, 880, 810];

export const apiPlan = { name: 'Growth', monthlyLimit: 25000, ratePerMinute: 120, priceNaira: 150000 };