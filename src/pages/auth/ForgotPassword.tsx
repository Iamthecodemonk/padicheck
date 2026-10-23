import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoaderCircleIcon, MailCheckIcon } from 'lucide-react';
import { AuthShell, authInput } from '../../components/auth/AuthShell';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'limited'>('idle');
  const [error, setError] = useState('');
  const attempts = useRef(0);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Enter the email you signed up with');
      return;
    }
    attempts.current += 1;
    if (attempts.current > 3) {
      setState('limited');
      return;
    }
    setState('sending');
    await new Promise((r) => window.setTimeout(r, 800));
    setState('sent');
  };

  return (
    <AuthShell title="Reset your password" subtitle={state === 'sent' ? undefined : 'We’ll email you a secure link to choose a new password.'}>
      {state === 'sent' ?
      <div role="status">
          <MailCheckIcon className="h-12 w-12 text-brand" aria-hidden="true" />
          <p className="mt-3 text-ink">
            If an account exists for <strong>{email}</strong>, a reset link is on its way. It expires in 30 minutes.
          </p>
          <button type="button" onClick={() => send()} className="mt-6 h-12 w-full rounded-2xl font-semibold text-ink ring-1 ring-line hover:bg-surface">
            Resend email
          </button>
          <Link to="/reset-password?token=demo-valid" className="mt-3 block text-center text-sm font-semibold text-brand-dark">
            Open the reset link (demo)
          </Link>
        </div> :

      <form onSubmit={send} noValidate className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-ink">Email</span>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(error)} className={authInput} />
          </label>
          {error &&
        <p role="alert" className="text-sm text-danger">
              {error}
            </p>
        }
          {state === 'limited' &&
        <p role="alert" className="rounded-2xl bg-amber-soft p-3 text-sm text-amber">
              Too many requests. For your security, please wait 15 minutes before trying again.
            </p>
        }
          <button type="submit" disabled={state === 'sending' || state === 'limited'} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
            {state === 'sending' && <LoaderCircleIcon className="h-5 w-5 animate-spin" aria-hidden="true" />} Send reset link
          </button>
          <Link to="/recover" className="block text-center text-sm font-semibold text-muted hover:text-ink">
            No access to your email? Recover your account
          </Link>
        </form>
      }
      <p className="mt-6 text-center text-sm">
        <Link to="/signin" className="font-semibold text-brand-dark">
          Back to log in
        </Link>
      </p>
    </AuthShell>);

}