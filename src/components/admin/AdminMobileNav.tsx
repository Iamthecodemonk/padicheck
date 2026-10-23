import React from 'react';
import { NavLink } from 'react-router-dom';
import { Building2Icon, FlagIcon, LayoutDashboardIcon, LayoutGridIcon, UsersIcon } from 'lucide-react';
import type { AdminBadgeKey } from '../../data/adminModules';

const tabs: {to: string;label: string;icon: typeof UsersIcon;end: boolean;badge?: AdminBadgeKey;}[] = [
{ to: '/admin', label: 'Dashboard', icon: LayoutDashboardIcon, end: true },
{ to: '/admin/businesses', label: 'Verify', icon: Building2Icon, end: false, badge: 'verification' },
{ to: '/admin/reports', label: 'Reports', icon: FlagIcon, end: false, badge: 'reports' },
{ to: '/admin/users', label: 'Users', icon: UsersIcon, end: false }];


export function AdminMobileNav({ onMore, badges }: {onMore: () => void;badges: Record<AdminBadgeKey, number>;}) {
  const item = 'relative flex h-[62px] w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors';
  const moreCount = badges.disputes + badges.reviews + badges.support + badges.directory;
  return (
    <nav aria-label="Admin" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-safe pl-safe pr-safe backdrop-blur-md md:hidden">
      <ul className="grid grid-cols-5">
        {tabs.map((tab) => {
          const count = tab.badge ? badges[tab.badge] : 0;
          return (
            <li key={tab.to}>
              <NavLink to={tab.to} end={tab.end} className={({ isActive }) => `${item} ${isActive ? 'text-ink' : 'text-muted'}`}>
                {({ isActive }) =>
                <>
                    <span className={`absolute top-0 h-0.5 w-8 rounded-full ${isActive ? 'bg-brand' : 'bg-transparent'}`} />
                    <span className="relative">
                      <tab.icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.4 : 1.9} aria-hidden="true" />
                      {count > 0 && <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">{count}</span>}
                    </span>
                    {tab.label}
                  </>
                }
              </NavLink>
            </li>);

        })}
        <li>
          <button type="button" onClick={onMore} className={`${item} text-muted`}>
            <span className="relative">
              <LayoutGridIcon className="h-[22px] w-[22px]" strokeWidth={1.9} aria-hidden="true" />
              {moreCount > 0 && <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-brand" aria-label={`${moreCount} items need attention`} />}
            </span>
            More
          </button>
        </li>
      </ul>
    </nav>);

}