import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CircleCheckIcon, LoaderCircleIcon, LockIcon } from 'lucide-react';
import { AuthShell } from '../../components/auth/AuthShell';
import { OtpInput } from '../../components/auth/OtpInput';

type Channel = 'email' | 'phone' | '2fa' | 'recovery';

const copy: Record<Channel, {title: string;sub: (to: string) => string;next: string;}> = {
  email: { title: 'Verify your email', sub: (to) => `Enter the 6-digit code we sent to ${to || 'your email'}.`, next: '/verify-code?channel=phone' },
  phone: { title: 'Verify your phone', sub: (to) => `We sent a code by SMS${to ? ` to ${to}` : ''}. This helps you recover your account.`, next: '/' },
  '2fa': { title: 'Two-step verification', sub: () => 'Enter the code from your authenticator app.', next: '/' },
  recovery: { title: 'Recover your account', sub: (to) => `Enter the code we sent to your recovery phone${to ? ` ${to}` : ''}.`, next: '/reset-password?token=demo-valid' }
};

const MAX_ATTEMPTS = 5;

/** Shared OTP screen: email, phone, 2FA and recovery codes. Demo: 123456 is valid, 000000 is expired. */
export function VerifyCode() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const channel = params.get('channel') as Channel ?? 'email';
  const to = params.get('to') ?? '';
  const c = copy[channel] ?? copy.email;
  const [code, setCode] = useState('');
  const [state, setState] = useState<'idle' | 'checking' | 'invalid' | 'expired' | 'blocked' | 'success'>('idle');
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(30);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const verify = async (value = code) => {
    if (value.length !== 6 || state === 'blocked') return;
    setState('checking');
    await new Promise((r) => window.setTimeout(r, 700));
    if (value === '000000') return setState('expired');
    if (value !== '123456') {
      const n = attempts + 1;
      setAttempts(n);
      return setState(n >= MAX_ATTEMPTS ? 'blocked' : 'invalid');
    }
    setState('success');
    window.setTimeout(() => navigate(c.next, { replace: true }), 900);
  };

  if (state === 'success') {
    return (
      <AuthShell title="Verified">
        <CircleCheckIcon className="h-12 w-12 text-brand" aria-hidden="true" role="status" aria-label="Code accepted" />
      </AuthShell>);

  }

  return (
    <AuthShell title={c.title} subtitle={c.sub(to)}>
      <OtpInput
        value={code}
        onChange={(v) => {
          setCode(v);
          if (state === 'invalid' || state === 'expired') setState('idle');
          if (v.length === 6) verify(v);
        }}
        invalid={state === 'invalid' || state === 'expired'}
        disabled={state === 'checking' || state === 'blocked'} />
      
      <div className="mt-3 min-h-[24px]" aria-live="assertive">
        {state === 'checking' &&
        <p className="flex items-center gap-2 text-sm text-muted">
            <LoaderCircleIcon className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking…
          </p>
        }
        {state === 'invalid' && <p className="text-sm text-danger">That code isn’t right. {MAX_ATTEMPTS - attempts} attempts left.</p>}
        {state === 'expired' && <p className="text-sm text-danger">That code has expired. Send a new one.</p>}
        {state === 'blocked' &&
        <p className="flex gap-2 rounded-2xl bg-danger-soft p-3 text-sm text-danger">
            <LockIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> Too many wrong codes. For your security, this is locked for 30 minutes. Contact support if you need help now.
          </p>
        }
      </div>
      <button
        type="button"
        disabled={cooldown > 0 || state === 'blocked'}
        onClick={() => {
          setCooldown(60);
          setCode('');
          setState('idle');
        }}
        className="mt-4 h-12 w-full rounded-2xl font-semibold text-ink ring-1 ring-line hover:bg-surface disabled:opacity-50">
        
        {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
      </button>
      <p className="mt-2 text-center text-xs text-muted">Demo: 123456 works · 000000 is expired</p>
      {channel === 'phone' &&
      <Link to="/" className="mt-4 block text-center text-sm font-semibold text-muted hover:text-ink">
          Skip for now
        </Link>
      }
    </AuthShell>);

}