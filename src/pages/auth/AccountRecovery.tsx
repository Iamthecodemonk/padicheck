import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell, authInput } from '../../components/auth/AuthShell';
import { chipClass } from '../../utils/formStyles';

/** For people who can't get into their email: recover by phone, backup code, or a support-verified request. */
export function AccountRecovery() {
  const navigate = useNavigate();
  const [method, setMethod] = useState<'phone' | 'backup' | 'support'>('phone');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const next = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (method === 'phone') {
      if (value.replace(/\D/g, '').length < 10) return setError('Enter the phone number on your account');
      navigate(`/verify-code?channel=recovery&to=${encodeURIComponent(value)}`);
    } else if (method === 'backup') {
      if (!/^[A-Z0-9]{4}-?[A-Z0-9]{4}$/i.test(value.trim())) return setError('Backup codes look like ABCD-1234');
      navigate('/reset-password?token=demo-valid');
    } else {
      if (!/^\S+@\S+\.\S+$/.test(value)) return setError('Enter an email we can reach you on');
      setSent(true);
    }
  };

  return (
    <AuthShell title="Recover your account" subtitle="Choose how you’d like to prove it’s you.">
      {sent ?
      <p role="status" className="rounded-2xl bg-brand-soft p-4 text-brand-dark">
          Request received. Our team will verify your identity and reply to {value} within one working day.
        </p> :

      <form onSubmit={next} noValidate className="space-y-4">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Recovery method">
            {(
          [
          ['phone', 'Recovery phone'],
          ['backup', 'Backup code'],
          ['support', 'Contact support']] as
          const).
          map(([id, label]) =>
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={method === id}
            onClick={() => {
              setMethod(id);
              setValue('');
              setError('');
            }}
            className={chipClass(method === id)}>
            
                {label}
              </button>
          )}
          </div>
          <label className="block">
            <span className="text-sm font-medium text-ink">{method === 'phone' ? 'Phone number' : method === 'backup' ? 'Backup code' : 'Contact email'}</span>
            <input value={value} onChange={(e) => setValue(e.target.value)} inputMode={method === 'phone' ? 'tel' : 'text'} aria-invalid={Boolean(error)} className={authInput} />
          </label>
          {error &&
        <p role="alert" className="text-sm text-danger">
              {error}
            </p>
        }
          <button type="submit" className="h-12 w-full rounded-2xl bg-brand font-semibold text-white">
            Continue
          </button>
        </form>
      }
      <p className="mt-6 text-center text-sm">
        <Link to="/signin" className="font-semibold text-brand-dark">
          Back to log in
        </Link>
      </p>
    </AuthShell>);

}