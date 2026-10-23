import React, { useState } from 'react';
import { toast } from 'sonner';
import { PlusIcon, SendIcon, Trash2Icon } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { Switch } from '../../components/Switch';
import { Field } from '../../components/admin/Field';
import { StateView } from '../../components/trust/StateView';
import { useTrust } from '../../contexts/TrustContext';
import { webhookEvents } from '../../data/developer';
import { formatWhen } from '../../utils/checks';
import { chipClass, inputClass, primaryButton } from '../../utils/formStyles';

export function DevWebhooks() {
  const { webhooks, saveWebhook, removeWebhook } = useTrust();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>(['check.completed']);
  const [tried, setTried] = useState(false);
  const urlError = !/^https:\/\/[\w-]+(\.[\w-]+)+\S*$/.test(url) ? 'Use a public https:// address' : '';

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">We sign every delivery with an HMAC header so you can verify it came from PadiCheck.</p>
        <button type="button" onClick={() => setOpen(true)} className={`${primaryButton} h-11 shrink-0 px-4`}>
          <PlusIcon className="h-4 w-4" aria-hidden="true" /> Add endpoint
        </button>
      </div>
      {webhooks.length === 0 ?
      <StateView kind="empty" className="mt-4" title="No webhooks" body="Get notified when checks finish or scores change." /> :

      <ul className="mt-4 space-y-3">
          {webhooks.map((w) =>
        <li key={w.id} className="rounded-3xl bg-surface p-5">
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{w.url}</span>
                <Switch checked={w.active} onChange={(on) => saveWebhook({ ...w, active: on })} label={`Enable ${w.url}`} />
              </div>
              <p className="mt-2 text-sm text-muted">{w.events.join(' · ')}</p>
              <p className="mt-1 text-sm text-muted">{w.lastDelivery ? `Last delivery ${formatWhen(w.lastDelivery.at)} · ${w.lastDelivery.status}` : 'No deliveries yet'}</p>
              <div className="mt-3 flex gap-2">
                <button
              type="button"
              disabled={!w.active}
              onClick={() => {
                saveWebhook({ ...w, lastDelivery: { at: new Date().toISOString(), status: 200 } });
                toast.success('Test event delivered · 200 OK');
              }}
              className="inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-ink ring-1 ring-line disabled:opacity-40">
              
                  <SendIcon className="h-4 w-4" aria-hidden="true" /> Send test
                </button>
                <button
              type="button"
              onClick={() => {
                removeWebhook(w.id);
                toast('Endpoint removed');
              }}
              className="inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-danger hover:bg-danger-soft">
              
                  <Trash2Icon className="h-4 w-4" aria-hidden="true" /> Remove
                </button>
              </div>
            </li>
        )}
        </ul>
      }
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Add webhook endpoint"
        footer={
        <button
          type="button"
          onClick={() => {
            setTried(true);
            if (urlError || !events.length) return;
            saveWebhook({ id: `wh-${Date.now()}`, url, events, active: true });
            setOpen(false);
            setUrl('');
            setTried(false);
            toast.success('Endpoint added');
          }}
          className={`${primaryButton} w-full`}>
          
            Add endpoint
          </button>
        }>
        
        <div className="space-y-4">
          <Field label="Endpoint URL" error={tried ? urlError : undefined}>
            <input value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" placeholder="https://" className={inputClass} />
          </Field>
          <fieldset>
            <legend className="text-sm font-medium text-ink">Events</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {webhookEvents.map((ev) =>
              <button key={ev} type="button" aria-pressed={events.includes(ev)} onClick={() => setEvents((l) => l.includes(ev) ? l.filter((x) => x !== ev) : [...l, ev])} className={chipClass(events.includes(ev))}>
                  <span className="font-mono text-xs">{ev}</span>
                </button>
              )}
            </div>
            {tried && !events.length && <p className="mt-1.5 text-sm text-danger">Choose at least one event</p>}
          </fieldset>
        </div>
      </BottomSheet>
    </div>);

}