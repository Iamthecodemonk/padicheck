import React, { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CoinsIcon, LockIcon, SmartphoneIcon, UserXIcon } from 'lucide-react';
import { AdjustCreditsSheet } from '../../components/admin/AdjustCreditsSheet';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { StatusPill } from '../../components/admin/StatusPill';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { roleLabel, useAdminSession } from '../../contexts/AdminSessionContext';
import { usePwa } from '../../contexts/PwaContext';
import { adminUsers } from '../../data/adminUsers';
import { formatDate, formatNaira, formatWhen, getCheckType } from '../../utils/checks';

export function AdminUserDetail() {
  const { id } = useParams<{id: string;}>();
  const user = adminUsers.find((u) => u.id === id);
  const { session, permissions, log } = useAdminSession();
  const { online } = usePwa();
  const [credits, setCredits] = useState(user?.credits ?? 0);
  const [status, setStatus] = useState(user?.status ?? 'active');
  const [sessions, setSessions] = useState(user?.sessions ?? []);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);

  if (!user) return <Navigate to="/admin/users" replace />;

  const canAdjust = permissions.adjustCredits && online;
  const stats = [
  { label: 'Credits', value: String(credits) },
  { label: 'Checks', value: String(user.checks) },
  { label: 'Spent', value: formatNaira(user.spentNaira) }];


  return (
    <>
      <AdminPageHeader back="/admin/users" title={user.name} subtitle={`${user.email} · ${user.id}`} />
      <div className="grid gap-5 px-4 md:px-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <section aria-label="Overview" className="rounded-3xl bg-surface p-5">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <StatusPill status={status} />
              <span>
                {user.country} · Joined {formatDate(user.joined)}
              </span>
            </div>
            <dl className="mt-5 grid grid-cols-3 gap-3">
              {stats.map((s) =>
              <div key={s.label}>
                  <dt className="text-sm text-muted">{s.label}</dt>
                  <dd className="mt-0.5 text-xl font-bold text-ink sm:text-2xl">{s.value}</dd>
                </div>
              )}
            </dl>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={!canAdjust}
                onClick={() => setAdjustOpen(true)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-ink font-semibold text-white transition-colors hover:bg-ink-soft disabled:opacity-40">
                
                <CoinsIcon className="h-4 w-4" aria-hidden="true" /> Adjust credits
              </button>
              <button
                type="button"
                disabled={!online}
                onClick={() => setSuspendOpen(true)}
                className={`inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-line font-semibold transition-colors hover:bg-canvas disabled:opacity-40 ${status === 'active' ? 'text-danger' : 'text-ink'}`}>
                
                <UserXIcon className="h-4 w-4" aria-hidden="true" /> {status === 'active' ? 'Suspend account' : 'Reactivate account'}
              </button>
            </div>
            {!permissions.adjustCredits && session &&
            <p className="mt-3 flex items-center gap-2 text-sm text-muted">
                <LockIcon className="h-4 w-4" aria-hidden="true" /> {roleLabel(session.role)} accounts can’t adjust credits.
              </p>
            }
          </section>

          <section aria-labelledby="activity-heading" className="rounded-3xl bg-surface p-2">
            <h2 id="activity-heading" className="px-3 pb-1 pt-3 text-lg font-semibold text-ink">
              Recent checks
            </h2>
            <ul>
              {user.activity.map((a, i) => {
                const t = getCheckType(a.type);
                return (
                  <li key={`${a.title}-${i}`} className="flex min-h-[60px] items-center gap-3 px-3 py-2">
                    <t.icon className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{a.title}</span>
                      <span className="block text-sm text-muted">
                        {t.label} · {formatWhen(a.at)}
                      </span>
                    </span>
                    <StatusPill status={a.status} />
                  </li>);

              })}
            </ul>
          </section>
        </div>

        <section aria-labelledby="sessions-heading" className="self-start rounded-3xl bg-surface p-2">
          <div className="flex items-center justify-between px-3 pt-3">
            <h2 id="sessions-heading" className="text-lg font-semibold text-ink">
              Sessions
            </h2>
            {sessions.length > 0 &&
            <button
              type="button"
              disabled={!online}
              onClick={() => {
                setSessions([]);
                toast.success('All sessions revoked');
              }}
              className="h-11 rounded-xl px-3 text-sm font-semibold text-danger hover:bg-canvas disabled:opacity-40">
              
                Revoke all
              </button>
            }
          </div>
          {sessions.length === 0 ?
          <p className="px-3 pb-4 pt-2 text-sm text-muted">No active sessions.</p> :

          <ul>
              {sessions.map((s) =>
            <li key={s.id} className="flex min-h-[64px] items-center gap-3 px-3 py-2">
                  <SmartphoneIcon className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{s.device}</span>
                    <span className="block text-sm text-muted">Last seen {formatWhen(s.lastSeen)}</span>
                  </span>
                  <button
                type="button"
                disabled={!online}
                onClick={() => {
                  setSessions((list) => list.filter((x) => x.id !== s.id));
                  toast.success('Session revoked');
                }}
                className="h-11 rounded-xl px-3 text-sm font-semibold text-ink ring-1 ring-line hover:bg-canvas disabled:opacity-40">
                
                    Revoke
                  </button>
                </li>
            )}
            </ul>
          }
        </section>
      </div>

      <AdjustCreditsSheet
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        userName={user.name}
        balance={credits}
        onApply={(delta, reason) => {
          setCredits((c) => c + delta);
          log('credits', `${delta > 0 ? 'Added' : 'Removed'} ${Math.abs(delta)} credits ${delta > 0 ? 'to' : 'from'} ${user.name}`, reason);
          setAdjustOpen(false);
          toast.success(`${delta > 0 ? 'Added' : 'Removed'} ${Math.abs(delta)} credits`, { description: reason });
        }} />
      
      <ConfirmSheet
        open={suspendOpen}
        onClose={() => setSuspendOpen(false)}
        onConfirm={() => {
          setStatus(status === 'active' ? 'suspended' : 'active');
          log('users', `${status === 'active' ? 'Suspended' : 'Reactivated'} ${user.name}`);
          setSuspendOpen(false);
          toast.success(status === 'active' ? 'Account suspended' : 'Account reactivated');
        }}
        title={status === 'active' ? `Suspend ${user.name}?` : `Reactivate ${user.name}?`}
        description={status === 'active' ? 'They’ll be signed out everywhere and can’t start new checks.' : 'They’ll be able to sign in and run checks again.'}
        confirmLabel={status === 'active' ? 'Suspend' : 'Reactivate'}
        tone={status === 'active' ? 'danger' : 'default'} />
      
    </>);

}