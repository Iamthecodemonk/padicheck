import React, { useEffect, useState } from 'react';
import { BottomSheet } from '../../BottomSheet';
import { StatusPill } from '../StatusPill';
import { formatWhen } from '../../../utils/checks';
import { primaryButton, secondaryButton } from '../../../utils/formStyles';
import type { AdminRoleDef, TeamMember } from '../../../types/admin';

interface MemberSheetProps {
  member: TeamMember | null;
  roles: AdminRoleDef[];
  isSelf: boolean;
  onClose: () => void;
  onChangeRole: (roleId: string) => void;
  onToggleActive: () => void;
  onResend: () => void;
  onRemove: () => void;
}

export function MemberSheet({ member, roles, isSelf, onClose, onChangeRole, onToggleActive, onResend, onRemove }: MemberSheetProps) {
  const [roleId, setRoleId] = useState('');
  useEffect(() => {
    if (member) setRoleId(member.roleId);
  }, [member]);

  return (
    <BottomSheet
      open={member !== null}
      onClose={onClose}
      title={member?.name ?? ''}
      description={member ? `${member.email}${member.lastActive ? ` · Last active ${formatWhen(member.lastActive)}` : ''}` : undefined}
      footer={
      member &&
      <button type="button" disabled={roleId === member.roleId || isSelf} onClick={() => onChangeRole(roleId)} className={`${primaryButton} w-full`}>
            Save role
          </button>

      }>
      
      {member &&
      <>
          <div className="flex flex-wrap gap-2">
            <StatusPill status={member.status === 'invited' ? 'pending' : member.status === 'deactivated' ? 'suspended' : 'active'} />
            <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ${member.twoFactor ? 'bg-brand-soft text-brand-dark' : 'bg-caution-soft text-caution'}`}>
              {member.twoFactor ? '2FA on' : '2FA not set up'}
            </span>
          </div>
          {isSelf && <p className="mt-3 text-sm text-muted">You can’t change your own role or deactivate yourself.</p>}
          <h3 className="mb-2 mt-5 text-sm font-medium text-muted">Role</h3>
          <div className="space-y-2" role="radiogroup" aria-label="Role">
            {roles.map((r) =>
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={roleId === r.id}
            disabled={isSelf}
            onClick={() => setRoleId(r.id)}
            className={`flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl px-4 py-2 text-left ring-1 transition-colors disabled:opacity-60 ${
            roleId === r.id ? 'bg-brand-soft ring-2 ring-brand' : 'ring-line hover:bg-canvas'}`
            }>
            
                <span className="font-medium text-ink">{r.name}</span>
                <span className="text-sm text-muted">{r.permissions.length} permissions</span>
              </button>
          )}
          </div>
          {!isSelf &&
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {member.status === 'invited' ?
          <button type="button" onClick={onResend} className={secondaryButton}>
                  Resend invite
                </button> :

          <button type="button" onClick={onToggleActive} className={secondaryButton}>
                  {member.status === 'active' ? 'Deactivate access' : 'Reactivate access'}
                </button>
          }
              <button type="button" onClick={onRemove} className={`${secondaryButton} text-danger`}>
                Remove from team
              </button>
            </div>
        }
        </>
      }
    </BottomSheet>);

}