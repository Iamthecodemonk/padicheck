import type { AppId, AppIdentity } from '../types/pwa';

export const appIdentities: Record<AppId, AppIdentity> = {
  consumer: {
    id: '/',
    name: 'PadiCheck',
    shortName: 'PadiCheck',
    description: 'Check any opportunity before you commit — links, products, property, jobs and contracts.',
    startUrl: '/?source=pwa',
    scope: '/',
    themeColor: '#F4F6F5',
    backgroundColor: '#F4F6F5',
    statusBarStyle: 'default',
    icon: "/afa20a5f-1430-4b01-9871-43a64780f2e7.jpg",
    serviceWorkerPath: '/sw.js',
    version: '2.4.0',
    shortcuts: [
    { name: 'Check a Link', shortName: 'Link', description: 'Paste or share a link to check', url: '/check/link' },
    { name: 'Check Shopping Opportunity', shortName: 'Shopping', description: 'Check a product and seller', url: '/check/shopping' },
    { name: 'Check Property', shortName: 'Property', description: 'Check a rental or sale listing', url: '/check/property' },
    { name: 'Check Job', shortName: 'Job', description: 'Check a job offer', url: '/check/job' },
    { name: 'Upload Document', shortName: 'Upload', description: 'Review a contract or document', url: '/check/contract?mode=upload' },
    { name: 'Explore Businesses', shortName: 'Directory', description: 'Find listed and verified businesses', url: '/directory' }]

  },
  admin: {
    id: '/admin/',
    name: 'PadiCheck Admin',
    shortName: 'PC Admin',
    description: 'Operate PadiCheck — users, credits, payments, AI providers and support.',
    startUrl: '/admin?source=pwa',
    scope: '/admin/',
    themeColor: '#0B1A33',
    backgroundColor: '#0B1A33',
    statusBarStyle: 'black-translucent',
    icon: "/8fcd79f9-7529-4c8d-870f-45702ccc67ff.jpg",
    serviceWorkerPath: '/admin/sw.js',
    version: '1.9.0',
    shortcuts: [
    { name: 'Search users', shortName: 'Users', description: 'Find and inspect a user', url: '/admin/users' },
    { name: 'Support inbox', shortName: 'Support', description: 'Reply to open tickets', url: '/admin/support' },
    { name: 'System health', shortName: 'Health', description: 'Check services and providers', url: '/admin/health' }]

  }
};