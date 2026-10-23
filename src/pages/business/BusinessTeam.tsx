import React, { useState } from 'react';
import { toast } from 'sonner';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { Field } from '../../components/admin/Field';
import { useTrust } from '../../contexts/TrustContext';
import { useUser } from '../../contexts/UserContext';
import { usePersistentState } from '../../hooks/usePersistentState';
import { businessTeamRoles } from '../../data/businessPortal';
import { planById } from '../../data/plans';
import { chipClass, inputClass, primaryButton } from '../../utils/formStyles';

interface Member {
  id: string;
  name: string;
  email: string;
  role: (typeof businessTeamRoles)[number];
  status: 'active' | 'invited';
}

const roleHints = { Owner: 'Everything, including billing and deleting the business', Admin: 'Edit profile, reply to reviews, manage disputes', Member: 'View dashboard and reply to reviews' };

export function BusinessTeam() {
  const { session } = useUser();
  const { subscription } = useTrust();
  const [members, setMembers] = usePersistentState<Member[]>('pc-biz-team', [
  { id: 'm1', name: session?.name ?? 'Owner', email: session?.email ?? '', role: 'Owner', status: 'active' },
  { id: 'm2', name: 'Femi Ade', email: 'femi@brightpath.ng', role: 'Admin', status: 'active' }]
  );
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Member['role']>('Member');
  const [error, setError] = useState('');
  const limit = subscription.planId === 'biz-pro' ? 5 : 2;

  const invite = () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email');
    if (members.some((m) => m.email.toLowerCase() === email.toLowerCase())) return setError('This person is already on your team');
    if (members.length >= limit) return setError(`Your plan allows ${limit} team members. Upgrade to Business Pro for 5.`);
    setMembers((l) => [...l, { id: `m${Date.now()}`, name: email.split('@')[0], email, role, status: 'invited' }]);
    setOpen(false);
    setEmail('');
    setError('');
    toast.success(`Invite sent to ${email}`);
  };

  return (
    <div className="max-w-3xl pb-10">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          {members.length} of {limit} seats · {planById(subscription.planId)?.name ?? 'Free'}
        </p>
        <button type="button" onClick={() => setOpen(true)} className={`${primaryButton} h-11 px-4`}>
          <PlusIcon className="h-4 w-4" aria-hidden="true" /> Invite
        </button>
      </div>
      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-3xl bg-surface">
        {members.map((m) =>
        <li key={m.id} className="flex items-center gap-3 px-5 py-4">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-violet-soft font-semibold text-violet" aria-hidden="true">
              {m.name[0]?.toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-ink">
                {m.name} {m.status === 'invited' && <span className="text-sm font-normal text-muted">· invited</span>}
              </span>
              <span className="block truncate text-sm text-muted">{m.email}</span>
            </span>
            <span className="text-sm font-semibold text-ink-soft">{m.role}</span>
            {m.role !== 'Owner' &&
          <button
            type="button"
            aria-label={`Remove ${m.name}`}
            onClick={() => {
              setMembers((l) => l.filter((x) => x.id !== m.id));
              toast(`${m.name} removed`);
            }}
            className="grid h-11 w-11 place-items-center rounded-xl text-danger hover:bg-danger-soft">
            
                <Trash2Icon className="h-4 w-4" />
              </button>
          }
          </li>
        )}
      </ul>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Invite a team member" footer={<button type="button" onClick={invite} className={`${primaryButton} w-full`}>Send invite</button>}>
        <div className="space-y-4">
          <Field label="Email" error={error || undefined}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </Field>
          <fieldset>
            <legend className="text-sm font-medium text-ink">Role</legend>
            <div className="mt-2 flex gap-2">
              {(['Admin', 'Member'] as const).map((r) =>
              <button key={r} type="button" aria-pressed={role === r} onClick={() => setRole(r)} className={chipClass(role === r)}>
                  {r}
                </button>
              )}
            </div>
            <p className="mt-2 text-sm text-muted">{roleHints[role]}</p>
          </fieldset>
        </div>
      </BottomSheet>
    </div>);

}