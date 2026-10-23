import { useCallback, useEffect, useRef, useState } from 'react';
import { appIdentities } from '../data/appIdentity';
import type { AppId } from '../types/pwa';

export type WorkerStatus = 'registering' | 'active' | 'unavailable' | 'unsupported';

export interface ServiceWorkerApi {
  status: WorkerStatus;
  updateAvailable: boolean;
  applyUpdate: () => void;
  checkForUpdate: () => Promise<'available' | 'latest' | 'unavailable'>;
}

const HOUR = 3_600_000;

export function useServiceWorker(app: AppId): ServiceWorkerApi {
  const identity = appIdentities[app];
  const [status, setStatus] = useState<WorkerStatus>('registering');
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const reloadRequested = useRef(false);

  useEffect(() => {
    let container: ServiceWorkerContainer | undefined;
    try {
      container = 'serviceWorker' in navigator ? navigator.serviceWorker : undefined;
    } catch {
      // Sandboxed frames can throw when the service worker container is accessed.
      container = undefined;
    }
    if (!container) {
      setStatus('unsupported');
      return;
    }
    let cancelled = false;

    const watch = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) setWaiting(worker);
        });
      });
    };

    navigator.serviceWorker.
    register(identity.serviceWorkerPath, { scope: identity.scope }).
    then((reg) => {
      if (cancelled) return;
      registrationRef.current = reg;
      setStatus('active');
      watch(reg);
    }).
    catch(() => {
      if (!cancelled) setStatus('unavailable');
    });

    const onControllerChange = () => {
      if (reloadRequested.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    const interval = window.setInterval(() => registrationRef.current?.update().catch(() => undefined), HOUR);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, [identity.serviceWorkerPath, identity.scope]);

  // Drafts, queued checks and the session live in local storage, so a reload keeps them.
  const applyUpdate = useCallback(() => {
    if (!waiting) return;
    reloadRequested.current = true;
    waiting.postMessage({ type: 'SKIP_WAITING' });
  }, [waiting]);

  const checkForUpdate = useCallback(async () => {
    const reg = registrationRef.current;
    if (!reg) return 'unavailable' as const;
    try {
      await reg.update();
      return reg.waiting ? 'available' as const : 'latest' as const;
    } catch {
      return 'unavailable' as const;
    }
  }, []);

  return { status, updateAvailable: waiting !== null, applyUpdate, checkForUpdate };
}