import type { SupportTicket } from '../types/admin';

export const supportTickets: SupportTicket[] = [
{
  id: 'T-501',
  user: 'Adaeze Okafor',
  userId: 'u-1001',
  subject: 'Credits not added after payment',
  status: 'open',
  priority: 'high',
  at: '2026-10-03T08:40:00',
  messages: [
  { from: 'user', author: 'Adaeze Okafor', text: 'I paid ₦5,000 by bank transfer about 10 minutes ago but my balance is still 18. Reference PAY-88212.', at: '2026-10-03T08:40:00' }]

},
{
  id: 'T-502',
  user: 'Kwame Mensah',
  userId: 'u-1002',
  subject: 'Property check failed twice',
  status: 'open',
  priority: 'normal',
  at: '2026-10-03T07:55:00',
  messages: [
  { from: 'user', author: 'Kwame Mensah', text: 'I tried checking a listing on meqasa twice and both failed. Were my credits taken?', at: '2026-10-03T07:55:00' }]

},
{
  id: 'T-503',
  user: 'Amina Yusuf',
  userId: 'u-1006',
  subject: 'How do I install on iPhone?',
  status: 'waiting',
  priority: 'normal',
  at: '2026-10-02T19:40:00',
  messages: [
  { from: 'user', author: 'Amina Yusuf', text: 'I can’t find an install button on my iPhone.', at: '2026-10-02T19:40:00' },
  { from: 'agent', author: 'Ngozi (Support)', text: 'In Safari, tap Share, then Add to Home Screen. If you’re using Chrome on iPhone, open the page in Safari first.', at: '2026-10-02T20:02:00' }]

},
{
  id: 'T-504',
  user: 'Tolu Adeyemi',
  userId: 'u-1005',
  subject: 'Team account for my agency?',
  status: 'open',
  priority: 'normal',
  at: '2026-10-02T15:10:00',
  messages: [
  { from: 'user', author: 'Tolu Adeyemi', text: 'We have 4 agents. Can we share one credit balance?', at: '2026-10-02T15:10:00' }]

},
{
  id: 'T-499',
  user: 'Emeka Nwosu',
  userId: 'u-1007',
  subject: 'Wrong currency on report',
  status: 'resolved',
  priority: 'normal',
  at: '2026-10-01T09:30:00',
  messages: [
  { from: 'user', author: 'Emeka Nwosu', text: 'My report showed prices in dollars.', at: '2026-10-01T09:30:00' },
  { from: 'agent', author: 'Tunde (Support)', text: 'Fixed — your currency is now set to NGN in Account › Currency.', at: '2026-10-01T10:05:00' }]

}];