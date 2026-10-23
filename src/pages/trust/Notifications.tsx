import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellIcon, CreditCardIcon, FileWarningIcon, GaugeIcon, ScaleIcon, SearchCheckIcon, ShieldCheckIcon, BookmarkIcon, ReceiptIcon, SettingsIcon } from 'lucide-react';
import { PageHeader } from '../../components/consumer/PageHeader';
import { NotificationSheet } from '../../components/consumer/account/NotificationSheet';
import { StateView } from '../../components/trust/StateView';
import { useTrust } from '../../contexts/TrustContext';
import { formatWhen } from '../../utils/checks';
import { chipClass } from '../../utils/formStyles';
import type { NotificationCategory } from '../../types/trust';

const icons: Record<NotificationCategory, {icon: typeof BellIcon;tone: string;}> = {
  check: { icon: SearchCheckIcon, tone: 'bg-brand-soft text-brand-dark' },
  report: { icon: FileWarningIcon, tone: 'bg-sky-soft text-sky' },
  dispute: { icon: ScaleIcon, tone: 'bg-violet-soft text-violet' },
  verification: { icon: ShieldCheckIcon, tone: 'bg-brand-soft text-brand-dark' },
  subscription: { icon: ReceiptIcon, tone: 'bg-amber-soft text-amber' },
  payment: { icon: CreditCardIcon, tone: 'bg-amber-soft text-amber' },
  security: { icon: ShieldCheckIcon, tone: 'bg-danger-soft text-danger' },
  score: { icon: GaugeIcon, tone: 'bg-teal-soft text-teal' },
  saved: { icon: BookmarkIcon, tone: 'bg-rose-soft text-rose' }
};

export function Notifications() {
  const navigate = useNavigate();
  const { notifications, markRead, markAllRead, unreadCount } = useTrust();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const list = notifications.filter((n) => !unreadOnly || !n.read);

  return (
    <>
      <PageHeader
        title="Notifications"
        back
        actions={
        <button type="button" aria-label="Notification preferences" onClick={() => setPrefsOpen(true)} className="grid h-11 w-11 place-items-center rounded-full text-ink hover:bg-ink/5">
            <SettingsIcon className="h-5 w-5" />
          </button>
        } />
      
      <div className="mx-auto w-full max-w-3xl px-4 lg:px-10">
        <div className="flex items-center gap-2">
          <button type="button" aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)} className={chipClass(!unreadOnly)}>
            All
          </button>
          <button type="button" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)} className={chipClass(unreadOnly)}>
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </button>
          {unreadCount > 0 &&
          <button type="button" onClick={markAllRead} className="ml-auto h-11 rounded-xl px-3 text-sm font-semibold text-brand-dark hover:bg-surface">
              Mark all read
            </button>
          }
        </div>
        {list.length === 0 ?
        <StateView kind="empty" className="mt-4" title={unreadOnly ? 'You’re all caught up' : 'No notifications yet'} /> :

        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-3xl bg-surface">
            {list.map((n) => {
            const meta = icons[n.category];
            return (
              <li key={n.id}>
                  <button
                  type="button"
                  onClick={() => {
                    markRead(n.id);
                    if (n.to) navigate(n.to);
                  }}
                  className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-canvas/60">
                  
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${meta.tone}`}>
                      <meta.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block ${n.read ? 'font-medium text-ink-soft' : 'font-semibold text-ink'}`}>{n.title}</span>
                      <span className="block text-sm text-muted">{n.body}</span>
                      <span className="mt-1 block text-xs text-muted">{formatWhen(n.at)}</span>
                    </span>
                    {!n.read && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
                  </button>
                </li>);

          })}
          </ul>
        }
      </div>
      <NotificationSheet open={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </>);

}