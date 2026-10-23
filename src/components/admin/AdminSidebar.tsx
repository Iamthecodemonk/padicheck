import React from 'react';
import { NavLink } from 'react-router-dom';
import { DownloadIcon, LogOutIcon, PanelLeftCloseIcon, PanelLeftOpenIcon } from 'lucide-react';
import { useAdminSession } from '../../contexts/AdminSessionContext';
import { usePwa } from '../../contexts/PwaContext';
import { adminNavGroups, type AdminBadgeKey } from '../../data/adminModules';

interface AdminSidebarProps {
  expanded: boolean;
  onToggle: () => void;
  badges: Record<AdminBadgeKey, number>;
}

export function AdminSidebar({ expanded, onToggle, badges }: AdminSidebarProps) {
  const { session, signOut, roleName } = useAdminSession();
  const { identity, install, requestInstall } = usePwa();

  return (
    <aside
      className={`sticky top-0 hidden h-[100dvh] shrink-0 flex-col bg-navy text-white transition-[width] duration-200 ease-out md:flex ${expanded ? 'w-64' : 'w-[76px]'}`}>
      
      <div className={`flex h-16 items-center gap-3 ${expanded ? 'px-4' : 'justify-center'}`}>
        <img src={identity.icon} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
        {expanded &&
        <span className="min-w-0 flex-1 truncate font-semibold">
            PadiCheck <span className="font-normal text-navy-text">Admin</span>
          </span>
        }
      </div>
      <nav aria-label="Admin" className="no-scrollbar flex-1 overflow-y-auto px-3 pb-4">
        {adminNavGroups.map((group) =>
        <div key={group.label} className="mt-4">
            {expanded ?
          <p className="px-3 pb-1 text-xs font-medium text-navy-text/80">{group.label}</p> :

          <span className="mx-auto mb-2 block h-px w-6 bg-navy-line" aria-hidden="true" />
          }
            <ul className="space-y-0.5">
              {group.items.map((item) => {
              const badge = item.badgeKey ? badges[item.badgeKey] : 0;
              return (
                <li key={item.to}>
                    <NavLink
                    to={item.to}
                    end={item.end}
                    title={expanded ? undefined : item.label}
                    className={({ isActive }) =>
                    `relative flex h-11 items-center gap-3 rounded-xl text-[15px] font-medium transition-colors ${expanded ? 'px-3' : 'justify-center'} ${
                    isActive ? 'bg-navy-light text-white' : 'text-navy-text hover:bg-navy-light/60 hover:text-white'}`

                    }>
                    
                      <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                      {expanded && <span className="flex-1 truncate">{item.label}</span>}
                      {badge > 0 && (
                    expanded ?
                    <span className="rounded-full bg-brand-bright px-2 py-0.5 text-xs font-bold text-ink">{badge}</span> :

                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-bright" aria-label={`${badge} items`} />)
                    }
                    </NavLink>
                  </li>);

            })}
            </ul>
          </div>
        )}
      </nav>
      <div className="space-y-1 border-t border-navy-line p-3">
        {!install.installed &&
        <button
          type="button"
          onClick={requestInstall}
          title={expanded ? undefined : 'Install App'}
          className={`flex h-11 w-full items-center gap-3 rounded-xl text-[15px] font-medium text-navy-text hover:bg-navy-light hover:text-white ${expanded ? 'px-3' : 'justify-center'}`}>
          
            <DownloadIcon className="h-5 w-5" aria-hidden="true" />
            {expanded && 'Install App'}
          </button>
        }
        {expanded && session &&
        <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold">{session.name}</p>
            <p className="text-xs text-navy-text">{roleName}</p>
          </div>
        }
        <div className={`flex ${expanded ? 'gap-1' : 'flex-col gap-1'}`}>
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            title="Sign out"
            className={`flex h-11 items-center gap-3 rounded-xl text-[15px] font-medium text-navy-text hover:bg-navy-light hover:text-white ${expanded ? 'flex-1 px-3' : 'justify-center'}`}>
            
            <LogOutIcon className="h-5 w-5" aria-hidden="true" />
            {expanded && 'Sign out'}
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
            className="grid h-11 w-11 place-items-center self-center rounded-xl text-navy-text hover:bg-navy-light hover:text-white">
            
            {expanded ? <PanelLeftCloseIcon className="h-5 w-5" /> : <PanelLeftOpenIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </aside>);

}