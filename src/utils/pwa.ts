import { appIdentities } from '../data/appIdentity';
import type { AppId, Platform, PlatformPreference } from '../types/pwa';

export function detectPlatform(preference: PlatformPreference = 'auto'): Platform {
  if (preference !== 'auto') return preference;
  const ua = navigator.userAgent;
  const isIpadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/i.test(ua) || isIpadOs) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/SamsungBrowser/.test(ua)) return 'Samsung Internet';
  if (/Firefox|FxiOS/.test(ua)) return 'Firefox';
  if (/Chrome|CriOS/.test(ua)) return 'Chrome';
  if (/Safari/.test(ua)) return 'Safari';
  return 'Browser';
}

export function isStandalone(): boolean {
  const nav = navigator as Navigator & {standalone?: boolean;};
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    nav.standalone === true);

}

export function buildManifest(app: AppId): Record<string, unknown> {
  const identity = appIdentities[app];
  const origin = window.location.origin;
  const abs = (path: string) => `${origin}${path}`;

  return {
    id: abs(identity.id),
    name: identity.name,
    short_name: identity.shortName,
    description: identity.description,
    start_url: abs(identity.startUrl),
    scope: abs(identity.scope),
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone'],
    orientation: 'any',
    theme_color: identity.themeColor,
    background_color: identity.backgroundColor,
    categories: app === 'admin' ? ['business', 'productivity'] : ['utilities', 'finance', 'shopping'],
    icons: [
    { src: identity.icon, sizes: '1024x1024', type: 'image/jpeg', purpose: 'any' },
    { src: identity.icon, sizes: '1024x1024', type: 'image/jpeg', purpose: 'maskable' }],

    shortcuts: identity.shortcuts.map((s) => ({
      name: s.name,
      short_name: s.shortName,
      description: s.description,
      url: abs(s.url),
      icons: [{ src: identity.icon, sizes: '1024x1024', type: 'image/jpeg' }]
    })),
    ...(app === 'consumer' ?
    {
      share_target: {
        action: abs('/share-target'),
        method: 'POST',
        enctype: 'multipart/form-data',
        params: {
          title: 'title',
          text: 'text',
          url: 'url',
          files: [{ name: 'files', accept: ['image/*', 'application/pdf', '.docx', 'text/plain'] }]
        }
      },
      protocol_handlers: [{ protocol: 'web+padicheck', url: abs('/share-target?url=%s') }],
      launch_handler: { client_mode: 'focus-existing' }
    } :
    { launch_handler: { client_mode: 'focus-existing' } })
  };
}

function upsertMeta(name: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertLink(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

// Applies manifest, icons, theme colour and iOS meta for whichever app is mounted.
export function applyAppIdentity(app: AppId): () => void {
  const identity = appIdentities[app];
  const blob = new Blob([JSON.stringify(buildManifest(app))], { type: 'application/manifest+json' });
  const manifestUrl = URL.createObjectURL(blob);

  upsertLink('manifest', manifestUrl);
  upsertLink('apple-touch-icon', identity.icon);
  upsertMeta('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
  upsertMeta('theme-color', identity.themeColor);
  upsertMeta('mobile-web-app-capable', 'yes');
  upsertMeta('apple-mobile-web-app-capable', 'yes');
  upsertMeta('apple-mobile-web-app-title', identity.shortName);
  upsertMeta('apple-mobile-web-app-status-bar-style', identity.statusBarStyle);
  upsertMeta('application-name', identity.name);
  upsertMeta('format-detection', 'telephone=no');
  document.title = identity.name;

  return () => URL.revokeObjectURL(manifestUrl);
}