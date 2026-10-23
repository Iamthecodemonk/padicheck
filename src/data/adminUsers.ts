import type { AdminUser } from '../types/admin';

export const adminUsers: AdminUser[] = [
{
  id: 'u-1001',
  name: 'Adaeze Okafor',
  email: 'adaeze.okafor@gmail.com',
  country: 'Nigeria',
  credits: 18,
  status: 'active',
  joined: '2026-03-14T10:00:00',
  lastActive: '2026-10-03T09:12:00',
  checks: 46,
  spentNaira: 15000,
  sessions: [
  { id: 's-1', device: 'Pixel 8 · Installed app', lastSeen: '2026-10-03T09:12:00', current: true },
  { id: 's-2', device: 'MacBook Air · Chrome', lastSeen: '2026-09-30T21:04:00' }],

  activity: [
  { title: 'iPhone 17 Pro 256GB', type: 'shopping', at: '2026-10-03T09:12:00', status: 'completed' },
  { title: 'DoubleUp Naira investment plan', type: 'link', at: '2026-10-02T18:40:00', status: 'completed' },
  { title: '2-bedroom flat, Lekki Phase 1', type: 'property', at: '2026-10-01T14:05:00', status: 'completed' }]

},
{
  id: 'u-1002',
  name: 'Kwame Mensah',
  email: 'kwame.mensah@outlook.com',
  country: 'Ghana',
  credits: 4,
  status: 'active',
  joined: '2026-06-02T08:30:00',
  lastActive: '2026-10-03T07:48:00',
  checks: 19,
  spentNaira: 7000,
  sessions: [{ id: 's-3', device: 'iPhone 15 · Home Screen app', lastSeen: '2026-10-03T07:48:00', current: true }],
  activity: [
  { title: '3-bedroom duplex, East Legon', type: 'property', at: '2026-10-03T07:48:00', status: 'failed' },
  { title: '3-bedroom duplex, East Legon', type: 'property', at: '2026-10-03T07:41:00', status: 'failed' }]

},
{
  id: 'u-1003',
  name: 'Chidi Eze',
  email: 'chidi.eze@yahoo.com',
  country: 'Nigeria',
  credits: 0,
  status: 'suspended',
  joined: '2026-08-19T12:15:00',
  lastActive: '2026-09-28T16:20:00',
  checks: 3,
  spentNaira: 0,
  sessions: [],
  activity: [{ title: 'Supplier agreement.pdf', type: 'contract', at: '2026-09-28T16:20:00', status: 'failed' }]
},
{
  id: 'u-1004',
  name: 'Fatima Bello',
  email: 'fatima.bello@gmail.com',
  country: 'Nigeria',
  credits: 52,
  status: 'active',
  joined: '2026-01-07T09:00:00',
  lastActive: '2026-10-02T22:10:00',
  checks: 88,
  spentNaira: 33000,
  sessions: [{ id: 's-4', device: 'Galaxy A54 · Installed app', lastSeen: '2026-10-02T22:10:00', current: true }],
  activity: [{ title: 'Samsung 65" QLED TV', type: 'shopping', at: '2026-10-02T22:10:00', status: 'failed' }]
},
{
  id: 'u-1005',
  name: 'Tolu Adeyemi',
  email: 'tolu@adeyemihomes.ng',
  country: 'Nigeria',
  credits: 120,
  status: 'active',
  joined: '2025-11-21T14:00:00',
  lastActive: '2026-10-03T08:55:00',
  checks: 212,
  spentNaira: 66000,
  sessions: [{ id: 's-5', device: 'iPad Air · Home Screen app', lastSeen: '2026-10-03T08:55:00', current: true }],
  activity: [{ title: '4-bedroom terrace, Ikoyi', type: 'property', at: '2026-10-03T08:55:00', status: 'completed' }]
},
{
  id: 'u-1006',
  name: 'Amina Yusuf',
  email: 'amina.yusuf@gmail.com',
  country: 'Kenya',
  credits: 9,
  status: 'active',
  joined: '2026-09-25T11:00:00',
  lastActive: '2026-10-02T19:30:00',
  checks: 2,
  spentNaira: 2000,
  sessions: [{ id: 's-6', device: 'iPhone 13 · Safari', lastSeen: '2026-10-02T19:30:00', current: true }],
  activity: [{ title: 'Remote data entry job', type: 'job', at: '2026-10-02T19:30:00', status: 'completed' }]
},
{
  id: 'u-1007',
  name: 'Emeka Nwosu',
  email: 'emeka.nwosu@gmail.com',
  country: 'Nigeria',
  credits: 31,
  status: 'active',
  joined: '2026-04-10T15:40:00',
  lastActive: '2026-10-03T06:15:00',
  checks: 37,
  spentNaira: 11000,
  sessions: [{ id: 's-7', device: 'Windows · Edge app', lastSeen: '2026-10-03T06:15:00', current: true }],
  activity: [{ title: 'cheapflights-naija.com', type: 'link', at: '2026-10-03T06:15:00', status: 'failed' }]
},
{
  id: 'u-1008',
  name: 'Grace Achieng',
  email: 'grace.achieng@gmail.com',
  country: 'Kenya',
  credits: 2,
  status: 'active',
  joined: '2026-07-30T10:20:00',
  lastActive: '2026-10-01T13:05:00',
  checks: 11,
  spentNaira: 4000,
  sessions: [{ id: 's-8', device: 'Tecno Spark 20 · Installed app', lastSeen: '2026-10-01T13:05:00', current: true }],
  activity: [{ title: 'Screenshot · Freelance writing gig', type: 'freelance', at: '2026-10-01T13:05:00', status: 'failed' }]
}];