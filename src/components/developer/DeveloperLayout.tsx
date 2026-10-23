import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { PageHeader } from '../consumer/PageHeader';

const tabs = [
{ to: '/developers', label: 'Overview', end: true },
{ to: '/developers/keys', label: 'API keys' },
{ to: '/developers/sandbox', label: 'Sandbox' },
{ to: '/developers/requests', label: 'Requests' },
{ to: '/developers/webhooks', label: 'Webhooks' },
{ to: '/developers/docs', label: 'Documentation' }];


export function DeveloperLayout() {
  return (
    <>
      <PageHeader title="Developers" back="/account" />
      <div className="mx-auto w-full max-w-6xl px-4 lg:px-10">
        <nav aria-label="Developer portal" className="no-scrollbar -mx-4 overflow-x-auto border-b border-line px-4">
          <ul className="flex gap-1">
            {tabs.map((t) =>
            <li key={t.to} className="shrink-0">
                <NavLink
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                `relative inline-flex h-12 items-center whitespace-nowrap px-3 text-[15px] font-medium transition-colors ${isActive ? 'text-brand-dark after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand' : 'text-muted hover:text-ink'}`
                }>
                
                  {t.label}
                </NavLink>
              </li>
            )}
          </ul>
        </nav>
        <div className="pb-10 pt-6">
          <Outlet />
        </div>
      </div>
    </>);

}