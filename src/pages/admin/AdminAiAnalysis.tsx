import React, { useState } from 'react';
import { toast } from 'sonner';
import { ShieldAlertIcon } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { LockedNotice } from '../../components/admin/LockedNotice';
import { SegmentedTabs } from '../../components/admin/SegmentedTabs';
import { ReasonSheet } from '../../components/admin/trust/ReasonSheet';
import { StateView } from '../../components/trust/StateView';
import { useAdminSession } from '../../contexts/AdminSessionContext';
import { useTrust } from '../../contexts/TrustContext';
import { entityTypeById } from '../../data/entityTypes';
import { formatWhen } from '../../utils/checks';
import type { AiFlag } from '../../types/trust';

type Tab = AiFlag['status'] | 'all';

const statusTone: Record<AiFlag['status'], string> = {
  pending: 'bg-caution-soft text-caution',
  confirmed: 'bg-brand-soft text-brand-dark',
  overridden: 'bg-canvas text-muted'
};

/** AI raises signals; people decide. Nothing here changes a score or removes content without a human. */
export function AdminAiAnalysis() {
  const { aiFlags, updateAiFlag } = useTrust();
  const { permissions, log, session } = useAdminSession();
  const canAct = permissions.reviewAi;
  const [tab, setTab] = useState<Tab>('pending');
  const [overriding, setOverriding] = useState<AiFlag | null>(null);

  const reviewed = aiFlags.filter((f) => f.status !== 'pending');
  const overridden = aiFlags.filter((f) => f.status === 'overridden');
  const avgConf = aiFlags.length ? aiFlags.reduce((s, f) => s + f.confidence, 0) / aiFlags.length : 0;
  const models = Array.from(new Set(aiFlags.map((f) => f.model))).map((m) => {
    const fs = aiFlags.filter((f) => f.model === m);
    const rev = fs.filter((f) => f.status !== 'pending');
    return { model: m, flags: fs.length, fpr: rev.length ? Math.round(rev.filter((f) => f.status === 'overridden').length / rev.length * 100) : null };
  });
  const list = aiFlags.filter((f) => tab === 'all' || f.status === tab).sort((a, b) => b.at.localeCompare(a.at));

  const confirm = (f: AiFlag) => {
    updateAiFlag(f.id, { status: 'confirmed', reviewer: session?.name });
    log('trust', 'Confirmed AI flag', `${f.entityName} · ${f.signal} (${f.model})`);
    toast.success('Signal confirmed', { description: 'It now appears on the report, labelled as an AI risk signal.' });
  };

  const metrics = [
  { label: 'AI flags', value: aiFlags.length },
  { label: 'Awaiting human review', value: aiFlags.length - reviewed.length },
  { label: 'Average confidence', value: `${Math.round(avgConf * 100)}%` },
  { label: 'False-positive rate', value: reviewed.length ? `${Math.round(overridden.length / reviewed.length * 100)}%` : '—' },
  { label: 'Human overrides', value: overridden.length }];


  return (
    <>
      <AdminPageHeader title="AI Analysis" subtitle="Review AI risk signals before they affect anyone" />
      <div className="space-y-5 px-4 md:px-8">
        {!canAct && <LockedNotice text="Your role can view AI flags but can’t confirm or override them." />}
        <p className="flex gap-2 rounded-2xl bg-violet-soft p-4 text-sm text-violet">
          <ShieldAlertIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> AI can raise signals and suggest outcomes. It can’t suspend, remove, ban or make legal decisions — a person must confirm.
        </p>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {metrics.map((m, i) =>
          <div key={m.label} className={`rounded-3xl bg-surface p-5 ${i === 1 ? 'col-span-2 md:col-span-1' : ''}`}>
              <dt className="text-sm text-muted">{m.label}</dt>
              <dd className="mt-1 text-2xl font-bold text-ink">{m.value}</dd>
            </div>
          )}
        </dl>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section aria-label="AI flags" className="space-y-3">
            <SegmentedTabs
              label="Flag status"
              value={tab}
              onChange={setTab}
              tabs={[
              { id: 'pending', label: 'Needs review', count: aiFlags.length - reviewed.length },
              { id: 'confirmed', label: 'Confirmed' },
              { id: 'overridden', label: 'Overridden' },
              { id: 'all', label: 'All' }]
              } />
            
            {list.length === 0 ?
            <StateView kind="empty" title="No flags here" /> :

            <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface">
                {list.map((f) =>
              <li key={f.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink">{f.signal}</span>
                      <span className="block truncate text-sm text-muted">
                        {entityTypeById(f.entityType)?.label} · {f.entityName}
                      </span>
                      <span className="block text-xs text-muted">
                        {f.model} · {formatWhen(f.at)}
                        {f.reviewer ? ` · reviewed by ${f.reviewer}` : ''}
                      </span>
                    </span>
                    <span className="w-16 text-right">
                      <span className="block text-lg font-bold tabular-nums text-ink">{Math.round(f.confidence * 100)}%</span>
                      <span className="block text-xs text-muted">confidence</span>
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusTone[f.status]}`}>{f.status}</span>
                    {canAct && f.status === 'pending' &&
                <span className="flex w-full gap-2 sm:w-auto">
                        <button type="button" onClick={() => confirm(f)} className="h-11 flex-1 rounded-xl bg-brand px-4 text-sm font-semibold text-white sm:flex-none">
                          Confirm
                        </button>
                        <button type="button" onClick={() => setOverriding(f)} className="h-11 flex-1 rounded-xl px-4 text-sm font-semibold text-ink ring-1 ring-line hover:bg-canvas sm:flex-none">
                          Override
                        </button>
                      </span>
                }
                  </li>
              )}
              </ul>
            }
          </section>
          <section aria-labelledby="models-h" className="self-start rounded-3xl bg-surface p-5">
            <h2 id="models-h" className="text-sm font-medium text-muted">
              Model & rule versions
            </h2>
            <table className="mt-3 w-full text-sm">
              <thead className="text-muted">
                <tr>
                  <th scope="col" className="py-2 text-left font-medium">Model</th>
                  <th scope="col" className="py-2 text-right font-medium">Flags</th>
                  <th scope="col" className="py-2 text-right font-medium">False +</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {models.map((m) =>
                <tr key={m.model}>
                    <td className="py-2.5 font-mono text-ink">{m.model}</td>
                    <td className="py-2.5 text-right tabular-nums text-ink">{m.flags}</td>
                    <td className="py-2.5 text-right tabular-nums text-ink">{m.fpr === null ? '—' : `${m.fpr}%`}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      </div>
      <ReasonSheet
        open={overriding !== null}
        onClose={() => setOverriding(null)}
        title="Override AI signal"
        description="The signal is hidden from reports and recorded as a false positive to retrain the model."
        confirmLabel="Override signal"
        label="Why is this signal wrong?"
        onConfirm={(reason) => {
          if (overriding) {
            updateAiFlag(overriding.id, { status: 'overridden', reviewer: session?.name });
            log('trust', 'Overrode AI flag', `${overriding.entityName} · ${overriding.signal} — ${reason}`);
          }
          setOverriding(null);
          toast('Signal overridden');
        }} />
      
    </>);

}