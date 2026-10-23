import React, { useState } from 'react';
import { toast } from 'sonner';
import { DownloadIcon, KeyRoundIcon, LaptopIcon, LoaderCircleIcon, ShieldCheckIcon, SmartphoneIcon } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { Switch } from '../../components/Switch';
import { Field } from '../../components/admin/Field';
import { OtpInput } from '../../components/auth/OtpInput';
import { PageHeader } from '../../components/consumer/PageHeader';
import { QrCode } from '../../components/trust/QrCode';
import { useTrust } from '../../contexts/TrustContext';
import { useUser } from '../../contexts/UserContext';
import { usePersistentState } from '../../hooks/usePersistentState';
import { formatWhen } from '../../utils/checks';
import { inputClass, primaryButton } from '../../utils/formStyles';

interface DeviceSession {
  id: string;
  device: string;
  place: string;
  lastSeen: string;
  current?: boolean;
}

const initialSessions: DeviceSession[] = [
{ id: 's1', device: 'PadiCheck app · iPhone 15', place: 'Lagos, NG', lastSeen: new Date().toISOString(), current: true },
{ id: 's2', device: 'Chrome · Windows', place: 'Lagos, NG', lastSeen: '2026-10-02T21:14:00' },
{ id: 's3', device: 'Safari · MacBook', place: 'Abuja, NG', lastSeen: '2026-09-20T09:00:00' }];


const backupCodes = ['K7QD-2M9X', 'P4LT-8WRB', 'Z2HN-6CJE', 'M9VA-3TYK', 'R5FG-1XQP', 'W8BS-4NDL'];

export function Security() {
  const { session } = useUser();
  const { savedEntityIds, reports, invoices } = useTrust();
  const [twoFactor, setTwoFactor] = usePersistentState('pc-sec-2fa', false);
  const [loginAlerts, setLoginAlerts] = usePersistentState('pc-sec-alerts', true);
  const [privacy, setPrivacy] = usePersistentState('pc-sec-privacy', { shareAnonStats: true, showNameOnReviews: true, personalisedTips: false });
  const [sessions, setSessions] = usePersistentState<DeviceSession[]>('pc-sec-sessions', initialSessions);
  const [sheet, setSheet] = useState<null | 'password' | '2fa' | 'disable2fa'>(null);
  const [step, setStep] = useState<'scan' | 'codes'>('scan');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [busy, setBusy] = useState(false);

  const changePassword = async () => {
    if (pw.current.length < 8) return setPwError('Enter your current password');
    if (pw.next.length < 8 || !/\d/.test(pw.next) || !/[A-Z]/.test(pw.next)) return setPwError('New password needs 8+ characters, a capital letter and a number');
    if (pw.next !== pw.confirm) return setPwError('The new passwords don’t match');
    if (pw.next === pw.current) return setPwError('Choose a password you haven’t used before');
    setPwError('');
    setBusy(true);
    await new Promise((r) => window.setTimeout(r, 800));
    setBusy(false);
    setSessions((l) => l.filter((s) => s.current));
    setSheet(null);
    setPw({ current: '', next: '', confirm: '' });
    toast.success('Password changed', { description: 'Other devices have been signed out.' });
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ account: session, savedChecks: savedEntityIds, reports: reports.filter((r) => r.reporter === session?.name), invoices, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'padicheck-my-data.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Your data export has downloaded');
  };

  const row = 'flex min-h-[64px] items-center gap-3 px-5 py-3';

  return (
    <>
      <PageHeader title="Security & privacy" back="/account" />
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-10 lg:px-10">
        <section aria-labelledby="signin-heading">
          <h2 id="signin-heading" className="mb-2 text-sm font-medium text-muted">
            Sign-in
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface">
            <li className={row}>
              <KeyRoundIcon className="h-5 w-5 text-muted" aria-hidden="true" />
              <span className="flex-1 font-medium text-ink">Password</span>
              <button type="button" onClick={() => setSheet('password')} className="h-11 rounded-xl px-3 text-sm font-semibold text-brand-dark hover:bg-canvas">
                Change
              </button>
            </li>
            <li className={row}>
              <ShieldCheckIcon className="h-5 w-5 text-muted" aria-hidden="true" />
              <span className="flex-1">
                <span className="block font-medium text-ink">Two-factor authentication</span>
                <span className="block text-sm text-muted">{twoFactor ? 'On · authenticator app' : 'Add a second step when you sign in'}</span>
              </span>
              <Switch
                checked={twoFactor}
                onChange={(on) => {
                  if (on) {
                    setStep('scan');
                    setCode('');
                    setSheet('2fa');
                  } else setSheet('disable2fa');
                }}
                label="Two-factor authentication" />
              
            </li>
            <li className={row}>
              <span className="flex-1">
                <span className="block font-medium text-ink">Login alerts</span>
                <span className="block text-sm text-muted">Email and push when a new device signs in</span>
              </span>
              <Switch checked={loginAlerts} onChange={setLoginAlerts} label="Login alerts" />
            </li>
          </ul>
        </section>

        <section aria-labelledby="sessions-heading">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="sessions-heading" className="text-sm font-medium text-muted">
              Where you’re signed in
            </h2>
            {sessions.length > 1 &&
            <button
              type="button"
              onClick={() => {
                setSessions((l) => l.filter((s) => s.current));
                toast.success('Signed out of all other devices');
              }}
              className="h-11 rounded-xl px-2 text-sm font-semibold text-danger">
              
                Sign out others
              </button>
            }
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface">
            {sessions.map((s) =>
            <li key={s.id} className={row}>
                {s.device.includes('app') ? <SmartphoneIcon className="h-5 w-5 text-muted" aria-hidden="true" /> : <LaptopIcon className="h-5 w-5 text-muted" aria-hidden="true" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{s.device}</span>
                  <span className="block text-sm text-muted">
                    {s.place} · {s.current ? 'This device' : formatWhen(s.lastSeen)}
                  </span>
                </span>
                {!s.current &&
              <button
                type="button"
                onClick={() => {
                  setSessions((l) => l.filter((x) => x.id !== s.id));
                  toast(`Signed out of ${s.device}`);
                }}
                className="h-11 rounded-xl px-3 text-sm font-semibold text-danger hover:bg-danger-soft">
                
                    Sign out
                  </button>
              }
              </li>
            )}
          </ul>
        </section>

        <section aria-labelledby="privacy-heading">
          <h2 id="privacy-heading" className="mb-2 text-sm font-medium text-muted">
            Privacy
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface">
            {(
            [
            ['shareAnonStats', 'Help improve scam detection', 'Share anonymous check patterns. Never your identity.'],
            ['showNameOnReviews', 'Show my first name on reviews', 'Otherwise reviews show as “PadiCheck user”.'],
            ['personalisedTips', 'Personalised safety tips', 'Based on the kinds of checks you run.']] as
            const).
            map(([k, label, hint]) =>
            <li key={k} className={row}>
                <span className="flex-1">
                  <span className="block font-medium text-ink">{label}</span>
                  <span className="block text-sm text-muted">{hint}</span>
                </span>
                <Switch checked={privacy[k]} onChange={(on) => setPrivacy((p) => ({ ...p, [k]: on }))} label={label} />
              </li>
            )}
            <li className={row}>
              <DownloadIcon className="h-5 w-5 text-muted" aria-hidden="true" />
              <span className="flex-1">
                <span className="block font-medium text-ink">Download my data</span>
                <span className="block text-sm text-muted">Your account, saved checks, reports and invoices</span>
              </span>
              <button type="button" onClick={exportData} className="h-11 rounded-xl px-3 text-sm font-semibold text-brand-dark hover:bg-canvas">
                Export
              </button>
            </li>
          </ul>
        </section>

        <section aria-labelledby="connected-heading">
          <h2 id="connected-heading" className="mb-2 text-sm font-medium text-muted">
            Connected accounts
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface">
            {(['google', 'apple'] as const).map((p) => {
              const linked = session?.provider === p;
              return (
                <li key={p} className={row}>
                  <span className="flex-1 font-medium capitalize text-ink">{p}</span>
                  <span className={`text-sm ${linked ? 'font-semibold text-brand-dark' : 'text-muted'}`}>{linked ? 'Connected' : 'Not connected'}</span>
                  <button type="button" onClick={() => toast(linked ? `${p} stays connected — it’s how you sign in` : `Connecting ${p}…`)} className="h-11 rounded-xl px-3 text-sm font-semibold text-ink ring-1 ring-line hover:bg-canvas">
                    {linked ? 'Manage' : 'Connect'}
                  </button>
                </li>);

            })}
          </ul>
        </section>
      </div>

      <BottomSheet
        open={sheet === 'password'}
        onClose={() => setSheet(null)}
        title="Change password"
        footer={
        <button type="button" onClick={changePassword} disabled={busy} className={`${primaryButton} w-full`}>
            {busy && <LoaderCircleIcon className="h-5 w-5 animate-spin" aria-hidden="true" />} Update password
          </button>
        }>
        
        <div className="space-y-4">
          {(['current', 'next', 'confirm'] as const).map((k) =>
          <Field key={k} label={k === 'current' ? 'Current password' : k === 'next' ? 'New password' : 'Confirm new password'}>
              <input type="password" autoComplete={k === 'current' ? 'current-password' : 'new-password'} value={pw[k]} onChange={(e) => setPw((p) => ({ ...p, [k]: e.target.value }))} className={inputClass} />
            </Field>
          )}
          {pwError &&
          <p role="alert" className="text-sm text-danger">
              {pwError}
            </p>
          }
        </div>
      </BottomSheet>

      <BottomSheet
        open={sheet === '2fa'}
        onClose={() => setSheet(null)}
        title={step === 'scan' ? 'Set up two-factor authentication' : 'Save your backup codes'}
        description={step === 'scan' ? 'Scan with Google Authenticator, Authy or 1Password, then enter the 6-digit code.' : 'Each code works once if you lose your phone. Store them somewhere safe.'}
        footer={
        step === 'scan' ?
        <button
          type="button"
          onClick={() => {
            if (code !== '123456') return setCodeError('That code isn’t right. Demo code: 123456');
            setCodeError('');
            setStep('codes');
          }}
          className={`${primaryButton} w-full`}>
          
              Verify code
            </button> :

        <button
          type="button"
          onClick={() => {
            setTwoFactor(true);
            setSheet(null);
            toast.success('Two-factor authentication is on');
          }}
          className={`${primaryButton} w-full`}>
          
              I’ve saved them
            </button>

        }>
        
        {step === 'scan' ?
        <div className="space-y-4 text-center">
            <QrCode value={`otpauth://totp/PadiCheck:${session?.email}?secret=JBSWY3DPEHPK3PXP&issuer=PadiCheck`} size={168} label="Authenticator setup QR code" />
            <p className="font-mono text-sm text-muted">JBSW Y3DP EHPK 3PXP</p>
            <OtpInput value={code} onChange={setCode} invalid={Boolean(codeError)} />
            {codeError &&
          <p role="alert" className="text-sm text-danger">
                {codeError}
              </p>
          }
          </div> :

        <ul className="grid grid-cols-2 gap-2 font-mono">
            {backupCodes.map((c) =>
          <li key={c} className="rounded-xl bg-canvas p-3 text-center text-ink">
                {c}
              </li>
          )}
          </ul>
        }
      </BottomSheet>

      <ConfirmSheet
        open={sheet === 'disable2fa'}
        onClose={() => setSheet(null)}
        onConfirm={() => {
          setTwoFactor(false);
          setSheet(null);
          toast('Two-factor authentication turned off');
        }}
        title="Turn off two-factor authentication?"
        description="Your account will only be protected by your password."
        confirmLabel="Turn off"
        tone="danger" />
      
    </>);

}