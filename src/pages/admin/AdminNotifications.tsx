import React, { useState } from 'react';
import { toast } from 'sonner';
import { SendIcon, Trash2Icon } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { LockedNotice } from '../../components/admin/LockedNotice';
import { SegmentedTabs } from '../../components/admin/SegmentedTabs';
import { ComposeSheet } from '../../components/admin/notifications/ComposeSheet';
import { Switch } from '../../components/Switch';
import { useAdminData } from '../../contexts/AdminDataContext';
import { useAdminSession } from '../../contexts/AdminSessionContext';
import { usePwa } from '../../contexts/PwaContext';
import { audienceOptions } from '../../data/adminPlatform';
import { formatWhen, makeId } from '../../utils/checks';
import { primaryButton } from '../../utils/formStyles';

type Tab = 'messages' | 'automatic';

export function AdminNotifications() {
  const { campaigns, addCampaign, removeCampaign, templates, saveTemplate } = useAdminData();
  const { session, permissions, log } = useAdminSession();
  const { online } = usePwa();
  const [tab, setTab] = useState<Tab>('messages');
  const [composeOpen, setComposeOpen] = useState(false);
  const canSend = permissions.sendNotifications && online;
  const audienceLabel = (id: string) => audienceOptions.find((a) => a.id === id)?.label ?? id;

  return (
    <>
      <AdminPageHeader
        title="Notifications"
        subtitle="Broadcast messages and the automatic alerts users receive."
        actions={
        canSend &&
        <button type="button" onClick={() => setComposeOpen(true)} className={`${primaryButton} h-11 px-4`}>
              <SendIcon className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">New message</span>
            </button>

        } />
      
      <div className="px-4 md:px-8">
        {!permissions.sendNotifications && <LockedNotice text="View only — sending needs the “Send notifications” permission." />}
        <SegmentedTabs
          label="Notification sections"
          value={tab}
          onChange={setTab}
          tabs={[
          { id: 'messages', label: 'Messages', count: campaigns.length },
          { id: 'automatic', label: 'Automatic alerts', count: templates.length }]
          } />
        
        {tab === 'messages' ?
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-3xl bg-surface lg:max-w-4xl">
            {campaigns.map((c) =>
          <li key={c.id} className="flex gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">{c.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.status === 'sent' ? 'bg-brand-soft text-brand-dark' : 'bg-sky-soft text-sky'}`}>
                      {c.status === 'sent' ? 'Sent' : 'Scheduled'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-ink-soft">{c.body}</p>
                  <p className="mt-1 text-sm text-muted">
                    {audienceLabel(c.audience)} · {c.channels.map((x) => x === 'push' ? 'Push' : 'Email').join(' + ')} · {c.reach.toLocaleString()} people · {formatWhen(c.at)} · {c.by}
                  </p>
                </div>
                {c.status === 'scheduled' && canSend &&
            <button
              type="button"
              aria-label={`Cancel ${c.title}`}
              onClick={() => {
                removeCampaign(c.id);
                log('notifications', `Cancelled scheduled message “${c.title}”`);
                toast('Scheduled message cancelled');
              }}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-danger hover:bg-danger-soft">
              
                    <Trash2Icon className="h-4 w-4" />
                  </button>
            }
              </li>
          )}
            {campaigns.length === 0 && <li className="px-5 py-10 text-center text-muted">No messages sent yet.</li>}
          </ul> :

        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-3xl bg-surface lg:max-w-4xl">
            {templates.map((t) =>
          <li key={t.id} className="flex min-h-[72px] items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">
                    {t.name}
                    {t.essential && <span className="ml-2 rounded-full bg-canvas px-2 py-0.5 text-xs font-semibold text-muted">Essential</span>}
                  </p>
                  <p className="text-sm text-muted">{t.trigger}</p>
                </div>
                <div className="hidden gap-1 sm:flex">
                  {(['push', 'email'] as const).map((ch) => {
                const on = t.channels.includes(ch);
                return (
                  <button
                    key={ch}
                    type="button"
                    aria-pressed={on}
                    disabled={!canSend}
                    onClick={() => {
                      const channels = on ? t.channels.filter((c) => c !== ch) : [...t.channels, ch];
                      if (channels.length === 0) return toast.error('Keep at least one channel, or turn the alert off');
                      saveTemplate({ ...t, channels });
                      log('notifications', `Changed channels for “${t.name}”`, channels.join(' + '));
                    }}
                    className={`h-9 rounded-full px-3 text-xs font-semibold transition-colors disabled:opacity-60 ${on ? 'bg-ink text-white' : 'bg-canvas text-muted'}`}>
                    
                        {ch === 'push' ? 'Push' : 'Email'}
                      </button>);

              })}
                </div>
                <Switch
              checked={t.enabled}
              disabled={!canSend}
              onChange={(on) => {
                saveTemplate({ ...t, enabled: on });
                log('notifications', `${on ? 'Turned on' : 'Turned off'} “${t.name}”`);
                toast(`${t.name} ${on ? 'on' : 'off'}`);
              }}
              label={`${t.name} enabled`} />
            
              </li>
          )}
          </ul>
        }
      </div>
      <ComposeSheet
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSend={(data) => {
          addCampaign({ ...data, id: makeId('cp'), by: session?.name ?? 'Admin' });
          log('notifications', `${data.status === 'sent' ? 'Sent' : 'Scheduled'} “${data.title}”`, `${audienceLabel(data.audience)} · ${data.reach.toLocaleString()} people`);
          setComposeOpen(false);
          toast.success(data.status === 'sent' ? 'Message sent' : `Scheduled for ${formatWhen(data.at)}`);
        }} />
      
    </>);

}