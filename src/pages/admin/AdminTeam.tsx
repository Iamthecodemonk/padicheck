import React, { useState } from 'react';
import { toast } from 'sonner';
import { ChevronRightIcon, PlusIcon, Trash2Icon, UserPlusIcon } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { LockedNotice } from '../../components/admin/LockedNotice';
import { SegmentedTabs } from '../../components/admin/SegmentedTabs';
import { StatusPill } from '../../components/admin/StatusPill';
import { InviteAdminSheet } from '../../components/admin/team/InviteAdminSheet';
import { MemberSheet } from '../../components/admin/team/MemberSheet';
import { RoleEditorSheet } from '../../components/admin/team/RoleEditorSheet';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { useAdminData } from '../../contexts/AdminDataContext';
import { useAdminSession } from '../../contexts/AdminSessionContext';
import { usePwa } from '../../contexts/PwaContext';
import { formatWhen, makeId } from '../../utils/checks';
import { primaryButton } from '../../utils/formStyles';
import type { AdminRoleDef } from '../../types/admin';

type Tab = 'admins' | 'roles';

export function AdminTeam() {
  const { team, roles, saveMember, removeMember, saveRole, removeRole } = useAdminData();
  const { session, permissions, log } = useAdminSession();
  const { online } = usePwa();
  const [tab, setTab] = useState<Tab>('admins');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<AdminRoleDef | null | 'new'>(null);
  const [deletingRole, setDeletingRole] = useState<AdminRoleDef | null>(null);

  const canManage = permissions.manageAdmins && online;
  const member = team.find((m) => m.id === memberId) ?? null;
  const removing = team.find((m) => m.id === removingId) ?? null;
  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? 'Unknown role';
  const membersWith = (id: string) => team.filter((m) => m.roleId === id).length;
  const initials = (n: string) => n.split(' ').map((p) => p[0]).join('').slice(0, 2);

  return (
    <>
      <AdminPageHeader
        title="Team & Roles"
        subtitle={`${team.filter((m) => m.status !== 'deactivated').length} admins · ${roles.length} roles`}
        actions={
        canManage &&
        <button type="button" onClick={() => tab === 'admins' ? setInviteOpen(true) : setEditingRole('new')} className={`${primaryButton} h-11 px-4`}>
              {tab === 'admins' ? <UserPlusIcon className="h-4 w-4" aria-hidden="true" /> : <PlusIcon className="h-4 w-4" aria-hidden="true" />}
              <span className="hidden sm:inline">{tab === 'admins' ? 'Invite admin' : 'New role'}</span>
            </button>

        } />
      
      <div className="px-4 md:px-8">
        {!permissions.manageAdmins && <LockedNotice text="View only — managing admins and roles needs the “Manage admins & roles” permission." />}
        <SegmentedTabs
          label="Team sections"
          value={tab}
          onChange={setTab}
          tabs={[
          { id: 'admins', label: 'Admins', count: team.length },
          { id: 'roles', label: 'Roles', count: roles.length }]
          } />
        

        {tab === 'admins' ?
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-3xl bg-surface">
            {team.map((m) =>
          <li key={m.id}>
                <button
              type="button"
              disabled={!canManage}
              onClick={() => setMemberId(m.id)}
              className="flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas/70 disabled:hover:bg-transparent md:px-5">
              
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold ${m.status === 'deactivated' ? 'bg-canvas text-muted' : 'bg-brand-soft text-brand-dark'}`}>
                    {initials(m.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">
                      {m.name}
                      {m.email === session?.email && <span className="font-normal text-muted"> · You</span>}
                    </span>
                    <span className="block truncate text-sm text-muted">
                      {roleName(m.roleId)} · {m.status === 'invited' ? 'Invite sent' : m.lastActive ? `Active ${formatWhen(m.lastActive)}` : m.email}
                    </span>
                  </span>
                  <span className="hidden text-sm text-muted md:block">{m.email}</span>
                  {m.status !== 'active' && <StatusPill status={m.status === 'invited' ? 'pending' : 'suspended'} />}
                  {canManage && <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />}
                </button>
              </li>
          )}
          </ul> :

        <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {roles.map((r) =>
          <li key={r.id} className="flex flex-col rounded-3xl bg-surface p-5">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-ink">{r.name}</h2>
                    <p className="text-sm text-muted">{r.description}</p>
                  </div>
                  {r.builtIn && <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-muted">Built-in</span>}
                </div>
                <p className="mt-4 text-sm text-ink-soft">
                  <strong className="text-2xl font-bold text-ink">{r.permissions.length}</strong> permissions · {membersWith(r.id)} admin{membersWith(r.id) === 1 ? '' : 's'}
                </p>
                <div className="mt-auto flex gap-2 pt-4">
                  <button
                type="button"
                onClick={() => setEditingRole(r)}
                className="h-11 flex-1 rounded-xl text-sm font-semibold text-ink ring-1 ring-line transition-colors hover:bg-canvas">
                
                    {canManage && r.id !== 'superAdmin' ? 'Edit permissions' : 'View permissions'}
                  </button>
                  {canManage && !r.builtIn &&
              <button
                type="button"
                aria-label={`Delete ${r.name}`}
                onClick={() => setDeletingRole(r)}
                className="grid h-11 w-11 place-items-center rounded-xl text-danger ring-1 ring-line transition-colors hover:bg-danger-soft">
                
                      <Trash2Icon className="h-4 w-4" />
                    </button>
              }
                </div>
              </li>
          )}
          </ul>
        }
      </div>

      <InviteAdminSheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        roles={roles}
        existingEmails={team.map((m) => m.email)}
        onInvite={({ name, email, roleId }) => {
          saveMember({ id: makeId('a'), name, email, roleId, status: 'invited', twoFactor: false });
          log('team', `Invited ${name} as ${roleName(roleId)}`, email);
          setInviteOpen(false);
          toast.success(`Invite sent to ${email}`);
        }} />
      
      <MemberSheet
        member={member}
        roles={roles}
        isSelf={member?.email === session?.email}
        onClose={() => setMemberId(null)}
        onChangeRole={(roleId) => {
          if (!member) return;
          saveMember({ ...member, roleId });
          log('team', `Changed ${member.name}’s role`, `${roleName(member.roleId)} → ${roleName(roleId)}`);
          setMemberId(null);
          toast.success(`${member.name} is now ${roleName(roleId)}`);
        }}
        onToggleActive={() => {
          if (!member) return;
          const next = member.status === 'active' ? 'deactivated' : 'active';
          saveMember({ ...member, status: next });
          log('team', `${next === 'active' ? 'Reactivated' : 'Deactivated'} ${member.name}`);
          setMemberId(null);
          toast.success(next === 'active' ? 'Access restored' : 'Access removed — all their sessions were ended');
        }}
        onResend={() => {
          if (!member) return;
          log('team', `Resent invite to ${member.name}`);
          toast.success(`Invite resent to ${member.email}`);
        }}
        onRemove={() => {
          setRemovingId(memberId);
          setMemberId(null);
        }} />
      
      <ConfirmSheet
        open={removing !== null}
        onClose={() => setRemovingId(null)}
        onConfirm={() => {
          if (!removing) return;
          removeMember(removing.id);
          log('team', `Removed ${removing.name} from the team`);
          setRemovingId(null);
          toast.success(`${removing.name} removed`);
        }}
        title={removing ? `Remove ${removing.name}?` : ''}
        description="They’ll lose access immediately. Their past actions stay in the audit log."
        confirmLabel="Remove"
        tone="danger" />
      
      <RoleEditorSheet
        open={editingRole !== null}
        onClose={() => setEditingRole(null)}
        role={editingRole === 'new' ? null : editingRole}
        existingNames={roles.map((r) => r.name.toLowerCase())}
        onSave={(role) => {
          const isNew = !roles.some((r) => r.id === role.id);
          if (!canManage) return;
          saveRole(role);
          log('team', `${isNew ? 'Created' : 'Updated'} role “${role.name}”`, `${role.permissions.length} permissions`);
          setEditingRole(null);
          toast.success(isNew ? 'Role created' : 'Role updated');
        }} />
      
      <ConfirmSheet
        open={deletingRole !== null}
        onClose={() => setDeletingRole(null)}
        onConfirm={() => {
          if (!deletingRole) return;
          if (membersWith(deletingRole.id) > 0) {
            toast.error('Move admins to another role first', { description: `${membersWith(deletingRole.id)} admin(s) still have this role.` });
            setDeletingRole(null);
            return;
          }
          removeRole(deletingRole.id);
          log('team', `Deleted role “${deletingRole.name}”`);
          setDeletingRole(null);
          toast.success('Role deleted');
        }}
        title={deletingRole ? `Delete ${deletingRole.name}?` : ''}
        description="This can’t be undone. Roles with admins assigned can’t be deleted."
        confirmLabel="Delete role"
        tone="danger" />
      
    </>);

}