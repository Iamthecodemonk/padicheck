import type { AppId, InstallEvent, InstallEventType, Platform } from '../types/pwa';

const KEY = 'pc-install-events';
const MAX_EVENTS = 50;

export function trackInstallEvent(app: AppId, type: InstallEventType, platform: Platform, browser: string): void {
  try {
    const events = readInstallEvents();
    const next: InstallEvent = { app, type, platform, browser, at: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify([next, ...events].slice(0, MAX_EVENTS)));
  } catch {

    // Storage can be unavailable in private mode; tracking is best-effort.
  }}

export function readInstallEvents(): InstallEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) as InstallEvent[] : [];
  } catch {
    return [];
  }
}