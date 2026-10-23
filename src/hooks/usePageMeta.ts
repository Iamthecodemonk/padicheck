import { useEffect } from 'react';

interface PageMeta {
  title: string;
  description?: string;
  path?: string;
  /** JSON-LD structured data for rich results (e.g. Organization, LocalBusiness). */
  structuredData?: Record<string, unknown>;
}

const ORIGIN = 'https://padicheck.com';

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

/** Sets title, description, Open Graph, canonical and structured data for public pages. */
export function usePageMeta({ title, description, path, structuredData }: PageMeta) {
  const ld = structuredData ? JSON.stringify(structuredData) : '';
  useEffect(() => {
    const full = title.includes('PadiCheck') ? title : `${title} · PadiCheck`;
    document.title = full;
    const url = `${ORIGIN}${path ?? window.location.pathname}`;
    if (description) {
      setMeta('name', 'description', description);
      setMeta('property', 'og:description', description);
    }
    setMeta('property', 'og:title', full);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:type', 'website');
    setMeta('name', 'twitter:card', 'summary_large_image');

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = url;

    let script: HTMLScriptElement | null = null;
    if (ld) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.text = JSON.stringify({ '@context': 'https://schema.org', ...JSON.parse(ld) });
      document.head.appendChild(script);
    }
    return () => script?.remove();
  }, [title, description, path, ld]);
}