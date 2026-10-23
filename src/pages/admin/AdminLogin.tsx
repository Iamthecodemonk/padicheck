import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRoundIcon, LoaderCircleIcon, ShieldCheckIcon } from 'lucide-react';
import { useAdminSession } from '../../contexts/AdminSessionContext';
import { usePwa } from '../../contexts/PwaContext';

export function AdminLogin() {
  const navigate = useNavigate();
  const { signIn } = useAdminSession();
  const { identity, online } = usePwa();
  const [email, setEmail] = useState('tunde@padicheck.com');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!online) {
      setError('You need a connection to sign in.');
      return;
    }
    if (!email.endsWith('@padicheck.com')) {
      setError('Use your @padicheck.com staff account.');
      return;
    }
    if (password.length < 8) {
      setError('Enter your password (at least 8 characters).');
      return;
    }
    setBusy(true);
    await new Promise((r) => window.setTimeout(r, 800));
    signIn(email);
    navigate('/admin', { replace: true });
  };

  const input =
  'mt-1.5 h-12 w-full rounded-2xl bg-navy-light px-4 text-base text-white outline-none ring-1 ring-navy-line placeholder:text-navy-text/60 focus:ring-2 focus:ring-brand-bright';

  return (
    <main className="flex min-h-[100dvh] w-full flex-col bg-navy px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+40px)] text-white sm:items-center sm:justify-center">
      <div className="w-full sm:max-w-sm">
        <img src={identity.icon} alt="" className="h-14 w-14 rounded-2xl object-cover" />
        <h1 className="mt-6 text-2xl font-bold">PadiCheck Admin</h1>
        <p className="mt-1 text-navy-text">Sign in with your staff account.</p>

        <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
          <label className="block">
            <span className="text-sm font-medium">Work email</span>
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Password</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
          </label>
          {error &&
          <p role="alert" className="text-sm text-[#FFB4AE]">
              {error}
            </p>
          }
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-bright font-semibold text-navy transition-colors hover:bg-white disabled:opacity-70">
            
            {busy && <LoaderCircleIcon className="h-5 w-5 animate-spin" aria-hidden="true" />}
            Sign in
          </button>
          <button type="button" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-semibold text-white ring-1 ring-navy-line transition-colors hover:bg-navy-light">
            <KeyRoundIcon className="h-4 w-4" aria-hidden="true" /> Use company SSO
          </button>
        </form>

        <p className="mt-8 flex gap-2 text-sm text-navy-text">
          <ShieldCheckIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Authorised staff only. Two-factor authentication is required, and sessions end after 12 hours of inactivity.
        </p>
      </div>
    </main>);

}