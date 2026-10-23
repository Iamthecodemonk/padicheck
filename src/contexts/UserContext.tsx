import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { usePwa } from './PwaContext';
import { usePersistentState } from '../hooks/usePersistentState';
import { useOfflineQueue, type OfflineQueueApi } from '../hooks/useOfflineQueue';
import { initialTransactions } from '../data/credits';
import { notificationTypes } from '../data/preferences';
import { makeId } from '../utils/checks';
import type { ConsumerSession, CreditTransaction, QueuedTask } from '../types/check';

interface Preferences {
  country: string;
  currency: string;
  language: string;
}

interface UserContextValue extends OfflineQueueApi {
  session: ConsumerSession | null;
  signIn: (session: ConsumerSession) => void;
  signOut: () => void;
  credits: number;
  transactions: CreditTransaction[];
  spendCredits: (amount: number, label: string) => boolean;
  addCredits: (amount: number, label: string) => void;
  savedIds: string[];
  isSaved: (id: string) => boolean;
  toggleSaved: (id: string) => void;
  dataSaver: boolean;
  setDataSaver: (on: boolean) => void;
  notificationPrefs: Record<string, boolean>;
  setNotificationPref: (id: string, on: boolean) => void;
  preferences: Preferences;
  setPreference: (key: keyof Preferences, value: string) => void;
}

const UserContext = createContext<UserContextValue | null>(null);

const defaultSession: ConsumerSession = { name: 'Adaeze Okafor', email: 'adaeze.okafor@gmail.com', provider: 'google' };

export function UserProvider({ children }: {children: ReactNode;}) {
  const navigate = useNavigate();
  const { online } = usePwa();
  const [session, setSession] = usePersistentState<ConsumerSession | null>('pc-session', defaultSession);
  const [credits, setCredits] = usePersistentState('pc-credits', 18);
  const [transactions, setTransactions] = usePersistentState<CreditTransaction[]>('pc-transactions', initialTransactions);
  const [savedIds, setSavedIds] = usePersistentState<string[]>('pc-saved', ['r-iphone', 'r-lekki', 'r-tenancy']);
  const [dataSaver, setDataSaver] = usePersistentState('pc-data-saver', false);
  const [notificationPrefs, setNotificationPrefs] = usePersistentState<Record<string, boolean>>(
    'pc-notification-prefs',
    Object.fromEntries(notificationTypes.map((n) => [n.id, n.id !== 'research']))
  );
  const [preferences, setPreferences] = usePersistentState<Preferences>('pc-preferences', {
    country: 'NG',
    currency: 'NGN',
    language: 'en'
  });

  const creditsRef = useRef(credits);
  useEffect(() => {
    creditsRef.current = credits;
  }, [credits]);

  useEffect(() => {
    document.documentElement.classList.toggle('data-saver', dataSaver);
  }, [dataSaver]);

  const spendCredits = useCallback(
    (amount: number, label: string) => {
      if (creditsRef.current < amount) return false;
      creditsRef.current -= amount;
      setCredits(creditsRef.current);
      setTransactions((t) => [{ id: makeId('tx'), label, amount: -amount, at: new Date().toISOString() }, ...t]);
      return true;
    },
    [setCredits, setTransactions]
  );

  const addCredits = useCallback(
    (amount: number, label: string) => {
      creditsRef.current += amount;
      setCredits(creditsRef.current);
      setTransactions((t) => [{ id: makeId('tx'), label, amount, at: new Date().toISOString() }, ...t]);
    },
    [setCredits, setTransactions]
  );

  const queueApi = useOfflineQueue({
    online,
    charge: (task: QueuedTask) => spendCredits(task.credits, task.label),
    onReady: (task: QueuedTask) =>
    toast.success('Your queued check is ready', {
      description: task.label,
      action: { label: 'View', onClick: () => navigate(`/result/${task.resultId}`) }
    })
  });

  const value = useMemo<UserContextValue>(
    () => ({
      ...queueApi,
      session,
      signIn: setSession,
      signOut: () => setSession(null),
      credits,
      transactions,
      spendCredits,
      addCredits,
      savedIds,
      isSaved: (id) => savedIds.includes(id),
      toggleSaved: (id) => setSavedIds((s) => s.includes(id) ? s.filter((x) => x !== id) : [id, ...s]),
      dataSaver,
      setDataSaver,
      notificationPrefs,
      setNotificationPref: (id, on) => setNotificationPrefs((p) => ({ ...p, [id]: on })),
      preferences,
      setPreference: (key, v) => setPreferences((p) => ({ ...p, [key]: v }))
    }),
    [queueApi, session, setSession, credits, transactions, spendCredits, addCredits, savedIds, setSavedIds, dataSaver, setDataSaver, notificationPrefs, setNotificationPrefs, preferences, setPreferences]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used inside UserProvider');
  return ctx;
}