import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { appIdentities } from '../data/appIdentity';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePwaInstall, type InstallApi } from '../hooks/usePwaInstall';
import { useServiceWorker, type ServiceWorkerApi } from '../hooks/useServiceWorker';
import { applyAppIdentity, detectBrowser, detectPlatform } from '../utils/pwa';
import { trackInstallEvent } from '../utils/installTracking';
import type { AppId, AppIdentity, Platform, PlatformPreference } from '../types/pwa';

interface PwaContextValue {
  app: AppId;
  identity: AppIdentity;
  platform: Platform;
  browser: string;
  online: boolean;
  install: InstallApi;
  sw: ServiceWorkerApi;
  installGuideOpen: boolean;
  requestInstall: () => void;
  closeInstallGuide: () => void;
}

const PwaContext = createContext<PwaContextValue | null>(null);

interface PwaProviderProps {
  app: AppId;
  platformPreview?: PlatformPreference;
  simulateOffline?: boolean;
  children: ReactNode;
}

export function PwaProvider({ app, platformPreview = 'auto', simulateOffline = false, children }: PwaProviderProps) {
  const platform = useMemo(() => detectPlatform(platformPreview), [platformPreview]);
  const browser = useMemo(() => platformPreview === 'ios' ? 'Safari' : detectBrowser(), [platformPreview]);
  const online = useOnlineStatus(simulateOffline);
  const install = usePwaInstall(app, platform, browser);
  const sw = useServiceWorker(app);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);

  useEffect(() => applyAppIdentity(app), [app]);

  const requestInstall = useCallback(() => {
    if (install.method === 'prompt') {
      void install.prompt();
      return;
    }
    trackInstallEvent(app, 'guide_opened', platform, browser);
    setInstallGuideOpen(true);
  }, [install, app, platform, browser]);

  const value = useMemo<PwaContextValue>(
    () => ({
      app,
      identity: appIdentities[app],
      platform,
      browser,
      online,
      install,
      sw,
      installGuideOpen,
      requestInstall,
      closeInstallGuide: () => setInstallGuideOpen(false)
    }),
    [app, platform, browser, online, install, sw, installGuideOpen, requestInstall]
  );

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

export function usePwa(): PwaContextValue {
  const ctx = useContext(PwaContext);
  if (!ctx) throw new Error('usePwa must be used inside PwaProvider');
  return ctx;
}