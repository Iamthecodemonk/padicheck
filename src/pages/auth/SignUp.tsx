import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LoaderCircleIcon } from 'lucide-react';
import { AuthShell, authInput } from '../../components/auth/AuthShell';
import { useUser } from '../../contexts/UserContext';
import { track } from '../../utils/analytics';

const strength = (p: string) => [p.length >= 8, /[A-Z]/.test(p), /\d/.test(p), /[^A-Za-z0-9]/.test(p)].filter(Boolean).length;
const strengthLabel = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
const strengthTone = ['bg-danger', 'bg-danger', 'bg-amber', 'bg-teal', 'bg-brand'];

export function SignUp() {
  const navigate = useNavigate();
  const { signIn } = useUser();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');
  const s = strength(password);

  const errors = {
    name: name.trim().split(/\s+/).length < 2 ? 'Enter your first and last name' : '',
    email: !/^\S+@\S+\.\S+$/.test(email) ? 'Enter a valid email address' : '',
    phone: phone && phone.replace(/\D/g, '').length < 10 ? 'Enter a full phone number, or leave it blank' : '',
    password: s < 3 ? 'Use 8+ characters with a capital letter and a number' : '',
    agree: !agree ? 'You need to accept the terms to continue' : ''
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    setServerError('');
    if (Object.values(errors).some(Boolean)) return;
    setBusy(true);
    await new Promise((r) => window.setTimeout(r, 900));
    setBusy(false);
    if (email.toLowerCase() === 'adaeze.okafor@gmail.com') {
      setServerError('An account with this email already exists. Log in instead.');
      return;
    }
    signIn({ name: name.trim(), email: email.trim(), provider: 'email' });
    track('signup', { method: 'email' });
    navigate(`/verify-code?channel=email&to=${encodeURIComponent(email)}`, { replace: true });
  };

  const err = (k: keyof typeof errors) =>
  tried && errors[k] ?
  <span className="mt-1.5 block text-sm text-danger" role="alert">
        {errors[k]}
      </span> :
  null;

  return (
    <AuthShell title="Create your account" subtitle="Free to start. Your first checks are on us.">
      <form onSubmit={submit} noValidate className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-ink">Full name</span>
          <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={tried && Boolean(errors.name)} className={authInput} />
          {err('name')}
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">Email</span>
          <input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={tried && Boolean(errors.email)} className={authInput} />
          {err('email')}
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">
            Phone <span className="font-normal text-muted">(optional, for account recovery)</span>
          </span>
          <input type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={tried && Boolean(errors.phone)} className={authInput} />
          {err('phone')}
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">Password</span>
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={tried && Boolean(errors.password)} aria-describedby="pw-strength" className={authInput} />
          {password &&
          <span id="pw-strength" className="mt-2 flex items-center gap-2">
              <span className="flex flex-1 gap-1" aria-hidden="true">
                {[0, 1, 2, 3].map((i) =>
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i < s ? strengthTone[s] : 'bg-line'}`} />
              )}
              </span>
              <span className="text-xs font-medium text-muted">{strengthLabel[s]}</span>
            </span>
          }
          {err('password')}
        </label>
        <label className="flex gap-3">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[rgb(var(--brand))]" />
          <span className="text-sm text-ink-soft">
            I agree to the{' '}
            <Link to="/legal/terms" className="font-semibold text-brand-dark underline">
              Terms
            </Link>{' '}
            and{' '}
            <Link to="/legal/privacy" className="font-semibold text-brand-dark underline">
              Privacy Policy
            </Link>
          </span>
        </label>
        {err('agree')}
        {serverError &&
        <p role="alert" className="rounded-2xl bg-danger-soft p-3 text-sm text-danger">
            {serverError}
          </p>
        }
        <button type="submit" disabled={busy} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand font-semibold text-white hover:bg-brand-dark disabled:opacity-70">
          {busy && <LoaderCircleIcon className="h-5 w-5 animate-spin" aria-hidden="true" />} Create account
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link to="/signin" className="font-semibold text-brand-dark">
          Log in
        </Link>
      </p>
    </AuthShell>);

}