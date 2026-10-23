import React, { useEffect, useState } from 'react';
import { BottomSheet } from '../../BottomSheet';
import { Field } from '../Field';
import { audienceOptions } from '../../../data/adminPlatform';
import { chipClass, inputClass, primaryButton, textareaClass } from '../../../utils/formStyles';
import type { Campaign, NotificationChannel } from '../../../types/admin';

interface ComposeSheetProps {
  open: boolean;
  onClose: () => void;
  onSend: (data: Pick<Campaign, 'title' | 'body' | 'audience' | 'channels' | 'status' | 'at' | 'reach'>) => void;
}

export function ComposeSheet({ open, onClose, onSend }: ComposeSheetProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Campaign['audience']>('all');
  const [channels, setChannels] = useState<NotificationChannel[]>(['push']);
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle('');
      setBody('');
      setAudience('all');
      setChannels(['push']);
      setWhen('now');
      setScheduledAt('');
      setTried(false);
    }
  }, [open]);

  const size = audienceOptions.find((a) => a.id === audience)?.size ?? 0;
  const errors = {
    title: title.trim().length < 3 ? 'Add a short title' : '',
    body: body.trim().length < 10 ? 'Write at least a sentence' : '',
    channels: channels.length === 0 ? 'Choose at least one channel' : '',
    when: when === 'later' && (!scheduledAt || new Date(scheduledAt) <= new Date()) ? 'Pick a time in the future' : ''
  };
  const valid = Object.values(errors).every((e) => !e);
  const toggleChannel = (c: NotificationChannel) => setChannels((l) => l.includes(c) ? l.filter((x) => x !== c) : [...l, c]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="New message"
      description="Only send what people genuinely need — users who opt out won’t receive it."
      footer={
      <button
        type="button"
        onClick={() => {
          setTried(true);
          if (!valid) return;
          onSend({
            title: title.trim(),
            body: body.trim(),
            audience,
            channels,
            status: when === 'now' ? 'sent' : 'scheduled',
            at: when === 'now' ? new Date().toISOString() : new Date(scheduledAt).toISOString(),
            reach: size
          });
        }}
        className={`${primaryButton} w-full`}>
        
          {when === 'now' ? `Send to ${size.toLocaleString()} people` : 'Schedule message'}
        </button>
      }>
      
      <div className="space-y-4">
        <Field label="Title" error={tried ? errors.title : undefined} hint={`${title.length}/50`}>
          <input value={title} maxLength={50} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="e.g. New: check rental agreements" />
        </Field>
        <Field label="Message" error={tried ? errors.body : undefined} hint={`${body.length}/160`}>
          <textarea value={body} maxLength={160} rows={3} onChange={(e) => setBody(e.target.value)} className={textareaClass} />
        </Field>
        <fieldset>
          <legend className="text-sm font-medium text-ink">Audience</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {audienceOptions.map((a) =>
            <button key={a.id} type="button" aria-pressed={audience === a.id} onClick={() => setAudience(a.id)} className={chipClass(audience === a.id)}>
                {a.label}
              </button>
            )}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-medium text-ink">Channels</legend>
          <div className="mt-2 flex gap-2">
            {(['push', 'email'] as const).map((c) =>
            <button key={c} type="button" aria-pressed={channels.includes(c)} onClick={() => toggleChannel(c)} className={chipClass(channels.includes(c))}>
                {c === 'push' ? 'Push' : 'Email'}
              </button>
            )}
          </div>
          {tried && errors.channels && <p className="mt-1 text-sm text-danger">{errors.channels}</p>}
        </fieldset>
        <fieldset>
          <legend className="text-sm font-medium text-ink">When</legend>
          <div className="mt-2 flex gap-2">
            <button type="button" aria-pressed={when === 'now'} onClick={() => setWhen('now')} className={chipClass(when === 'now')}>
              Send now
            </button>
            <button type="button" aria-pressed={when === 'later'} onClick={() => setWhen('later')} className={chipClass(when === 'later')}>
              Schedule
            </button>
          </div>
          {when === 'later' &&
          <Field label="Send at" error={tried ? errors.when : undefined} className="mt-3">
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={inputClass} />
            </Field>
          }
        </fieldset>
        {title && body &&
        <div className="rounded-2xl bg-canvas p-3">
            <p className="mb-2 text-xs font-semibold text-muted">Preview</p>
            <div className="flex gap-3 rounded-2xl bg-surface p-3 shadow-card">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-sm font-bold text-white">P</span>
              <div className="min-w-0">
                <p className="font-semibold text-ink">{title}</p>
                <p className="text-sm text-ink-soft">{body}</p>
              </div>
            </div>
          </div>
        }
      </div>
    </BottomSheet>);

}