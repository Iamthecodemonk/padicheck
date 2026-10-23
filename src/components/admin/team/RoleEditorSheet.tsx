import React, { useEffect, useState } from 'react';
import { CheckIcon } from 'lucide-react';
import { BottomSheet } from '../../BottomSheet';
import { Field } from '../Field';
import { permissionCatalog } from '../../../data/adminRoles';
import { inputClass, primaryButton } from '../../../utils/formStyles';
import type { AdminRoleDef, PermissionKey } from '../../../types/admin';

interface RoleEditorSheetProps {
  open: boolean;
  onClose: () => void;
  role: AdminRoleDef | null;
  existingNames: string[];
  onSave: (role: AdminRoleDef) => void;
}

const groups = ['People', 'Trust', 'Money', 'Platform', 'Content', 'Governance'] as const;

export function RoleEditorSheet({ open, onClose, role, existingNames, onSave }: RoleEditorSheetProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [perms, setPerms] = useState<PermissionKey[]>([]);
  const [tried, setTried] = useState(false);
  const locked = role?.id === 'superAdmin';

  useEffect(() => {
    if (!open) return;
    setName(role?.name ?? '');
    setDescription(role?.description ?? '');
    setPerms(role?.permissions ?? ['viewAnalytics']);
    setTried(false);
  }, [open, role]);

  const nameError =
  name.trim().length < 2 ? 'Give the role a name' : existingNames.includes(name.trim().toLowerCase()) && name.trim().toLowerCase() !== role?.name.toLowerCase() ? 'A role with this name already exists' : '';
  const permError = perms.length === 0 ? 'Choose at least one permission' : '';

  const toggle = (key: PermissionKey) => setPerms((p) => p.includes(key) ? p.filter((k) => k !== key) : [...p, key]);

  const save = () => {
    setTried(true);
    if (nameError || permError) return;
    onSave({
      id: role?.id ?? `role-${Date.now().toString(36)}`,
      name: name.trim(),
      description: description.trim() || 'Custom role',
      permissions: perms,
      builtIn: role?.builtIn ?? false
    });
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={role ? `Edit ${role.name}` : 'Create a role'}
      description={locked ? 'Super admins always have every permission.' : 'Changes apply to everyone with this role straight away.'}
      footer={
      !locked &&
      <button type="button" onClick={save} className={`${primaryButton} w-full`}>
            {role ? 'Save role' : 'Create role'} · {perms.length} permission{perms.length === 1 ? '' : 's'}
          </button>

      }>
      
      <div className="space-y-4">
        <Field label="Role name" error={tried ? nameError : undefined}>
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={locked || role?.builtIn} className={inputClass} placeholder="e.g. Fraud analyst" />
        </Field>
        <Field label="Description">
          <input value={description} onChange={(e) => setDescription(e.target.value)} disabled={locked} className={inputClass} placeholder="What this role is for" />
        </Field>
        {tried && permError && <p className="text-sm text-danger">{permError}</p>}
        {groups.map((g) =>
        <fieldset key={g}>
            <legend className="mb-2 text-sm font-medium text-muted">{g}</legend>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl ring-1 ring-line">
              {permissionCatalog.
            filter((p) => p.group === g).
            map((p) => {
              const on = locked || perms.includes(p.key);
              return (
                <li key={p.key}>
                      <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    disabled={locked}
                    onClick={() => toggle(p.key)}
                    className="flex min-h-[60px] w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-canvas disabled:hover:bg-transparent">
                    
                        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${on ? 'bg-brand text-white' : 'ring-2 ring-line'}`}>
                          {on && <CheckIcon className="h-4 w-4" strokeWidth={3} aria-hidden="true" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-ink">{p.label}</span>
                          <span className="block text-sm text-muted">{p.hint}</span>
                        </span>
                      </button>
                    </li>);

            })}
            </ul>
          </fieldset>
        )}
      </div>
    </BottomSheet>);

}