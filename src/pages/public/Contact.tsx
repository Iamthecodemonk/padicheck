import React, { useState } from 'react';
import { CircleCheckIcon, LoaderCircleIcon, MailIcon, MessageCircleIcon, ClockIcon } from 'lucide-react';
import { Field } from '../../components/admin/Field';
import { usePageMeta } from '../../hooks/usePageMeta';
import { chipClass, inputClass, primaryButton, textareaClass } from '../../utils/formStyles';
import { submit } from '../../utils/trustApi';

const categories = ['General question', 'Account & login', 'Payments & billing', 'Report a scam', 'Business verification', 'Dispute', 'API & partnerships', 'Press'];

export function Contact() {
  usePageMeta({ title: 'Contact PadiCheck', description: 'Get help with checks, payments, verification and more.' });
  const [category, setCategory] = useState(categories[0]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [tried, setTried] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [ticket, setTicket] = useState('');

  const errors = {
    name: name.trim().length < 2 ? 'Enter your name' : '',
    email: !/^\S+@\S+\.\S+$/.test(email) ? 'Enter a valid email address' : '',
    message: message.trim().length < 15 ? 'Tell us a little more (at least 15 characters)' : ''
  };

  const send = async () => {
    setTried(true);
    if (Object.values(errors).some(Boolean)) return;
    setState('sending');
    try {
      await submit(null);
      setTicket(`T-${Math.floor(4000 + Math.random() * 5000)}`);
      setState('sent');
    } catch {
      setState('error');
    }
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-4 pt-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-10 lg:pt-16">
      <div>
        <h1 className="text-4xl font-bold text-ink">Contact us</h1>
        {state === 'sent' ?
        <div className="mt-8 rounded-3xl bg-surface p-8 text-center" role="status">
            <CircleCheckIcon className="mx-auto h-12 w-12 text-brand" aria-hidden="true" />
            <p className="mt-3 text-xl font-semibold text-ink">Message sent</p>
            <p className="mt-1 text-ink-soft">
              Your reference is <strong className="text-ink">{ticket}</strong>. We’ve emailed a copy to {email} and usually reply within one working day.
            </p>
          </div> :

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="mt-8 space-y-5">
          
            <fieldset>
              <legend className="text-sm font-medium text-ink">What’s it about?</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {categories.map((c) =>
              <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={chipClass(category === c)}>
                    {c}
                  </button>
              )}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" error={tried ? errors.name : undefined}>
                <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Email" error={tried ? errors.email : undefined}>
                <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
              </Field>
            </div>
            <Field label="Message" error={tried ? errors.message : undefined}>
              <textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} className={textareaClass} />
            </Field>
            {state === 'error' &&
          <p role="alert" className="rounded-2xl bg-danger-soft p-4 text-sm text-danger">
                We couldn’t send your message. Check your connection and try again.
              </p>
          }
            <button type="submit" disabled={state === 'sending'} className={primaryButton}>
              {state === 'sending' && <LoaderCircleIcon className="h-5 w-5 animate-spin" aria-hidden="true" />}
              {state === 'sending' ? 'Sending…' : 'Send message'}
            </button>
          </form>
        }
      </div>
      <aside className="space-y-4 lg:pt-16">
        {[
        { icon: MailIcon, title: 'Email', body: 'support@padicheck.com' },
        { icon: MessageCircleIcon, title: 'WhatsApp', body: '+234 700 723 4243' },
        { icon: ClockIcon, title: 'Hours', body: 'Mon–Sat, 8am–8pm WAT' }].
        map((i) =>
        <div key={i.title} className="flex gap-3 rounded-3xl bg-surface p-5">
            <i.icon className="mt-0.5 h-5 w-5 text-brand" aria-hidden="true" />
            <div>
              <p className="font-semibold text-ink">{i.title}</p>
              <p className="text-ink-soft">{i.body}</p>
            </div>
          </div>
        )}
        <p className="text-sm text-muted">Been scammed? Contact your bank first, then report it on PadiCheck so others are warned.</p>
      </aside>
    </div>);

}