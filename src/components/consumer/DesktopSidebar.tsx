import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { BellIcon, BookmarkIcon, Building2Icon, CircleUserIcon, CodeIcon, CoinsIcon, DownloadIcon, FlagIcon, HistoryIcon, HouseIcon, SearchCheckIcon, SearchIcon, StoreIcon, WifiOffIcon } from 'lucide-react';
import { Logo } from '../Logo';
import { ThemeToggle } from '../ThemeToggle';
import { usePwa } from '../../contexts/PwaContext';
import { useTrust } from '../../contexts/TrustContext';
import { useUser } from '../../contexts/UserContext';
import { entityTypes } from '../../data/entityTypes';

type LinkKey = 'history' | 'alerts' | null;

const groups: {label?: string;items: {to: string;label: string;icon: typeof HouseIcon;end?: boolean;badge?: LinkKey;}[];}[] = [
{
  items: [
  { to: '/', label: 'Home', icon: HouseIcon, end: true },
  { to: '/verify', label: 'Check Now', icon: SearchCheckIcon, end: true },
  { to: '/search', label: 'Search', icon: SearchIcon },
  { to: '/directory', label: 'Explore businesses', icon: StoreIcon },
  { to: '/notifications', label: 'Alerts', icon: BellIcon, badge: 'alerts' }]

},
{
  label: 'Your activity',
  items: [
  { to: '/history', label: 'History', icon: HistoryIcon, badge: 'history' },
  { to: '/saved', label: 'Saved', icon: BookmarkIcon },
  { to: '/my-reports', label: 'My reports', icon: FlagIcon },
  { to: '/credits', label: 'Credits', icon: CoinsIcon }]

},
{
  label: 'Workspaces',
  items: [
  { to: '/business', label: 'Business', icon: Building2Icon },
  { to: '/developers', label: 'Developers', icon: CodeIcon },
  { to: '/account', label: 'Account', icon: CircleUserIcon }]

}];


export function DesktopSidebar({ onNewCheck }: {onNewCheck: () => void;}) {
  const { online, install, requestInstall } = usePwa();
  const { credits, queue } = useUser();
  const { unreadCount } = useTrust();
  const pending = queue.filter((t) => t.status !== 'done').length;
  const badge = (k?: LinkKey) => k === 'history' ? pending : k === 'alerts' ? unreadCount : 0;

  return (
    <aside className="sticky top-0 hidden h-[100dvh] w-64 shrink-0 flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
      <Link to="/" className="px-2" aria-label="PadiCheck home">
        <Logo height={30} />
      </Link>
      <button
        type="button"
        onClick={onNewCheck}
        className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand font-semibold text-white transition-colors hover:bg-brand-dark dark:hover:bg-brand-bright dark:hover:text-navy">
        
        <SearchCheckIcon className="h-5 w-5" aria-hidden="true" /> Check Now
      </button>
      <ul className="mt-3 grid grid-cols-4 gap-1" aria-label="Quick checks">
        {entityTypes.map((t) =>
        <li key={t.id}>
            <Link to={`/verify/${t.id}`} title={t.checkLabel} aria-label={t.checkLabel} className={`grid h-10 w-full place-items-center rounded-xl transition-opacity hover:opacity-80 ${t.tile}`}>
              <t.icon className="h-[18px] w-[18px]" aria-hidden="true" />
            </Link>
          </li>
        )}
      </ul>
      <nav aria-label="Primary" className="no-scrollbar -mx-1 mt-4 flex-1 overflow-y-auto px-1">
        {groups.map((g, gi) =>
        <div key={gi} className={gi ? 'mt-4' : ''}>
            {g.label && <p className="px-3 pb-1 text-xs font-medium text-muted">{g.label}</p>}
            <ul className="space-y-0.5">
              {g.items.map((link) => {
              const n = badge(link.badge);
              return (
                <li key={link.to}>
                    <NavLink
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) => `flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors ${isActive ? 'bg-brand-soft text-brand-dark' : 'text-muted hover:bg-canvas/70 hover:text-ink'}`}>
                    
                      <link.icon className="h-5 w-5" aria-hidden="true" />
                      <span className="flex-1">{link.label}</span>
                      {n > 0 && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${link.badge === 'alerts' ? 'bg-danger-soft text-danger' : 'bg-caution-soft text-caution'}`}>{n}</span>}
                    </NavLink>
                  </li>);

            })}
            </ul>
          </div>
        )}
      </nav>
      <div className="mt-4 space-y-3">
        {!online &&
        <p className="flex items-center gap-2 rounded-xl bg-caution-soft px-3 py-2 text-sm text-caution">
            <WifiOffIcon className="h-4 w-4" aria-hidden="true" /> Offline
          </p>
        }
        <Link to="/credits" className="flex items-baseline gap-1.5 rounded-2xl bg-amber-soft px-4 py-3 transition-opacity hover:opacity-90">
          <span className="text-xl font-bold text-ink">{credits}</span>
          <span className="text-sm text-ink-soft">credits</span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle showLabel />
          {!install.installed &&
          <button type="button" onClick={requestInstall} aria-label="Install App" title="Install App" className="ml-auto grid h-11 w-11 place-items-center rounded-xl text-ink transition-colors hover:bg-canvas">
              <DownloadIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          }
        </div>
      </div>
    </aside>);

}