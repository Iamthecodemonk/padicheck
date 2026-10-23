export type AppId = 'consumer' | 'admin';
export type Platform = 'ios' | 'android' | 'desktop';
export type PlatformPreference = 'auto' | Platform;
export type InstallMethod = 'prompt' | 'ios-guide' | 'browser-guide';

export type InstallEventType =
'prompt_available' |
'prompt_shown' |
'prompt_accepted' |
'prompt_dismissed' |
'installed' |
'guide_opened' |
'cta_dismissed';

export interface InstallEvent {
  app: AppId;
  type: InstallEventType;
  platform: Platform;
  browser: string;
  at: string;
}

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{outcome: 'accepted' | 'dismissed';platform: string;}>;
}

export interface AppShortcut {
  name: string;
  shortName: string;
  description: string;
  url: string;
}

export interface AppIdentity {
  id: string;
  name: string;
  shortName: string;
  description: string;
  startUrl: string;
  scope: string;
  themeColor: string;
  backgroundColor: string;
  statusBarStyle: 'default' | 'black-translucent';
  icon: string;
  serviceWorkerPath: string;
  version: string;
  shortcuts: AppShortcut[];
}