import React, { useState } from 'react';
import { toast } from 'sonner';
import { LoaderCircleIcon, PlusIcon, RefreshCwIcon } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { LockedNotice } from '../../components/admin/LockedNotice';
import { StatusPill } from '../../components/admin/StatusPill';
import { AddSourceSheet } from '../../components/admin/dataSources/AddSourceSheet';
import { Switch } from '../../components/Switch';
import { useAdminData } from '../../contexts/AdminDataContext';
import { useAdminSession } from '../../contexts/AdminSessionContext';
import { usePwa } from '../../contexts/PwaContext';
import { formatWhen, makeId } from '../../utils/checks';
import { primaryButton } from '../../utils/formStyles';
import type { DataSource } from '../../types/admin';

export function AdminDataSources() {
  const { dataSources, saveDataSource } = useAdminData();
  const { permissions, log } = useAdminSession();
  const { online } = usePwa();
  const [syncing, setSyncing] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const canEdit = permissions.manageDataSources && online;
  const stale = dataSources.filter((s) => s.status === 'warn').length;

  const sync = (s: DataSource) => {
    setSyncing((l) => [...l, s.id]);
    window.setTimeout(() => {
      saveDataSource({ ...s, status: 'ok', lastSync: new Date().toISOString(), records: s.records + Math.round(s.records * 0.002) + 1 });
      setSyncing((l) => l.filter((x) => x !== s.id));
      log('platform', `Synced ${s.name}`);
      toast.success(`${s.name} is up to date`);
    }, 1500);
  };

  return (
    <>
      <AdminPageHeader
        title="Data Sources"
        subtitle={stale > 0 ? `${stale} source${stale > 1 ? 's' : ''} need${stale > 1 ? '' : 's'} a sync` : 'External data PadiCheck compares against.'}
        actions={
        canEdit &&
        <button type="button" onClick={() => setAddOpen(true)} className={`${primaryButton} h-11 px-4`}>
              <PlusIcon className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">Add source</span>
            </button>

        } />
      
      <div className="px-4 md:px-8">
        {!permissions.manageDataSources && <LockedNotice text="View only — managing sources needs the “Manage data sources” permission." />}
        <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface">
          {dataSources.map((s) => {
            const busy = syncing.includes(s.id);
            const paused = s.status === 'off';
            return (
              <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_160px_140px_auto_auto] md:px-5">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{s.name}</p>
                  <p className="truncate text-sm text-muted">
                    {s.kind} · {s.coverage}
                  </p>
                </div>
                <div className="justify-self-end md:order-none md:justify-self-start">
                  <StatusPill status={busy ? 'pending' : s.status} />
                </div>
                <p className="col-span-2 text-sm text-muted md:col-span-1">
                  {s.records.toLocaleString()} records · {s.frequency.toLowerCase()}
                  <span className="block">Synced {formatWhen(s.lastSync)}</span>
                </p>
                <div className="col-span-2 flex items-center justify-between gap-3 md:col-span-2 md:justify-end">
                  <button
                    type="button"
                    disabled={!canEdit || busy || paused}
                    onClick={() => sync(s)}
                    className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-ink ring-1 ring-line hover:bg-canvas disabled:opacity-40">
                    
                    {busy ? <LoaderCircleIcon className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCwIcon className="h-4 w-4" aria-hidden="true" />}
                    {busy ? 'Syncing…' : 'Sync now'}
                  </button>
                  <Switch
                    checked={!paused}
                    disabled={!canEdit || busy}
                    onChange={(on) => {
                      saveDataSource({ ...s, status: on ? 'warn' : 'off' });
                      log('platform', `${on ? 'Resumed' : 'Paused'} ${s.name}`);
                      toast(on ? `${s.name} resumed — run a sync to refresh it` : `${s.name} paused — checks won’t use it`);
                    }}
                    label={`Use ${s.name} in checks`} />
                  
                </div>
              </li>);

          })}
        </ul>
      </div>
      <AddSourceSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={({ endpoint, ...data }) => {
          const source: DataSource = { ...data, id: makeId('ds'), status: 'warn', lastSync: new Date().toISOString(), records: 0 };
          saveDataSource(source);
          log('platform', `Connected data source ${data.name}`, endpoint);
          setAddOpen(false);
          toast.success(`${data.name} connected`, { description: 'Running the first sync…' });
          sync(source);
        }} />
      
    </>);

}