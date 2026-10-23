import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BotIcon, FlagIcon, PaperclipIcon, SearchIcon, SirenIcon } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { LockedNotice } from '../../components/admin/LockedNotice';
import { SegmentedTabs } from '../../components/admin/SegmentedTabs';
import { ReasonSheet } from '../../components/admin/trust/ReasonSheet';
import { StateView } from '../../components/trust/StateView';
import { useAdminSession } from '../../contexts/AdminSessionContext';
import { useTrust } from '../../contexts/TrustContext';
import { entityTypeById } from '../../data/entityTypes';
import { reportStatusMeta } from '../trust/MyReports';
import { formatWhen } from '../../utils/checks';
import { chipClass } from '../../utils/formStyles';
import type { ReportStatus, UserReport } from '../../types/trust';

type Tab = 'open' | 'info' | 'escalated' | 'closed' | 'all';
type Action = 'approve' | 'reject' | 'evidence' | 'escalate' | 'resolve' | null;

const riskTone = { high: 'bg-danger-soft text-danger', medium: 'bg-caution-soft text-caution', low: 'bg-canvas text-muted' };

const actions: Record<Exclude<Action, null>, {title: string;description: string;confirm: string;status: ReportStatus;update: (r: string) => string;tone?: 'danger';}> = {
  approve: { title: 'Approve and uphold report', description: 'A warning is added to this entity’s PadiCheck report and the reporter is told.', confirm: 'Approve report', status: 'resolved', update: (r) => `Upheld. ${r}` },
  reject: { title: 'Reject report', description: 'The report is removed from the entity and the reporter is told why.', confirm: 'Reject report', status: 'rejected', update: (r) => `Not upheld. ${r}`, tone: 'danger' },
  evidence: { title: 'Request more evidence', description: 'The reporter is asked for more information. The report stays private meanwhile.', confirm: 'Send request', status: 'info', update: (r) => `More information needed: ${r}` },
  escalate: { title: 'Escalate to senior review', description: 'Use for possible fraud rings, legal risk or threats to safety.', confirm: 'Escalate', status: 'review', update: () => 'Escalated to our senior trust team.' },
  resolve: { title: 'Resolve without a public warning', description: 'Close the report — for example if the issue was settled between the parties.', confirm: 'Resolve', status: 'resolved', update: (r) => `Resolved. ${r}` }
};

export function AdminReports() {
  const { reports, updateReport, getEntity, upsertEntity, notify } = useTrust();
  const { permissions, log, session } = useAdminSession();
  const canAct = permissions.moderateReports;
  const [tab, setTab] = useState<Tab>('open');
  const [risk, setRisk] = useState<'all' | UserReport['risk']>('all');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [action, setAction] = useState<Action>(null);
  const open = reports.find((r) => r.id === openId) ?? null;

  const match = (r: UserReport, t: Tab) =>
  t === 'open' ? r.status === 'pending' || r.status === 'review' && !r.escalated : t === 'info' ? r.status === 'info' : t === 'escalated' ? Boolean(r.escalated) && r.status === 'review' : t === 'closed' ? r.status === 'resolved' || r.status === 'rejected' : true;

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const order = { high: 0, medium: 1, low: 2 };
    return reports.
    filter((r) => match(r, tab) && (risk === 'all' || r.risk === risk)).
    filter((r) => !term || `${r.id} ${r.entityName} ${r.category} ${r.reporter}`.toLowerCase().includes(term)).
    sort((a, b) => order[a.risk] - order[b.risk] || b.at.localeCompare(a.at));
  }, [reports, tab, risk, q]);

  const run = (kind: Exclude<Action, null>, reason: string) => {
    if (!open) return;
    const a = actions[kind];
    updateReport(open.id, { status: a.status, escalated: kind === 'escalate' ? true : open.escalated }, { text: a.update(reason), by: session?.name ?? 'Moderator' });
    log('trust', `Report ${kind === 'evidence' ? 'evidence requested' : kind + 'd'}`, `${open.id} · ${open.entityName} — ${reason}`);
    if (kind === 'approve') {
      const e = getEntity(open.entityId);
      if (e) {
        upsertEntity({
          ...e,
          previousScore: e.score,
          score: Math.max(0, e.score - (open.risk === 'high' ? 12 : open.risk === 'medium' ? 6 : 3)),
          unresolvedReports: Math.max(0, e.unresolvedReports - 1),
          signals: [{ source: 'reports', positive: false, text: `Upheld report: ${open.category.toLowerCase()}` }, ...e.signals]
        });
      }
    }
    if (open.reporter === 'Adaeze Okafor') notify({ category: 'report', title: `Update on report ${open.id}`, body: a.update(reason), to: '/my-reports' });
    setAction(null);
    toast.success(`${open.id} updated`);
  };

  const toggleFlag = () => {
    if (!open) return;
    updateReport(open.id, { flagged: !open.flagged });
    log('trust', open.flagged ? 'Removed report flag' : 'Flagged report', `${open.id} · ${open.entityName}`);
  };

  const count = (t: Tab) => reports.filter((r) => match(r, t)).length;
  const closed = open && (open.status === 'resolved' || open.status === 'rejected');

  return (
    <>
      <AdminPageHeader title="Reports" subtitle="Moderation queue for user reports" />
      <div className="space-y-4 px-4 md:px-8">
        {!canAct && <LockedNotice text="Your role can view reports but can’t moderate them." />}
        <SegmentedTabs
          label="Report status"
          value={tab}
          onChange={setTab}
          tabs={[
          { id: 'open', label: 'To review', count: count('open') },
          { id: 'info', label: 'Awaiting evidence', count: count('info') },
          { id: 'escalated', label: 'Escalated', count: count('escalated') },
          { id: 'closed', label: 'Closed', count: count('closed') },
          { id: 'all', label: 'All' }]
          } />
        
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
            {(['all', 'high', 'medium', 'low'] as const).map((r) =>
            <button key={r} type="button" aria-pressed={risk === r} onClick={() => setRisk(r)} className={chipClass(risk === r)}>
                {r === 'all' ? 'Any risk' : `${r[0].toUpperCase()}${r.slice(1)} risk`}
              </button>
            )}
          </div>
          <label className="relative md:ml-auto md:w-72">
            <span className="sr-only">Search reports</span>
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ID, entity or reporter" className="h-11 w-full rounded-2xl bg-surface pl-10 pr-4 text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-brand" />
          </label>
        </div>

        {list.length === 0 ?
        <StateView kind="empty" title="Nothing to moderate here" /> :

        <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface">
            {list.map((r) =>
          <li key={r.id}>
                <button type="button" onClick={() => setOpenId(r.id)} className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-canvas">
                  <span className={`mt-0.5 shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${riskTone[r.risk]}`}>{r.risk}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold text-ink">{r.entityName}</span>
                      {r.flagged && <FlagIcon className="h-4 w-4 shrink-0 text-danger" aria-label="Flagged" />}
                      {r.escalated && <SirenIcon className="h-4 w-4 shrink-0 text-caution" aria-label="Escalated" />}
                    </span>
                    <span className="block truncate text-sm text-ink-soft">{r.description}</span>
                    <span className="block text-xs text-muted">
                      {r.id} · {r.category} · {formatWhen(r.at)}
                    </span>
                  </span>
                  <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline ${reportStatusMeta[r.status].tone}`}>{reportStatusMeta[r.status].label}</span>
                </button>
              </li>
          )}
          </ul>
        }
      </div>

      <BottomSheet
        open={open !== null}
        onClose={() => setOpenId(null)}
        title={open ? `${open.id} · ${open.entityName}` : ''}
        description={open ? `${entityTypeById(open.entityType)?.label ?? ''} · ${open.category}` : undefined}
        footer={
        open && canAct && !closed ?
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <button type="button" onClick={() => setAction('approve')} className="h-12 rounded-2xl bg-brand font-semibold text-white hover:bg-brand-dark">
                Approve
              </button>
              <button type="button" onClick={() => setAction('reject')} className="h-12 rounded-2xl font-semibold text-danger ring-1 ring-line hover:bg-danger-soft">
                Reject
              </button>
              <button type="button" onClick={() => setAction('evidence')} className="h-12 rounded-2xl font-semibold text-ink ring-1 ring-line hover:bg-canvas">
                Request evidence
              </button>
              <button type="button" onClick={() => setAction('escalate')} disabled={open.escalated} className="h-12 rounded-2xl font-semibold text-ink ring-1 ring-line hover:bg-canvas disabled:opacity-40">
                Escalate
              </button>
              <button type="button" onClick={() => setAction('resolve')} className="h-12 rounded-2xl font-semibold text-ink ring-1 ring-line hover:bg-canvas">
                Resolve
              </button>
              <button type="button" onClick={toggleFlag} className="h-12 rounded-2xl font-semibold text-ink ring-1 ring-line hover:bg-canvas">
                {open.flagged ? 'Unflag' : 'Flag'}
              </button>
            </div> :
        undefined
        }>
        
        {open &&
        <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${riskTone[open.risk]}`}>{open.risk} risk</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${reportStatusMeta[open.status].tone}`}>{reportStatusMeta[open.status].label}</span>
              {open.escalated && <span className="rounded-full bg-caution-soft px-2.5 py-1 text-xs font-semibold text-caution">Escalated</span>}
            </div>
            <blockquote className="rounded-2xl bg-canvas p-4 text-ink">“{open.description}”</blockquote>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted">Reporter</dt>
                <dd className="font-medium text-ink">{open.reporter}</dd>
              </div>
              <div>
                <dt className="text-muted">Contact</dt>
                <dd className="break-words font-medium text-ink">{open.contact ?? 'Not given'}</dd>
              </div>
              <div>
                <dt className="text-muted">Submitted</dt>
                <dd className="font-medium text-ink">{formatWhen(open.at)}</dd>
              </div>
              <div>
                <dt className="text-muted">Entity</dt>
                <dd className="font-medium text-ink">{open.entityName}</dd>
              </div>
            </dl>
            <section>
              <h3 className="text-sm font-semibold text-ink">Evidence</h3>
              {open.evidence.length === 0 ?
            <p className="mt-1 text-sm text-muted">No evidence attached.</p> :

            <ul className="mt-2 flex flex-wrap gap-2">
                  {open.evidence.map((e) =>
              <li key={e} className="inline-flex items-center gap-1.5 rounded-xl bg-canvas px-3 py-2 text-sm text-ink">
                      <PaperclipIcon className="h-4 w-4 text-muted" aria-hidden="true" /> {e}
                    </li>
              )}
                </ul>
            }
            </section>
            {open.aiSuggested &&
          <p className="flex gap-2 rounded-2xl bg-violet-soft p-3 text-sm text-violet">
                <BotIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  <strong className="font-semibold">AI suggestion (advisory only):</strong> {open.aiSuggested}. A moderator must decide.
                </span>
              </p>
          }
            <section>
              <h3 className="text-sm font-semibold text-ink">Timeline</h3>
              <ol className="mt-2 space-y-2 text-sm">
                {open.updates.map((u, i) =>
              <li key={i} className="flex gap-2">
                    <span className="shrink-0 text-muted">{formatWhen(u.at)}</span>
                    <span className="text-ink">
                      {u.text} <span className="text-muted">— {u.by}</span>
                    </span>
                  </li>
              )}
              </ol>
            </section>
          </div>
        }
      </BottomSheet>

      {action &&
      <ReasonSheet
        open
        onClose={() => setAction(null)}
        title={actions[action].title}
        description={actions[action].description}
        confirmLabel={actions[action].confirm}
        tone={actions[action].tone}
        label={action === 'evidence' ? 'What do you need from the reporter?' : 'Reason (shared with the reporter)'}
        onConfirm={(reason) => run(action, reason)} />

      }
    </>);

}