import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CircleCheckIcon, LinkIcon, LoaderCircleIcon } from 'lucide-react';
import { AuthShell, authInput } from '../../components/auth/AuthShell';

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const tokenState = !token ? 'invalid' : token.includes('expired') ? 'expired' : 'valid';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle');

  if (tokenState !== 'valid') {
    return (
      <AuthShell title={tokenState === 'expired' ? 'This link has expired' : 'This link isn’t valid'} subtitle="Reset links work once and expire after 30 minutes.">
        <LinkIcon className="h-10 w-10 text-muted" aria-hidden="true" />
        <Link to="/forgot-password" className="mt-6 flex h-12 items-center justify-center rounded-2xl bg-brand font-semibold text-white">
          Send a new link
        </Link>
      </AuthShell>);

  }

  if (state === 'done') {
    return (
      <AuthShell title="Password updated">
        <div role="status">
          <CircleCheckIcon className="h-12 w-12 text-brand" aria-hidden="true" />
          <p className="mt-3 text-ink-soft">For your safety we’ve signed you out on all other devices.</p>
          <Link to="/signin" className="mt-6 flex h-12 items-center justify-center rounded-2xl bg-brand font-semibold text-white">
            Log in
          </Link>
        </div>
      </AuthShell>);

  }

  return (
    <AuthShell title="Choose a new password">
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (password.length < 8 || !/\d/.test(password) || !/[A-Z]/.test(password)) return setError('Use 8+ characters with a capital letter and a number');
          if (password !== confirm) return setError('The passwords don’t match');
          setError('');
          setState('saving');
          await new Promise((r) => window.setTimeout(r, 800));
          setState('done');
        }}
        className="space-y-4">
        
        <label className="block">
          <span className="text-sm font-medium text-ink">New password</span>
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={authInput} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">Confirm password</span>
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={authInput} />
        </label>
        {error &&
        <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        }
        <button type="submit" disabled={state === 'saving'} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand font-semibold text-white disabled:opacity-60">
          {state === 'saving' && <LoaderCircleIcon className="h-5 w-5 animate-spin" aria-hidden="true" />} Update password
        </button>
      </form>
    </AuthShell>);

}