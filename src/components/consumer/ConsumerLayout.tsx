import React, { Suspense, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { BottomNav } from './BottomNav';
import { CheckSheet } from './CheckSheet';
import { DesktopSidebar } from './DesktopSidebar';
import { PageSkeleton } from '../Skeleton';
import { InstallGuideSheet } from '../pwa/InstallGuideSheet';
import { InstallPrompt } from '../pwa/InstallPrompt';
import { SplashScreen } from '../pwa/SplashScreen';
import { UpdateBanner } from '../pwa/UpdateBanner';
import { usePwa } from '../../contexts/PwaContext';
import { useUser } from '../../contexts/UserContext';
import type { ConsumerOutletContext } from '../../hooks/useOpenCheck';

export function ConsumerLayout() {
  const { session, dataSaver } = useUser();
  const { identity } = usePwa();
  const location = useLocation();
  const [checkOpen, setCheckOpen] = useState(false);
  const outletContext: ConsumerOutletContext = { openCheck: () => setCheckOpen(true) };
  const isAuth = /^\/(signin|signup|forgot-password|reset-password|verify-code|recover)$/.test(location.pathname);
  const isPublic = /^\/(welcome|about|how-it-works|pricing|for-business|contact|help|legal\/|b\/|certificate|directory|developers\/docs)/.test(location.pathname);
  const immersive = /^\/(check|result|share-target|talent|report\/|verify\/)/.test(location.pathname);

  if (isPublic) {
    return (
      <MotionConfig reducedMotion={dataSaver ? 'always' : 'user'}>
        <Outlet context={outletContext} />
        <CheckSheet open={checkOpen} onClose={() => setCheckOpen(false)} />
        <InstallPrompt />
        <InstallGuideSheet />
      </MotionConfig>);

  }

  if (!session && !isAuth) {
    if (location.pathname === '/') return <Navigate to="/welcome" replace />;
    return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />;
  }

  return (
    <MotionConfig reducedMotion={dataSaver ? 'always' : 'user'}>
      <SplashScreen icon={identity.icon} name={identity.name} />
      {isAuth ?
      <Suspense fallback={<PageSkeleton />}>
          <Outlet context={outletContext} />
        </Suspense> :

      <div className="flex min-h-[100dvh] w-full bg-canvas">
          <div className="no-print contents">
            <DesktopSidebar onNewCheck={() => setCheckOpen(true)} />
          </div>
          <div className="min-w-0 flex-1">
            <main className={immersive ? 'pb-[calc(env(safe-area-inset-bottom)+112px)] lg:pb-12' : 'pb-[calc(env(safe-area-inset-bottom)+96px)] lg:pb-12'}>
              <Suspense fallback={<PageSkeleton />}>
                <Outlet context={outletContext} />
              </Suspense>
            </main>
          </div>
          {!immersive && <BottomNav onCheck={() => setCheckOpen(true)} />}
          <CheckSheet open={checkOpen} onClose={() => setCheckOpen(false)} />
          <UpdateBanner bottomOffsetClass={immersive ? 'bottom-[calc(env(safe-area-inset-bottom)+100px)] lg:bottom-6' : undefined} />
          <InstallPrompt />
          <InstallGuideSheet />
        </div>
      }
    </MotionConfig>);

}