import React, { useEffect, useState } from 'react';
import { BottomSheet } from '../../BottomSheet';
import { Field } from '../Field';
import { inputClass, primaryButton } from '../../../utils/formStyles';
import type { AdminRoleDef } from '../../../types/admin';

interface InviteAdminSheetProps {
  open: boolean;
  onClose: () => void;
  roles: AdminRoleDef[];
  existingEmails: string[];
  onInvite: (data: {name: string;email: string;roleId: string;}) => void;
}

export function InviteAdminSheet({ open, onClose, roles, existingEmails, onInvite }: InviteAdminSheetProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('support');
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setEmail('');
      setRoleId('support');
      setTried(false);
    }
  }, [open]);

  const cleanEmail = email.trim().toLowerCase();
  const emailError = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ?
  'Enter a valid email address' :
  existingEmails.includes(cleanEmail) ?
  'This person is already on the team' :
  '';
  const nameError = name.trim().length < 2 ? 'Enter their full name' : '';

  const submit = () => {
    setTried(true);
    if (emailError || nameError) return;
    onInvite({ name: name.trim(), email: cleanEmail, roleId });
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Invite an admin"
      description="They’ll get an email to set a password and turn on two-factor authentication."
      footer={
      <button type="button" onClick={submit} className={`${primaryButton} w-full`}>
          Send invite
        </button>
      }>
      
      <div className="space-y-4">
        <Field label="Full name" error={tried ? nameError : undefined}>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" className={inputClass} placeholder="e.g. Bola Adeyemi" />
        </Field>
        <Field label="Work email" error={tried ? emailError : undefined}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" className={inputClass} placeholder="name@padicheck.com" />
        </Field>
        <fieldset>
          <legend className="text-sm font-medium text-ink">Role</legend>
          <div className="mt-2 space-y-2" role="radiogroup">
            {roles.map((r) =>
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={roleId === r.id}
              onClick={() => setRoleId(r.id)}
              className={`flex w-full items-center gap-3 rounded-2xl p-3.5 text-left ring-1 transition-colors ${
              roleId === r.id ? 'bg-brand-soft ring-2 ring-brand' : 'bg-surface ring-line hover:bg-canvas'}`
              }>
              
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{r.name}</span>
                  <span className="block text-sm text-muted">
                    {r.description} · {r.permissions.length} permissions
                  </span>
                </span>
              </button>
            )}
          </div>
        </fieldset>
      </div>
    </BottomSheet>);

}