import React from 'react';
import { NavLink } from 'react-router-dom';
import { BellIcon, CircleUserIcon, HistoryIcon, HouseIcon, SearchCheckIcon } from 'lucide-react';
import { useTrust } from '../../contexts/TrustContext';
import { useUser } from '../../contexts/UserContext';

const left = [
{ to: '/', label: 'Home', icon: HouseIcon, end: true },
{ to: '/history', label: 'History', icon: HistoryIcon, end: false }];

const right = [
{ to: '/notifications', label: 'Alerts', icon: BellIcon, end: false },
{ to: '/account', label: 'Account', icon: CircleUserIcon, end: false }];


/** Mobile tab bar. The centre "Check Now" button opens the full check picker. */
export function BottomNav({ onCheck }: {onCheck: () => void;}) {
  const { queue } = useUser();
  const { unreadCount } = useTrust();
  const pending = queue.filter((t) => t.status !== 'done').length;
  const badgeFor = (to: string) => to === '/history' ? pending : to === '/notifications' ? unreadCount : 0;

  const renderTab = (tab: (typeof left)[number]) => {
    const badge = badgeFor(tab.to);
    return (
      <li key={tab.to}>
        <NavLink
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `relative flex h-[62px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${isActive ? 'text-brand-dark' : 'text-muted'}`}>
          
          {({ isActive }) =>
          <>
              <span className={`absolute top-0 h-0.5 w-8 rounded-full ${isActive ? 'bg-brand' : 'bg-transparent'}`} />
              <span className="relative">
                <tab.icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.4 : 1.9} aria-hidden="true" />
                {badge > 0 &&
              <span className={`absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white ${tab.to === '/history' ? 'bg-caution' : 'bg-danger'}`}>
                    {badge > 9 ? '9+' : badge}
                  </span>
              }
              </span>
              {tab.label}
            </>
          }
        </NavLink>
      </li>);

  };

  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-safe pl-safe pr-safe backdrop-blur-md lg:hidden">
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {left.map(renderTab)}
        <li className="flex justify-center">
          <button
            type="button"
            onClick={onCheck}
            aria-label="Check Now — choose what to check"
            className="-mt-5 flex h-[74px] w-[74px] flex-col items-center justify-center gap-0.5 rounded-full bg-brand text-white shadow-float ring-4 ring-canvas transition-transform duration-150 ease-out active:scale-[0.96]">
            
            <SearchCheckIcon className="h-6 w-6" aria-hidden="true" />
            <span className="text-[11px] font-semibold">Check</span>
          </button>
        </li>
        {right.map(renderTab)}
      </ul>
    </nav>);

}