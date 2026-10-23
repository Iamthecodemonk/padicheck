import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LoaderCircleIcon } from 'lucide-react';
import { track } from '../../utils/analytics';
import { Logo } from '../../components/Logo';
import { useUser } from '../../contexts/UserContext';
import type { ConsumerSession } from '../../types/check';

type Method = 'password' | 'otp';

export function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useUser();
  const [method, setMethod] = useState<Method>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const from = (location.state as {from?: string;} | null)?.from ?? '/';

  const complete = async (provider: ConsumerSession['provider'], key: string) => {
    setBusy(key);
    await new Promise((r) => window.setTimeout(r, 800));
    const address = email || (provider === 'apple' ? 'you@icloud.com' : 'adaeze.okafor@gmail.com');
    signIn({ name: provider === 'email' || provider === 'otp' ? address.split('@')[0] : 'Adaeze Okafor', email: address, provider });
    track('login', { method: provider });
    navigate(from, { replace: true });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Enter a valid email address');
      return;
    }
    if (method === 'password') {
      if (password.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }
      await complete('email', 'form');
      return;
    }
    if (!codeSent) {
      setBusy('form');
      await new Promise((r) => window.setTimeout(r, 700));
      setBusy(null);
      setCodeSent(true);
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code we sent you');
      return;
    }
    await complete('otp', 'form');
  };

  const input = 'mt-1.5 h-12 w-full rounded-2xl bg-surface px-4 text-base text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-ink';
  const social = 'inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-surface font-semibold text-ink ring-1 ring-line transition-colors hover:bg-canvas disabled:opacity-60';

  return (
    <div className="flex min-h-[100dvh] w-full bg-canvas">
      <aside className="hidden w-[44%] flex-col justify-between bg-ink p-12 text-canvas lg:flex">
        <p className="text-sm font-medium opacity-70">PadiCheck</p>
        <div>
          <p className="text-4xl font-bold leading-tight">Check before you trust.</p>
          <p className="mt-4 max-w-sm text-lg opacity-70">Verify people, businesses, websites and opportunities before you buy, pay or engage.</p>
        </div>
        <p className="text-sm opacity-70">Available on Android, iPhone, tablets and desktop.</p>
      </aside>
      <main className="flex flex-1 flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+28px)] sm:items-center sm:justify-center">
        <div className="w-full sm:max-w-sm">
          <Logo height={32} />
          <h1 className="mt-8 text-2xl font-bold text-ink">Sign in</h1>
          <p className="mt-1 text-muted">You’ll stay signed in on this device until you log out.</p>

          <div className="mt-6 space-y-2.5">
            <button type="button" disabled={busy !== null} onClick={() => complete('google', 'google')} className={social}>
              {busy === 'google' ? <LoaderCircleIcon className="h-5 w-5 animate-spin" aria-hidden="true" /> : <span className="text-lg font-bold text-[#4285F4]" aria-hidden="true">G</span>}
              Continue with Google
            </button>
            <button type="button" disabled={busy !== null} onClick={() => complete('apple', 'apple')} className={`${social} bg-ink text-white ring-ink hover:bg-ink-soft`}>
              {busy === 'apple' ? <LoaderCircleIcon className="h-5 w-5 animate-spin" aria-hidden="true" /> : <span className="text-lg" aria-hidden="true"></span>}
              Continue with Apple
            </button>
          </div>

          <div className="my-6 flex items-center gap-3 text-sm text-muted">
            <span className="h-px flex-1 bg-line" /> or use email <span className="h-px flex-1 bg-line" />
          </div>

          <div role="tablist" aria-label="Sign-in method" className="grid grid-cols-2 gap-1 rounded-2xl bg-line/60 p-1">
            {(['password', 'otp'] as const).map((m) =>
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={method === m}
              onClick={() => {
                setMethod(m);
                setError('');
              }}
              className={`h-11 rounded-xl text-sm font-semibold transition-colors ${method === m ? 'bg-surface text-ink shadow-card' : 'text-muted'}`}>
              
                {m === 'password' ? 'Password' : 'Email code'}
              </button>
            )}
          </div>

          <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
            <label className="block">
              <span className="text-sm font-medium text-ink">Email</span>
              <input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
            </label>
            {method === 'password' ?
            <label className="block">
                <span className="text-sm font-medium text-ink">Password</span>
                <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
                <Link to="/forgot-password" className="mt-1.5 inline-flex min-h-[40px] items-center text-sm font-semibold text-brand-dark">
                  Forgot password?
                </Link>
              </label> :

            codeSent &&
            <label className="block">
                  <span className="text-sm font-medium text-ink">6-digit code</span>
                  <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className={`${input} tracking-[0.4em]`} />
              
                  <span className="mt-1.5 block text-sm text-muted">Sent to {email}</span>
                </label>

            }
            {error &&
            <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            }
            <button type="submit" disabled={busy !== null} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-70">
              {busy === 'form' && <LoaderCircleIcon className="h-5 w-5 animate-spin" aria-hidden="true" />}
              {method === 'otp' && !codeSent ? 'Send code' : 'Sign in'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-muted">
            New to PadiCheck?{' '}
            <Link to="/signup" className="font-semibold text-brand-dark">
              Create an account
            </Link>
          </p>
          <p className="mt-2 text-center text-sm">
            <Link to="/welcome" className="font-semibold text-muted hover:text-ink">
              Learn about PadiCheck
            </Link>
          </p>
        </div>
      </main>
    </div>);

}