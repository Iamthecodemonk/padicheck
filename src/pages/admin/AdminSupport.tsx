import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeftIcon, LockIcon, SendIcon } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { StatusPill } from '../../components/admin/StatusPill';
import { useAdminSession } from '../../contexts/AdminSessionContext';
import { usePwa } from '../../contexts/PwaContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { supportTickets } from '../../data/adminSupport';
import { formatWhen } from '../../utils/checks';
import type { SupportTicket } from '../../types/admin';

const statuses: SupportTicket['status'][] = ['open', 'waiting', 'resolved'];

export function AdminSupport() {
  const { id } = useParams<{id: string;}>();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { session, permissions, log } = useAdminSession();
  const { online } = usePwa();
  const [tickets, setTickets] = useState(supportTickets);
  const [reply, setReply] = useState('');

  const activeId = id ?? (isDesktop ? tickets[0]?.id : undefined);
  const active = tickets.find((t) => t.id === activeId);
  const canReply = permissions.replySupport && online;

  const update = (ticketId: string, patch: Partial<SupportTicket>) => setTickets((list) => list.map((t) => t.id === ticketId ? { ...t, ...patch } : t));

  const send = () => {
    if (!active || !reply.trim() || !session) return;
    update(active.id, {
      status: 'waiting',
      messages: [...active.messages, { from: 'agent', author: `${session.name.split(' ')[0]} (Support)`, text: reply.trim(), at: new Date().toISOString() }]
    });
    setReply('');
    log('support', `Replied to ${active.id}`, active.subject);
    toast.success('Reply sent', { description: `${active.user} will get a push notification.` });
  };

  const list =
  <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface">
      {tickets.map((t) =>
    <li key={t.id}>
          <Link
        to={`/admin/support/${t.id}`}
        aria-current={t.id === activeId ? 'true' : undefined}
        className={`flex min-h-[76px] flex-col justify-center gap-1 px-4 py-3 transition-colors ${t.id === activeId && isDesktop ? 'bg-canvas' : 'hover:bg-canvas/70'}`}>
        
            <span className="flex items-center gap-2">
              {t.priority === 'high' && <span className="h-2 w-2 shrink-0 rounded-full bg-danger" aria-label="High priority" />}
              <span className="min-w-0 flex-1 truncate font-semibold text-ink">{t.subject}</span>
              <StatusPill status={t.status} />
            </span>
            <span className="truncate text-sm text-muted">
              {t.user} · {t.id} · {formatWhen(t.at)}
            </span>
          </Link>
        </li>
    )}
    </ul>;


  const detail = active &&
  <section aria-label={`Ticket ${active.id}`} className="flex flex-col rounded-3xl bg-surface lg:min-h-[560px]">
      <div className="border-b border-line p-4 md:p-5">
        {!isDesktop &&
      <button type="button" onClick={() => navigate('/admin/support')} className="-ml-2 mb-1 inline-flex h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-muted">
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" /> All tickets
          </button>
      }
        <h2 className="text-lg font-semibold text-ink">{active.subject}</h2>
        <p className="text-sm text-muted">
          <Link to={`/admin/users/${active.userId}`} className="font-medium text-ink underline-offset-2 hover:underline">
            {active.user}
          </Link>{' '}
          · {active.id}
        </p>
        <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Ticket status">
          {statuses.map((s) =>
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={active.status === s}
          disabled={!canReply}
          onClick={() => update(active.id, { status: s })}
          className={`h-11 rounded-full px-4 text-sm font-medium capitalize transition-colors disabled:opacity-50 ${active.status === s ? 'bg-ink text-white' : 'bg-canvas text-ink hover:bg-line/60'}`}>
          
              {s}
            </button>
        )}
        </div>
      </div>
      <ol className="flex-1 space-y-4 p-4 md:p-5">
        {active.messages.map((m, i) =>
      <li key={i} className={`flex ${m.from === 'agent' ? 'justify-end' : ''}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${m.from === 'agent' ? 'bg-ink text-white' : 'bg-canvas text-ink'}`}>
              <p className="text-[15px] leading-relaxed">{m.text}</p>
              <p className={`mt-1 text-xs ${m.from === 'agent' ? 'text-navy-text' : 'text-muted'}`}>
                {m.author} · {formatWhen(m.at)}
              </p>
            </div>
          </li>
      )}
      </ol>
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+62px)] rounded-b-3xl border-t border-line bg-surface p-3 md:bottom-0">
        {permissions.replySupport ?
      <div className="flex items-end gap-2">
            <label htmlFor="reply" className="sr-only">
              Reply
            </label>
            <textarea
          id="reply"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={2}
          disabled={!online}
          placeholder={online ? `Reply to ${active.user.split(' ')[0]}…` : 'Reconnect to reply'}
          className="min-h-[48px] flex-1 resize-none rounded-2xl bg-canvas px-4 py-3 text-base text-ink outline-none placeholder:text-muted/80 focus:ring-2 focus:ring-ink" />
        
            <button type="button" onClick={send} disabled={!canReply || !reply.trim()} aria-label="Send reply" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand text-white hover:bg-brand-dark disabled:opacity-40">
              <SendIcon className="h-5 w-5" />
            </button>
          </div> :

      <p className="flex items-center gap-2 px-1 py-2 text-sm text-muted">
            <LockIcon className="h-4 w-4" aria-hidden="true" /> Your role can view tickets but not reply.
          </p>
      }
      </div>
    </section>;


  if (!isDesktop && active) return <div className="px-4 pt-4 md:px-8">{detail}</div>;

  return (
    <>
      <AdminPageHeader title="Support" subtitle={`${tickets.filter((t) => t.status === 'open').length} open tickets`} />
      <div className="grid gap-5 px-4 md:px-8 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
        {list}
        {isDesktop && detail}
      </div>
    </>);

}