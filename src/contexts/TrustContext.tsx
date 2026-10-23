import React, { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { initialBusinesses, initialReviews, MY_BUSINESS_ID } from '../data/businesses';
import { initialApiKeys, initialRequestLogs, initialWebhooks } from '../data/developer';
import { directorySeedBusinesses, directorySeedReviews } from '../data/directory';
import { initialAiFlags, initialDisputes, initialReports } from '../data/moderation';
import { initialNotifications } from '../data/notifications';
import { initialInvoices } from '../data/plans';
import { initialScoreConfig } from '../data/scoring';
import { trustEntities } from '../data/trustEntities';
import { entityFromBusiness } from '../utils/trustApi';
import { makeId } from '../utils/checks';
import type {
  AiFlag,
  ApiKey,
  ApiRequestLog,
  AppNotification,
  Business,
  Dispute,
  DisputeMessage,
  Invoice,
  ReportUpdate,
  Review,
  ScoreConfig,
  Subscription,
  TrustEntity,
  UserReport,
  Webhook } from
'../types/trust';

/**
 * Shared trust data used by the consumer app, business portal, developer portal and admin console.
 * In production each slice maps to an API resource; here it is persisted locally so flows can be walked end to end.
 */
interface TrustValue {
  entities: TrustEntity[];
  getEntity: (id: string) => TrustEntity | undefined;
  upsertEntity: (e: TrustEntity) => void;
  myCheckIds: string[];
  recordCheck: (id: string) => void;
  savedEntityIds: string[];
  toggleSavedEntity: (id: string) => void;

  businesses: Business[];
  myBusiness: Business;
  getBusinessBySlug: (slug: string) => Business | undefined;
  getBusinessByCertificate: (id: string) => Business | undefined;
  saveBusiness: (b: Business) => void;

  reviews: Review[];
  saveReview: (r: Review) => void;

  reports: UserReport[];
  addReport: (r: Omit<UserReport, 'id' | 'at' | 'updates' | 'status'>) => UserReport;
  updateReport: (id: string, patch: Partial<UserReport>, update?: Omit<ReportUpdate, 'at'>) => void;

  disputes: Dispute[];
  addDispute: (d: Omit<Dispute, 'id' | 'at' | 'status' | 'messages'>) => Dispute;
  updateDispute: (id: string, patch: Partial<Dispute>, message?: Omit<DisputeMessage, 'at'>) => void;

  aiFlags: AiFlag[];
  updateAiFlag: (id: string, patch: Partial<AiFlag>) => void;

  scoreConfig: ScoreConfig;
  saveScoreConfig: (c: ScoreConfig) => void;

  apiKeys: ApiKey[];
  saveApiKey: (k: ApiKey) => void;
  requestLogs: ApiRequestLog[];
  logRequest: (r: Omit<ApiRequestLog, 'id' | 'at'>) => void;
  webhooks: Webhook[];
  saveWebhook: (w: Webhook) => void;
  removeWebhook: (id: string) => void;

  notifications: AppNotification[];
  unreadCount: number;
  notify: (n: Omit<AppNotification, 'id' | 'at' | 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;

  subscription: Subscription;
  setSubscription: (s: Subscription) => void;
  invoices: Invoice[];
  addInvoice: (i: Invoice) => void;
}

const TrustContext = createContext<TrustValue | null>(null);

const upsert = <T extends {id: string;},>(list: T[], item: T) =>
list.some((x) => x.id === item.id) ? list.map((x) => x.id === item.id ? item : x) : [item, ...list];

export function TrustProvider({ children }: {children: ReactNode;}) {
  const [entities, setEntities] = usePersistentState<TrustEntity[]>('pc-trust-entities', trustEntities);
  const [myCheckIds, setMyCheckIds] = usePersistentState<string[]>('pc-trust-my-checks', ['e-web-cheap-iphones', 'e-phone-0142', 'e-prop-admiralty', 'e-job-globalhire']);
  const [savedEntityIds, setSavedEntityIds] = usePersistentState<string[]>('pc-trust-saved', ['e-biz-lekki-prime', 'e-web-cheap-iphones']);
  const [businesses, setBusinesses] = usePersistentState<Business[]>('pc-trust-businesses-v2', [...initialBusinesses, ...directorySeedBusinesses]);
  const [reviews, setReviews] = usePersistentState<Review[]>('pc-trust-reviews-v2', [...initialReviews, ...directorySeedReviews]);
  const [reports, setReports] = usePersistentState<UserReport[]>('pc-trust-reports', initialReports);
  const [disputes, setDisputes] = usePersistentState<Dispute[]>('pc-trust-disputes', initialDisputes);
  const [aiFlags, setAiFlags] = usePersistentState<AiFlag[]>('pc-trust-ai-flags', initialAiFlags);
  const [scoreConfig, saveScoreConfig] = usePersistentState<ScoreConfig>('pc-trust-score-config', initialScoreConfig);
  const [apiKeys, setApiKeys] = usePersistentState<ApiKey[]>('pc-dev-keys', initialApiKeys);
  const [requestLogs, setRequestLogs] = usePersistentState<ApiRequestLog[]>('pc-dev-logs', initialRequestLogs);
  const [webhooks, setWebhooks] = usePersistentState<Webhook[]>('pc-dev-webhooks', initialWebhooks);
  const [notifications, setNotifications] = usePersistentState<AppNotification[]>('pc-notifications', initialNotifications);
  const [subscription, setSubscription] = usePersistentState<Subscription>('pc-subscription', {
    planId: 'plus',
    period: 'monthly',
    status: 'active',
    renewsAt: '2026-10-12T10:00:00'
  });
  const [invoices, setInvoices] = usePersistentState<Invoice[]>('pc-invoices', initialInvoices);

  const notify = useCallback(
    (n: Omit<AppNotification, 'id' | 'at' | 'read'>) =>
    setNotifications((l) => [{ ...n, id: makeId('n'), at: new Date().toISOString(), read: false }, ...l].slice(0, 100)),
    [setNotifications]
  );

  const getEntity = useCallback(
    (id: string) => {
      const found = entities.find((e) => e.id === id);
      if (found) return found;
      const biz = businesses.find((b) => (b.entityId ?? `e-biz-${b.slug}`) === id || `e-biz-${b.slug.split('-')[0]}` === id);
      return biz ? entityFromBusiness(biz) : undefined;
    },
    [entities, businesses]
  );

  const value = useMemo<TrustValue>(() => {
    const now = () => new Date().toISOString();
    return {
      entities,
      getEntity,
      upsertEntity: (e) => setEntities((l) => upsert(l, e)),
      myCheckIds,
      recordCheck: (id) => setMyCheckIds((l) => [id, ...l.filter((x) => x !== id)].slice(0, 100)),
      savedEntityIds,
      toggleSavedEntity: (id) => setSavedEntityIds((l) => l.includes(id) ? l.filter((x) => x !== id) : [id, ...l]),

      businesses,
      myBusiness: businesses.find((b) => b.id === MY_BUSINESS_ID) ?? businesses[0],
      getBusinessBySlug: (slug) => businesses.find((b) => b.slug === slug),
      getBusinessByCertificate: (id) => businesses.find((b) => b.certificateId?.toLowerCase() === id.toLowerCase()),
      saveBusiness: (b) => setBusinesses((l) => upsert(l, b)),

      reviews,
      saveReview: (r) => setReviews((l) => upsert(l, r)),

      reports,
      addReport: (r) => {
        const report: UserReport = {
          ...r,
          id: `RP-${20450 + Math.floor(Math.random() * 900)}`,
          at: now(),
          status: 'pending',
          updates: [{ at: now(), text: 'Report received.', by: 'PadiCheck' }]
        };
        setReports((l) => [report, ...l]);
        return report;
      },
      updateReport: (id, patch, update) =>
      setReports((l) => l.map((x) => x.id === id ? { ...x, ...patch, updates: update ? [...x.updates, { ...update, at: now() }] : x.updates } : x)),

      disputes,
      addDispute: (d) => {
        const dispute: Dispute = {
          ...d,
          id: `DS-${1050 + Math.floor(Math.random() * 900)}`,
          at: now(),
          status: 'open',
          messages: [{ from: 'business', author: d.businessName, text: d.statement, at: now() }]
        };
        setDisputes((l) => [dispute, ...l]);
        return dispute;
      },
      updateDispute: (id, patch, message) =>
      setDisputes((l) => l.map((x) => x.id === id ? { ...x, ...patch, messages: message ? [...x.messages, { ...message, at: now() }] : x.messages } : x)),

      aiFlags,
      updateAiFlag: (id, patch) => setAiFlags((l) => l.map((x) => x.id === id ? { ...x, ...patch } : x)),

      scoreConfig,
      saveScoreConfig,

      apiKeys,
      saveApiKey: (k) => setApiKeys((l) => upsert(l, k)),
      requestLogs,
      logRequest: (r) => setRequestLogs((l) => [{ ...r, id: makeId('rq'), at: now() }, ...l].slice(0, 200)),
      webhooks,
      saveWebhook: (w) => setWebhooks((l) => upsert(l, w)),
      removeWebhook: (id) => setWebhooks((l) => l.filter((w) => w.id !== id)),

      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      notify,
      markRead: (id) => setNotifications((l) => l.map((n) => n.id === id ? { ...n, read: true } : n)),
      markAllRead: () => setNotifications((l) => l.map((n) => ({ ...n, read: true }))),

      subscription,
      setSubscription,
      invoices,
      addInvoice: (i) => setInvoices((l) => [i, ...l])
    };
  }, [
  entities, getEntity, setEntities, myCheckIds, setMyCheckIds, savedEntityIds, setSavedEntityIds, businesses, setBusinesses, reviews, setReviews,
  reports, setReports, disputes, setDisputes, aiFlags, setAiFlags, scoreConfig, saveScoreConfig, apiKeys, setApiKeys, requestLogs, setRequestLogs,
  webhooks, setWebhooks, notifications, setNotifications, notify, subscription, setSubscription, invoices, setInvoices]
  );

  return <TrustContext.Provider value={value}>{children}</TrustContext.Provider>;
}

export function useTrust(): TrustValue {
  const ctx = useContext(TrustContext);
  if (!ctx) throw new Error('useTrust must be used inside TrustProvider');
  return ctx;
}