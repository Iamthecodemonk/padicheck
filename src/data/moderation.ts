import { MY_BUSINESS_ID } from './businesses';
import type { AiFlag, Dispute, UserReport } from '../types/trust';

export const initialReports: UserReport[] = [
{
  id: 'RP-20418',
  entityId: 'e-web-cheap-iphones',
  entityName: 'cheap-iphones-ng.shop',
  entityType: 'website',
  category: 'Suspicious website',
  description: 'I paid ₦480,000 by transfer for an iPhone 17 Pro. They blocked me on WhatsApp the next day.',
  evidence: ['transfer-receipt.jpg', 'whatsapp-chat.png'],
  reporter: 'Adaeze Okafor',
  contact: 'adaeze.okafor@gmail.com',
  status: 'review',
  risk: 'high',
  aiSuggested: 'Likely fraud — matches 5 similar reports',
  at: '2026-10-02T19:10:00',
  updates: [
  { at: '2026-10-02T19:10:00', text: 'Report received.', by: 'PadiCheck' },
  { at: '2026-10-03T08:30:00', text: 'A moderator is reviewing your evidence.', by: 'Ngozi O.' }]

},
{
  id: 'RP-20402',
  entityId: 'e-job-globalhire',
  entityName: 'GlobalHire Recruitment',
  entityType: 'job',
  category: 'Suspicious job',
  description: 'Asked me to pay ₦15,000 for “registration” before an interview.',
  evidence: ['email-screenshot.png'],
  reporter: 'Adaeze Okafor',
  status: 'resolved',
  risk: 'high',
  at: '2026-09-25T10:00:00',
  updates: [
  { at: '2026-09-25T10:00:00', text: 'Report received.', by: 'PadiCheck' },
  { at: '2026-09-26T12:00:00', text: 'Upheld. A warning now appears on this employer’s report.', by: 'Ngozi O.' }]

},
{
  id: 'RP-20431',
  entityId: 'e-person-emeka',
  entityName: 'Emeka Obi',
  entityType: 'person',
  category: 'Suspicious seller',
  description: 'Wanted ₦20,000 inspection fee before showing the flat.',
  evidence: [],
  reporter: 'Bola T.',
  status: 'pending',
  risk: 'medium',
  aiSuggested: 'Common rental scam pattern',
  at: '2026-10-03T16:45:00',
  updates: [{ at: '2026-10-03T16:45:00', text: 'Report received.', by: 'PadiCheck' }]
},
{
  id: 'RP-20388',
  entityId: 'e-biz-brightpath',
  entityName: 'BrightPath Logistics',
  entityType: 'business',
  category: 'Misleading information',
  description: 'Parcel marked delivered but I never received it.',
  evidence: ['tracking.png'],
  reporter: 'Chinedu M.',
  status: 'review',
  risk: 'low',
  at: '2026-09-27T14:00:00',
  updates: [{ at: '2026-09-27T14:00:00', text: 'Report received.', by: 'PadiCheck' }]
},
{
  id: 'RP-20440',
  entityId: 'e-prop-admiralty',
  entityName: '3-bedroom flat, Admiralty Way',
  entityType: 'property',
  category: 'Suspicious listing',
  description: 'Same photos used by a different agent on Instagram.',
  evidence: ['instagram-post.png', 'listing.png'],
  reporter: 'Halima S.',
  status: 'pending',
  risk: 'medium',
  aiSuggested: 'Duplicate images confirmed on 3 listings',
  at: '2026-10-04T07:20:00',
  updates: [{ at: '2026-10-04T07:20:00', text: 'Report received.', by: 'PadiCheck' }]
}];


export const initialDisputes: Dispute[] = [
{
  id: 'DS-1042',
  reportId: 'RP-20388',
  businessId: MY_BUSINESS_ID,
  businessName: 'BrightPath Logistics',
  request: 'correction',
  statement: 'The parcel was delivered and signed for at the reception of the address given. We have the signed proof of delivery.',
  evidence: ['proof-of-delivery.pdf', 'rider-gps-log.png'],
  status: 'review',
  at: '2026-09-29T10:00:00',
  messages: [
  { from: 'business', author: 'Adaeze Okafor', text: 'Uploaded signed POD and GPS log.', at: '2026-09-29T10:00:00' },
  { from: 'admin', author: 'PadiCheck Trust team', text: 'Thanks — we’ve asked the reporter to confirm who signed.', at: '2026-09-30T09:00:00' }]

},
{
  id: 'DS-1038',
  reportId: 'RP-20402',
  businessId: 'biz-globalhire',
  businessName: 'GlobalHire Recruitment',
  request: 'removal',
  statement: 'The fee is for training materials, not registration.',
  evidence: [],
  status: 'upheld',
  at: '2026-09-27T10:00:00',
  decision: 'Report upheld. Charging candidates before employment is a recognised scam pattern.',
  messages: [{ from: 'business', author: 'GlobalHire', text: 'Please remove this report.', at: '2026-09-27T10:00:00' }]
}];


export const initialAiFlags: AiFlag[] = [
{ id: 'af-1', entityName: 'cheap-iphones-ng.shop', entityType: 'website', signal: 'Prices 62% below market', confidence: 0.94, model: 'risk-v3.2', at: '2026-10-03T18:05:00', status: 'confirmed', reviewer: 'Ngozi O.' },
{ id: 'af-2', entityName: '3-bedroom flat, Admiralty Way', entityType: 'property', signal: 'Duplicate listing photos', confidence: 0.88, model: 'vision-dup-v1.4', at: '2026-10-03T10:15:00', status: 'pending' },
{ id: 'af-3', entityName: 'Ada Fabrics & Co.', entityType: 'business', signal: 'Payment account name differs from business', confidence: 0.61, model: 'risk-v3.2', at: '2026-09-30T16:00:00', status: 'overridden', reviewer: 'Kofi A.' },
{ id: 'af-4', entityName: 'GlobalHire Recruitment', entityType: 'job', signal: 'Upfront fee requested', confidence: 0.97, model: 'text-scam-v2.0', at: '2026-10-03T07:40:00', status: 'confirmed', reviewer: 'Ngozi O.' },
{ id: 'af-5', entityName: 'Toyota Camry 2018', entityType: 'listing', signal: 'New seller, high-value item', confidence: 0.52, model: 'risk-v3.2', at: '2026-10-02T20:10:00', status: 'pending' },
{ id: 'af-6', entityName: '+234 701 555 0190', entityType: 'phone', signal: 'Number linked to loan harassment reports', confidence: 0.73, model: 'risk-v3.2', at: '2026-10-04T06:10:00', status: 'pending' }];