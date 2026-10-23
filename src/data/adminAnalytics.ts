export type AnalyticsRange = '7d' | '30d' | '90d';

export const analyticsByRange: Record<
  AnalyticsRange,
  {checks: number;checksChange: string;newUsers: number;usersChange: string;revenue: number;revenueChange: string;daily: number[];labels: string[];}> =
{
  '7d': {
    checks: 31240,
    checksChange: '+12%',
    newUsers: 2140,
    usersChange: '+8%',
    revenue: 6_420_000,
    revenueChange: '+15%',
    daily: [3980, 4210, 4520, 4310, 4890, 4730, 4600],
    labels: ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  },
  '30d': {
    checks: 128900,
    checksChange: '+9%',
    newUsers: 8820,
    usersChange: '+11%',
    revenue: 25_800_000,
    revenueChange: '+6%',
    daily: [3600, 3800, 3700, 4100, 3900, 4200, 4000, 4300, 4100, 4500, 4200, 4400, 4600, 4300, 4700, 4500, 4800, 4400, 4600, 4900, 4700, 5000, 4800, 4600, 4900, 5100, 4800, 5000, 5200, 4900],
    labels: ['4 Sep', '', '', '', '', '', '', '11 Sep', '', '', '', '', '', '', '18 Sep', '', '', '', '', '', '', '25 Sep', '', '', '', '', '', '', '', '3 Oct']
  },
  '90d': {
    checks: 352400,
    checksChange: '+22%',
    newUsers: 24100,
    usersChange: '+19%',
    revenue: 70_100_000,
    revenueChange: '+18%',
    daily: [2800, 2900, 3000, 3100, 3050, 3200, 3300, 3400, 3500, 3600, 3700, 3800, 3900],
    labels: ['Jul', '', '', '', 'Aug', '', '', '', 'Sep', '', '', '', 'Oct']
  }
};

export const checksByCategory = [
{ label: 'Shopping', share: 39, tone: 'bg-violet' },
{ label: 'Links', share: 21, tone: 'bg-sky' },
{ label: 'Jobs & Talent', share: 15, tone: 'bg-brand' },
{ label: 'Property', share: 12, tone: 'bg-amber' },
{ label: 'Freelance', share: 8, tone: 'bg-rose' },
{ label: 'Contracts', share: 5, tone: 'bg-teal' }];


export const installFunnel = [
{ label: 'Saw install invitation', value: 4820 },
{ label: 'Tapped install', value: 1832 },
{ label: 'Installed', value: 1664 },
{ label: 'Opened installed app 3+ times', value: 1190 }];


export const platformSplit = [
{ label: 'Android', value: 62, tone: 'bg-brand' },
{ label: 'iPhone', value: 28, tone: 'bg-sky' },
{ label: 'Desktop', value: 10, tone: 'bg-violet' }];


export const topCountries = [
{ label: 'Nigeria', value: 65 },
{ label: 'Ghana', value: 19 },
{ label: 'Kenya', value: 16 }];


export const entryPoints = [
{ label: 'Pasted a link', value: 41 },
{ label: 'Shared from another app', value: 22 },
{ label: 'Camera or upload', value: 24 },
{ label: 'Describe', value: 6 },
{ label: 'Typed a description', value: 7 }];