import React, { useState } from 'react';
import { toast } from 'sonner';
import { PaperclipIcon, SendIcon } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { LockedNotice } from '../../components/admin/LockedNotice';
import { SegmentedTabs } from '../../components/admin/SegmentedTabs';
import { ReasonSheet } from '../../components/admin/trust/ReasonSheet';
import { StateView } from '../../components/trust/StateView';
import { useAdminSession } from '../../contexts/AdminSessionContext';
import { useTrust } from '../../contexts/TrustContext';
import { MY_BUSINESS_ID } from '../../data/businesses';
import { disputeStatusMeta } from '../business/BusinessReports';
import { reportStatusMeta } from '../trust/MyReports';
import { track } from '../../utils/analytics';
import { formatWhen } from '../../utils/checks';
import type { Dispute, DisputeStatus } from '../../types/trust';

type Tab = 'active' | 'info' | 'decided' | 'all';
type Decision = 'upheld' | 'corrected' | 'removed' | null;

const requestLabels = { correction: 'Correct the information', removal: 'Remove the report', review: 'Review again' };
const closedStates: DisputeStatus[] = ['upheld', 'corrected', 'removed'];

const decisionCopy: Record<Exclude<Decision, null>, {title: string;description: string;confirm: string;tone?: 'danger';}> = {
  upheld: { title: 'Uphold the original report', description: 'The report and any warning stay in place. The business is told why.', confirm: 'Uphold report' },
  corrected: { title: 'Modify the information', description: 'The report stays but its wording is corrected. Describe exactly what changes.', confirm: 'Save correction' },
  removed: { title: 'Remove incorrect information', description: 'The report is removed from the public result and the Trust Score is recalculated.', confirm: 'Remove report', tone: 'danger' }
};

export function AdminDisputes() {
  const { disputes, updateDispute, reports, updateReport, getEntity, upsertEntity, notify } = useTrust();
  const { permissions, log, session } = useAdminSession();
  const canAct = permissions.manageDisputes;
  const [tab, setTab] = useState<Tab>('active');
  const [openId, setOpenId] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision>(null);
  const [message, setMessage] = useState('');
  const open = disputes.find((d) => d.id === openId) ?? null;
  const original = open ? reports.find((r) => r.id === open.reportId) : undefined;

  const match = (d: Dispute, t: Tab) => t === 'active' ? d.status === 'open' || d.status === 'review' : t === 'info' ? d.status === 'info' : t === 'decided' ? closedStates.includes(d.status) : true;
  const list = disputes.filter((d) => match(d, tab)).sort((a, b) => b.at.localeCompare(a.at));
  const author = session?.name ?? 'PadiCheck Trust team';

  const tellBusiness = (d: Dispute, title: string, body: string) => {
    if (d.businessId === MY_BUSINESS_ID) notify({ category: 'dispute', title, body, to: '/business/reports' });
  };

  const send = (requestInfo: boolean) => {
    if (!open || message.trim().length < 3) return;
    updateDispute(open.id, { status: requestInfo ? 'info' : open.status === 'open' ? 'review' : open.status }, { from: 'admin', author, text: message.trim() });
    log('trust', requestInfo ? 'Requested dispute information' : 'Messaged business on dispute', `${open.id} · ${open.businessName}`);
    tellBusiness(open, requestInfo ? `Dispute ${open.id}: information requested` : `New message on dispute ${open.id}`, message.trim());
    setMessage('');
    toast.success(requestInfo ? 'Information requested' : 'Message sent');
  };

  const decide = (kind: Exclude<Decision, null>, reason: string) => {
    if (!open) return;
    updateDispute(open.id, { status: kind, decision: reason }, { from: 'admin', author, text: `Decision: ${reason}` });
    if (original) {
      if (kind === 'removed') {
        updateReport(original.id, { status: 'rejected' }, { text: 'Removed after a dispute review found it inaccurate.', by: author });
        const e = getEntity(original.entityId);
        if (e) upsertEntity({ ...e, previousScore: e.score, score: Math.min(100, e.score + 6), unresolvedReports: Math.max(0, e.unresolvedReports - 1), totalReports: Math.max(0, e.totalReports - 1) });
      } else if (kind === 'corrected') {
        updateReport(original.id, {}, { text: `Information corrected after dispute: ${reason}`, by: author });
      } else {
        updateReport(original.id, { status: 'resolved' }, { text: 'Upheld after the business disputed it.', by: author });
      }
    }
    log('trust', `Dispute decided: ${decisionCopy[kind].confirm.toLowerCase()}`, `${open.id} · ${open.businessName} — ${reason}`);
    tellBusiness(open, `Decision on dispute ${open.id}`, reason);
    track('dispute_resolved', { outcome: kind });
    setDecision(null);
    toast.success('Decision recorded');
  };

  const count = (t: Tab) => disputes.filter((d) => match(d, t)).length;
  const isClosed = open ? closedStates.includes(open.status) : false;

  return (
    <>
      <AdminPageHeader title="Disputes" subtitle="Businesses challenging reports about them" />
      <div className="space-y-4 px-4 md:px-8">
        {!canAct && <LockedNotice text="Your role can view disputes but can’t decide them." />}
        <SegmentedTabs
          label="Dispute status"
          value={tab}
          onChange={setTab}
          tabs={[
          { id: 'active', label: 'To review', count: count('active') },
          { id: 'info', label: 'Waiting on business', count: count('info') },
          { id: 'decided', label: 'Decided', count: count('decided') },
          { id: 'all', label: 'All' }]
          } />
        
        {list.length === 0 ?
        <StateView kind="empty" title="No disputes here" /> :

        <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface">
            {list.map((d) =>
          <li key={d.id}>
                <button type="button" onClick={() => setOpenId(d.id)} className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-canvas">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{d.businessName}</span>
                    <span className="block truncate text-sm text-ink-soft">{d.statement}</span>
                    <span className="block text-xs text-muted">
                      {d.id} · {requestLabels[d.request]} · report {d.reportId} · {formatWhen(d.at)}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${disputeStatusMeta[d.status].tone}`}>{disputeStatusMeta[d.status].label}</span>
                </button>
              </li>
          )}
          </ul>
        }
      </div>

      <BottomSheet
        open={open !== null}
        onClose={() => setOpenId(null)}
        title={open ? `${open.id} · ${open.businessName}` : ''}
        description={open ? `Asking to: ${requestLabels[open.request].toLowerCase()}` : undefined}
        footer={
        open && canAct && !isClosed ?
        <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => setDecision('upheld')} className="h-12 rounded-2xl font-semibold text-ink ring-1 ring-line hover:bg-canvas">
                Uphold
              </button>
              <button type="button" onClick={() => setDecision('corrected')} className="h-12 rounded-2xl font-semibold text-ink ring-1 ring-line hover:bg-canvas">
                Modify
              </button>
              <button type="button" onClick={() => setDecision('removed')} className="h-12 rounded-2xl bg-brand font-semibold text-white hover:bg-brand-dark">
                Remove
              </button>
            </div> :
        undefined
        }>
        
        {open &&
        <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2">
              <section className="rounded-2xl bg-canvas p-4">
                <h3 className="text-xs font-semibold text-muted">Original report {original ? `· ${reportStatusMeta[original.status].label}` : ''}</h3>
                {original ?
              <>
                    <p className="mt-1 font-medium text-ink">{original.category}</p>
                    <p className="mt-1 text-sm text-ink-soft">“{original.description}”</p>
                    <p className="mt-2 text-xs text-muted">Evidence: {original.evidence.join(', ') || 'none'}</p>
                  </> :

              <p className="mt-1 text-sm text-muted">The original report is no longer available.</p>
              }
              </section>
              <section className="rounded-2xl bg-violet-soft p-4">
                <h3 className="text-xs font-semibold text-violet">Business response</h3>
                <p className="mt-1 text-sm text-ink">{open.statement}</p>
                {open.evidence.length > 0 &&
              <ul className="mt-2 flex flex-wrap gap-1.5">
                    {open.evidence.map((e) =>
                <li key={e} className="inline-flex items-center gap-1 rounded-lg bg-surface px-2 py-1 text-xs text-ink">
                        <PaperclipIcon className="h-3.5 w-3.5 text-muted" aria-hidden="true" /> {e}
                      </li>
                )}
                  </ul>
              }
              </section>
            </div>
            {open.decision && <p className="rounded-2xl bg-canvas p-3 text-sm font-medium text-ink">Decision: {open.decision}</p>}
            <section>
              <h3 className="text-sm font-semibold text-ink">Conversation</h3>
              <ol className="mt-2 space-y-2">
                {open.messages.map((m, i) =>
              <li key={i} className={`max-w-[90%] rounded-2xl p-3 text-sm ${m.from === 'admin' ? 'ml-auto bg-sky-soft' : 'bg-canvas'}`}>
                    <p className="text-ink">{m.text}</p>
                    <p className="mt-1 text-xs text-muted">
                      {m.author} · {formatWhen(m.at)}
                    </p>
                  </li>
              )}
              </ol>
              {canAct && !isClosed &&
            <div className="mt-3 space-y-2">
                  <label htmlFor="dispute-msg" className="sr-only">
                    Message the business
                  </label>
                  <textarea id="dispute-msg" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message the business" className="block w-full rounded-2xl bg-canvas p-3 text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-brand" />
                  <div className="flex gap-2">
                    <button type="button" disabled={message.trim().length < 3} onClick={() => send(false)} className="inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-ink ring-1 ring-line disabled:opacity-40">
                      <SendIcon className="h-4 w-4" aria-hidden="true" /> Send
                    </button>
                    <button type="button" disabled={message.trim().length < 3} onClick={() => send(true)} className="h-11 rounded-xl px-4 text-sm font-semibold text-caution ring-1 ring-line disabled:opacity-40">
                      Send as information request
                    </button>
                  </div>
                </div>
            }
            </section>
          </div>
        }
      </BottomSheet>

      {decision &&
      <ReasonSheet
        open
        onClose={() => setDecision(null)}
        title={decisionCopy[decision].title}
        description={decisionCopy[decision].description}
        confirmLabel={decisionCopy[decision].confirm}
        tone={decisionCopy[decision].tone}
        label="Decision (shared with the business)"
        onConfirm={(reason) => decide(decision, reason)} />

      }
    </>);

}