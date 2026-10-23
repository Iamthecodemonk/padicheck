import React, { Suspense, useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { WifiOffIcon } from 'lucide-react';
import { AdminMobileNav } from './AdminMobileNav';
import { AdminMoreSheet } from './AdminMoreSheet';
import { AdminSidebar } from './AdminSidebar';
import { PageSkeleton } from '../Skeleton';
import { InstallGuideSheet } from '../pwa/InstallGuideSheet';
import { SplashScreen } from '../pwa/SplashScreen';
import { UpdateBanner } from '../pwa/UpdateBanner';
import { useAdminSession } from '../../contexts/AdminSessionContext';
import { usePwa } from '../../contexts/PwaContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useAdminBadges } from '../../hooks/useAdminBadges';

export function AdminLayout() {
  const { session } = useAdminSession();
  const badges = useAdminBadges();
  const { identity, online } = usePwa();
  const location = useLocation();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [expandedPref, setExpandedPref] = useState<boolean | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const expanded = expandedPref ?? isDesktop;
  const isLogin = location.pathname === '/admin/login';

  if (!session && !isLogin) return <Navigate to="/admin/login" replace />;
  if (session && isLogin) return <Navigate to="/admin" replace />;

  return (
    <>
      <SplashScreen icon={identity.icon} name={identity.name} dark />
      {isLogin ?
      <Suspense fallback={<div className="min-h-[100dvh] bg-navy" />}>
          <Outlet />
        </Suspense> :

      <div className="flex min-h-[100dvh] w-full bg-canvas">
          <AdminSidebar expanded={expanded} onToggle={() => setExpandedPref(!expanded)} badges={badges} />
          <div className="min-w-0 flex-1">
            <header className="sticky top-0 z-30 bg-navy pt-safe text-white md:hidden">
              <div className="flex h-14 items-center gap-3 px-4">
                <Link to="/admin" className="flex items-center gap-2.5" aria-label="Admin dashboard">
                  <img src={identity.icon} alt="" className="h-8 w-8 rounded-lg object-cover" />
                  <span className="font-semibold">
                    PadiCheck <span className="font-normal text-navy-text">Admin</span>
                  </span>
                </Link>
                {!online &&
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-navy-light px-3 py-1 text-xs font-medium text-navy-text">
                    <WifiOffIcon className="h-3.5 w-3.5" aria-hidden="true" /> Offline
                  </span>
              }
              </div>
            </header>
            {!online &&
          <p role="status" className="hidden items-center gap-2 bg-caution-soft px-8 py-2 text-sm text-caution md:flex">
                <WifiOffIcon className="h-4 w-4" aria-hidden="true" /> You’re offline. Showing the last data loaded — actions will be disabled until you reconnect.
              </p>
          }
            <main className="mx-auto w-full max-w-[1400px] pb-[calc(env(safe-area-inset-bottom)+88px)] md:pb-12">
              <Suspense fallback={<PageSkeleton />}>
                <Outlet />
              </Suspense>
            </main>
          </div>
          <AdminMobileNav onMore={() => setMoreOpen(true)} badges={badges} />
          <AdminMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
          <UpdateBanner bottomOffsetClass="bottom-[calc(env(safe-area-inset-bottom)+76px)] md:bottom-6" />
          <InstallGuideSheet />
        </div>
      }
    </>);

}