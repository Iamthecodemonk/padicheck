import React, { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { useMediaQuery } from '../hooks/useMediaQuery';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeValue {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: {children: ReactNode;}) {
  // Dark is the default experience; light (or following the device) is opt-in from Account → Appearance.
  const [mode, setMode] = usePersistentState<ThemeMode>('pc-theme-v2', 'dark');
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const resolved: ResolvedTheme = mode === 'system' ? prefersDark ? 'dark' : 'light' : mode;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    if (!window.location.pathname.startsWith('/admin')) {
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#080E1B' : '#F4F6F8');
    }
  }, [resolved]);

  const value = useMemo<ThemeValue>(
    () => ({ mode, resolved, setMode, toggle: () => setMode(resolved === 'dark' ? 'light' : 'dark') }),
    [mode, resolved, setMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}