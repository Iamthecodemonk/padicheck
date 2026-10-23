import React, { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { Field } from '../../components/admin/Field';
import { LockedNotice } from '../../components/admin/LockedNotice';
import { Switch } from '../../components/Switch';
import { useAdminData } from '../../contexts/AdminDataContext';
import { useAdminSession } from '../../contexts/AdminSessionContext';
import { usePwa } from '../../contexts/PwaContext';
import { inputClass, primaryButton, secondaryButton, textareaClass } from '../../utils/formStyles';
import type { AdminSettings as Settings } from '../../types/admin';

const labels: Record<keyof Settings, string> = {
  workspaceName: 'Workspace name',
  supportEmail: 'Support email',
  allowSignups: 'New sign-ups',
  signupBonus: 'Welcome credits',
  lowCreditThreshold: 'Low-credit alert',
  maintenanceMode: 'Maintenance mode',
  maintenanceMessage: 'Maintenance message',
  require2fa: 'Require 2FA',
  sessionHours: 'Admin session length',
  ipAllowlist: 'IP allow-list',
  fileRetentionDays: 'File retention'
};

function Section({ title, description, children }: {title: string;description: string;children: ReactNode;}) {
  return (
    <section className="grid gap-4 rounded-3xl bg-surface p-5 md:p-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
      <div>
        <h2 className="font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>);

}

function ToggleRow({ label, hint, checked, onChange, disabled }: {label: string;hint: string;checked: boolean;onChange: (v: boolean) => void;disabled: boolean;}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex-1">
        <span className="block font-medium text-ink">{label}</span>
        <span className="block text-sm text-muted">{hint}</span>
      </span>
      <Switch checked={checked} onChange={onChange} disabled={disabled} label={label} />
    </div>);

}

export function AdminSettings() {
  const { settings, saveSettings } = useAdminData();
  const { permissions, log } = useAdminSession();
  const { online } = usePwa();
  const [form, setForm] = useState(settings);
  const canEdit = permissions.manageSettings && online;

  useEffect(() => setForm(settings), [settings]);

  const set = <K extends keyof Settings,>(key: K, value: Settings[K]) => setForm((f) => ({ ...f, [key]: value }));
  const changed = (Object.keys(form) as (keyof Settings)[]).filter((k) => form[k] !== settings[k]);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.supportEmail);
  const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Number(v.replace(/\D/g, '')) || 0));

  const save = () => {
    if (!emailOk) return toast.error('Enter a valid support email');
    saveSettings(form);
    log('settings', `Updated ${changed.map((k) => labels[k]).join(', ')}`);
    toast.success('Settings saved');
  };

  return (
    <>
      <AdminPageHeader title="Settings" subtitle="Workspace, sign-ups, maintenance and security." />
      <div className="space-y-4 px-4 pb-28 md:px-8 lg:pb-6">
        {!permissions.manageSettings && <LockedNotice text="View only — changing settings needs the “Change settings” permission." />}
        <Section title="Workspace" description="How PadiCheck identifies itself to users.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Workspace name">
              <input value={form.workspaceName} disabled={!canEdit} onChange={(e) => set('workspaceName', e.target.value)} className={inputClass} />
            </Field>
            <Field label="Support email" error={emailOk ? undefined : 'Enter a valid email'}>
              <input type="email" value={form.supportEmail} disabled={!canEdit} onChange={(e) => set('supportEmail', e.target.value)} className={inputClass} />
            </Field>
          </div>
        </Section>

        <Section title="Accounts & credits" description="Sign-up rules and credit alerts.">
          <ToggleRow label="Allow new sign-ups" hint="Turn off to pause new accounts" checked={form.allowSignups} onChange={(v) => set('allowSignups', v)} disabled={!canEdit} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Welcome credits" hint="Given to every new account">
              <input inputMode="numeric" value={form.signupBonus} disabled={!canEdit} onChange={(e) => set('signupBonus', num(e.target.value, 0, 100))} className={inputClass} />
            </Field>
            <Field label="Low-credit alert at" hint="Users are notified once below this">
              <input inputMode="numeric" value={form.lowCreditThreshold} disabled={!canEdit} onChange={(e) => set('lowCreditThreshold', num(e.target.value, 0, 100))} className={inputClass} />
            </Field>
          </div>
        </Section>

        <Section title="Maintenance" description="Temporarily stop new checks while keeping saved reports available.">
          <ToggleRow label="Maintenance mode" hint="New checks are paused for everyone" checked={form.maintenanceMode} onChange={(v) => set('maintenanceMode', v)} disabled={!canEdit} />
          {form.maintenanceMode &&
          <Field label="Message shown to users">
              <textarea rows={2} value={form.maintenanceMessage} disabled={!canEdit} onChange={(e) => set('maintenanceMessage', e.target.value)} className={textareaClass} />
            </Field>
          }
        </Section>

        <Section title="Security" description="Applies to every admin account.">
          <ToggleRow label="Require two-factor authentication" hint="Admins without 2FA can’t sign in" checked={form.require2fa} onChange={(v) => set('require2fa', v)} disabled={!canEdit} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="End idle admin sessions after (hours)">
              <input inputMode="numeric" value={form.sessionHours} disabled={!canEdit} onChange={(e) => set('sessionHours', num(e.target.value, 1, 72))} className={inputClass} />
            </Field>
            <Field label="Delete uploaded files after (days)" hint="Saved reports keep their files">
              <input inputMode="numeric" value={form.fileRetentionDays} disabled={!canEdit} onChange={(e) => set('fileRetentionDays', num(e.target.value, 1, 365))} className={inputClass} />
            </Field>
          </div>
          <Field label="IP allow-list" hint="One address or range per line. Leave empty to allow any network.">
            <textarea rows={3} value={form.ipAllowlist} disabled={!canEdit} onChange={(e) => set('ipAllowlist', e.target.value)} placeholder="102.89.0.0/16" className={`${textareaClass} font-mono text-[15px]`} />
          </Field>
        </Section>
      </div>

      {canEdit && changed.length > 0 &&
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+62px)] z-30 border-t border-line bg-surface/95 p-3 backdrop-blur-md md:bottom-0 md:left-auto md:right-6 md:mb-6 md:rounded-2xl md:border md:shadow-float">
          <div className="flex items-center gap-2">
            <p className="flex-1 px-2 text-sm text-ink-soft">
              {changed.length} unsaved change{changed.length > 1 ? 's' : ''}
            </p>
            <button type="button" onClick={() => setForm(settings)} className={`${secondaryButton} h-11`}>
              Discard
            </button>
            <button type="button" onClick={save} className={`${primaryButton} h-11`}>
              Save changes
            </button>
          </div>
        </div>
      }
    </>);

}