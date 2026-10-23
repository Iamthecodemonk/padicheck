import React, { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { creditPackages as initialPackages } from '../data/credits';
import { initialContentDocs } from '../data/contentDocs';
import type { CreditPackage } from '../types/check';
import type { ContentDoc } from '../types/content';

interface PlatformValue {
  packages: CreditPackage[];
  activePackages: CreditPackage[];
  savePackage: (pkg: CreditPackage) => void;
  removePackage: (id: string) => void;
  docs: ContentDoc[];
  getDoc: (slug: string) => ContentDoc | undefined;
  saveDraft: (id: string, patch: {title: string;summary: string;draft: string;}, by: string) => void;
  publishDoc: (id: string, by: string) => void;
  discardDraft: (id: string) => void;
  createDoc: (doc: Pick<ContentDoc, 'kind' | 'title' | 'summary' | 'slug'>, by: string) => ContentDoc;
  removeDoc: (id: string) => void;
}

const PlatformContext = createContext<PlatformValue | null>(null);

/** Content and pricing shared by the consumer app and the admin console. */
export function PlatformProvider({ children }: {children: ReactNode;}) {
  const [packages, setPackages] = usePersistentState<CreditPackage[]>('pc-platform-packages', initialPackages);
  const [docs, setDocs] = usePersistentState<ContentDoc[]>('pc-platform-docs', initialContentDocs);

  // Add any pages introduced since this device last saved content, without touching edited ones.
  useEffect(() => {
    setDocs((list) => {
      const missing = initialContentDocs.filter((d) => !list.some((x) => x.id === d.id));
      return missing.length ? [...list, ...missing] : list;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savePackage = useCallback(
    (pkg: CreditPackage) =>
    setPackages((list) => {
      const next = list.some((p) => p.id === pkg.id) ? list.map((p) => p.id === pkg.id ? pkg : p) : [...list, pkg];
      // Only one package can be featured at a time.
      return pkg.featured ? next.map((p) => p.id === pkg.id ? p : { ...p, featured: false }) : next;
    }),
    [setPackages]
  );

  const value = useMemo<PlatformValue>(
    () => ({
      packages,
      activePackages: [...packages].filter((p) => p.active !== false).sort((a, b) => a.credits - b.credits),
      savePackage,
      removePackage: (id) => setPackages((list) => list.filter((p) => p.id !== id)),
      docs,
      getDoc: (slug) => docs.find((d) => d.slug === slug),
      saveDraft: (id, patch, by) =>
      setDocs((list) => list.map((d) => d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString(), updatedBy: by } : d)),
      publishDoc: (id, by) =>
      setDocs((list) =>
      list.map((d) =>
      d.id === id && d.draft !== null ?
      { ...d, body: d.draft, draft: null, version: d.version + 1, updatedAt: new Date().toISOString(), updatedBy: by } :
      d
      )
      ),
      discardDraft: (id) => setDocs((list) => list.map((d) => d.id === id ? { ...d, draft: null } : d)),
      createDoc: (doc, by) => {
        const created: ContentDoc = {
          ...doc,
          id: `doc-${Date.now().toString(36)}`,
          body: '',
          draft: '',
          version: 0,
          updatedAt: new Date().toISOString(),
          updatedBy: by
        };
        setDocs((list) => [...list, created]);
        return created;
      },
      removeDoc: (id) => setDocs((list) => list.filter((d) => d.id !== id))
    }),
    [packages, docs, savePackage, setPackages, setDocs]
  );

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatform(): PlatformValue {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform must be used inside PlatformProvider');
  return ctx;
}