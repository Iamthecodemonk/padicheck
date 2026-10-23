import React, { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CloudOffIcon, LockIcon, SearchXIcon, ServerCrashIcon, ShieldAlertIcon, TimerIcon, InboxIcon } from 'lucide-react';

export type StateKind = 'empty' | 'no-result' | 'error' | 'network' | 'rate-limited' | 'unauthorized' | 'forbidden' | 'unavailable';

const presets: Record<StateKind, {icon: typeof InboxIcon;title: string;body: string;tone: string;}> = {
  empty: { icon: InboxIcon, title: 'Nothing here yet', body: '', tone: 'bg-canvas text-muted' },
  'no-result': { icon: SearchXIcon, title: 'We couldn’t find anything', body: 'No public information matched. That isn’t proof it’s safe — ask for more details and check again.', tone: 'bg-sky-soft text-sky' },
  error: { icon: ServerCrashIcon, title: 'Something went wrong', body: 'This wasn’t your fault. No credits were used. Please try again.', tone: 'bg-danger-soft text-danger' },
  network: { icon: CloudOffIcon, title: 'You’re offline', body: 'Connect to the internet and try again. Saved reports still open offline.', tone: 'bg-caution-soft text-caution' },
  'rate-limited': { icon: TimerIcon, title: 'Slow down a little', body: 'You’ve made a lot of requests in a short time. Please wait a moment.', tone: 'bg-amber-soft text-amber' },
  unauthorized: { icon: LockIcon, title: 'Sign in to continue', body: 'You need a PadiCheck account to see this.', tone: 'bg-canvas text-ink' },
  forbidden: { icon: ShieldAlertIcon, title: 'You don’t have access', body: 'Your account or role can’t open this. Ask an owner or admin for access.', tone: 'bg-canvas text-ink' },
  unavailable: { icon: ServerCrashIcon, title: 'Temporarily unavailable', body: 'This service is down for maintenance. Saved reports still work.', tone: 'bg-caution-soft text-caution' }
};

interface StateViewProps {
  kind: StateKind;
  title?: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}

/** One consistent empty / error / permission state for every screen. */
export function StateView({ kind, title, body, action, className = '' }: StateViewProps) {
  const p = presets[kind];
  const announce = kind !== 'empty' && kind !== 'no-result';
  return (
    <div role={announce ? 'alert' : 'status'} className={`flex flex-col items-center rounded-3xl bg-surface px-6 py-12 text-center ${className}`}>
      <span className={`grid h-14 w-14 place-items-center rounded-2xl ${p.tone}`}>
        <p.icon className="h-7 w-7" aria-hidden="true" />
      </span>
      <p className="mt-4 text-lg font-semibold text-ink">{title ?? p.title}</p>
      {(body ?? p.body) && <p className="mt-1 max-w-sm text-[15px] text-muted">{body ?? p.body}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
      {kind === 'unauthorized' && !action &&
      <Link to="/signin" className="mt-6 inline-flex h-12 items-center rounded-2xl bg-brand px-6 font-semibold text-white">
          Sign in
        </Link>
      }
    </div>);

}