import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DownloadIcon, LogOutIcon } from 'lucide-react';
import { BottomSheet } from '../BottomSheet';
import { useAdminSession } from '../../contexts/AdminSessionContext';
import { usePwa } from '../../contexts/PwaContext';
import { adminNavGroups } from '../../data/adminModules';
import { useAdminBadges } from '../../hooks/useAdminBadges';

export function AdminMoreSheet({ open, onClose }: {open: boolean;onClose: () => void;}) {
  const navigate = useNavigate();
  const { session, signOut, roleName } = useAdminSession();
  const { install, requestInstall } = usePwa();
  const badges = useAdminBadges();
  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="All workspaces" description={session ? `${session.name} · ${roleName}` : undefined}>
      {adminNavGroups.map((group) =>
      <section key={group.label} className="mb-5">
          <h3 className="mb-2 text-sm font-medium text-muted">{group.label}</h3>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {group.items.map((item) =>
          <li key={item.to}>
                <button
              type="button"
              onClick={() => go(item.to)}
              className="relative flex h-[84px] w-full flex-col items-center justify-center gap-2 rounded-2xl bg-canvas px-1 text-ink transition-colors hover:bg-line/60">
              
                  {item.badgeKey && badges[item.badgeKey] > 0 &&
              <span className="absolute right-2 top-2 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">{badges[item.badgeKey]}</span>
              }
                  <item.icon className="h-[22px] w-[22px]" aria-hidden="true" />
                  <span className="text-center text-[13px] font-medium leading-tight">{item.label}</span>
                </button>
              </li>
          )}
          </ul>
        </section>
      )}
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
        {!install.installed &&
        <li>
            <button
            type="button"
            onClick={() => {
              onClose();
              requestInstall();
            }}
            className="flex h-14 w-full items-center gap-3 px-4 font-medium text-ink hover:bg-canvas">
            
              <DownloadIcon className="h-5 w-5 text-muted" aria-hidden="true" /> Install PadiCheck Admin
            </button>
          </li>
        }
        <li>
          <button type="button" onClick={signOut} className="flex h-14 w-full items-center gap-3 px-4 font-medium text-danger hover:bg-canvas">
            <LogOutIcon className="h-5 w-5" aria-hidden="true" /> Sign out
          </button>
        </li>
      </ul>
    </BottomSheet>);

}