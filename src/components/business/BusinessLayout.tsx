import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { BadgeCheckIcon } from 'lucide-react';
import { PageHeader } from '../consumer/PageHeader';
import { useTrust } from '../../contexts/TrustContext';
import { verificationStatusMeta } from '../../data/businessPortal';

const tabs = [
{ to: '/business', label: 'Dashboard', end: true },
{ to: '/business/profile', label: 'Business profile' },
{ to: '/business/verification', label: 'Verification' },
{ to: '/business/listing', label: 'Directory listing' },
{ to: '/business/reviews', label: 'Reviews' },
{ to: '/business/reports', label: 'Reports & disputes' },
{ to: '/business/certificate', label: 'Certificate & QR' },
{ to: '/business/team', label: 'Team' },
{ to: '/business/billing', label: 'Subscription & billing' }];


/** Business portal shell: same app chrome, with a scrollable section nav. */
export function BusinessLayout() {
  const { myBusiness } = useTrust();
  const status = verificationStatusMeta[myBusiness.verification];

  return (
    <>
      <PageHeader title="Business" back="/account" />
      <div className="mx-auto w-full max-w-6xl px-4 lg:px-10">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-lg font-bold text-brand-dark" aria-hidden="true">
            {myBusiness.name[0]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-bold text-ink">{myBusiness.name}</p>
            <p className={`inline-flex items-center gap-1 text-sm font-semibold ${status.text}`}>
              {myBusiness.verification === 'verified' && <BadgeCheckIcon className="h-4 w-4" aria-hidden="true" />}
              {status.label}
            </p>
          </div>
        </div>
        <nav aria-label="Business portal" className="no-scrollbar -mx-4 mt-4 overflow-x-auto border-b border-line px-4">
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
        <div className="pt-6">
          <Outlet />
        </div>
      </div>
    </>);

}