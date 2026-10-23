import { useCallback, useEffect, useState } from 'react';
import { usePersistentState } from './usePersistentState';
import { isStandalone } from '../utils/pwa';
import { trackInstallEvent } from '../utils/installTracking';
import type { AppId, BeforeInstallPromptEvent, InstallMethod, Platform } from '../types/pwa';

interface InstallRecord {
  installed: boolean;
  snoozedUntil: number;
  visits: number;
  engaged: boolean;
}

export interface InstallApi {
  installed: boolean;
  standalone: boolean;
  method: InstallMethod;
  shouldOffer: boolean;
  /** Not installed and not snoozed — used by the one-time install pop-up. */
  eligible: boolean;
  prompt: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  dismiss: (days?: number) => void;
  markEngaged: () => void;
  markInstalled: () => void;
}

const DAY = 86_400_000;

export function usePwaInstall(app: AppId, platform: Platform, browser: string): InstallApi {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [record, setRecord] = usePersistentState<InstallRecord>(`pc-${app}-install`, {
    installed: false,
    snoozedUntil: 0,
    visits: 0,
    engaged: false
  });
  const standalone = isStandalone();

  useEffect(() => {
    setRecord((r) => ({ ...r, visits: r.visits + 1, installed: r.installed || standalone }));
    // Count one visit per launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      trackInstallEvent(app, 'prompt_available', platform, browser);
    };
    const onInstalled = () => {
      setDeferred(null);
      setRecord((r) => ({ ...r, installed: true }));
      trackInstallEvent(app, 'installed', platform, browser);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [app, platform, browser, setRecord]);

  const prompt = useCallback(async () => {
    if (!deferred) return 'unavailable' as const;
    trackInstallEvent(app, 'prompt_shown', platform, browser);
    await deferred.prompt();
    const choice = await deferred.userChoice;
    trackInstallEvent(app, choice.outcome === 'accepted' ? 'prompt_accepted' : 'prompt_dismissed', platform, browser);
    setDeferred(null);
    if (choice.outcome === 'accepted') setRecord((r) => ({ ...r, installed: true }));else
    setRecord((r) => ({ ...r, snoozedUntil: Date.now() + 14 * DAY }));
    return choice.outcome;
  }, [deferred, app, platform, browser, setRecord]);

  const dismiss = useCallback(
    (days = 14) => {
      setRecord((r) => ({ ...r, snoozedUntil: Date.now() + days * DAY }));
      trackInstallEvent(app, 'cta_dismissed', platform, browser);
    },
    [app, platform, browser, setRecord]
  );

  const markEngaged = useCallback(() => setRecord((r) => r.engaged ? r : { ...r, engaged: true }), [setRecord]);
  const markInstalled = useCallback(() => setRecord((r) => ({ ...r, installed: true })), [setRecord]);

  const installed = standalone || record.installed;
  const method: InstallMethod = deferred ? 'prompt' : platform === 'ios' ? 'ios-guide' : 'browser-guide';
  const snoozed = Date.now() < record.snoozedUntil;

  return {
    installed,
    standalone,
    method,
    shouldOffer: !installed && !snoozed && (record.visits >= 3 || record.engaged),
    eligible: !installed && !snoozed,
    prompt,
    dismiss,
    markEngaged,
    markInstalled
  };
}