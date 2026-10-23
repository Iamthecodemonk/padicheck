import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { PaperclipIcon, ScaleIcon, SendIcon } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { Field } from '../../components/admin/Field';
import { StateView } from '../../components/trust/StateView';
import { useTrust } from '../../contexts/TrustContext';
import { reportStatusMeta } from '../trust/MyReports';
import { track } from '../../utils/analytics';
import { formatWhen } from '../../utils/checks';
import { chipClass, inputClass, primaryButton, textareaClass } from '../../utils/formStyles';
import type { Dispute, DisputeStatus, UserReport } from '../../types/trust';

export const disputeStatusMeta: Record<DisputeStatus, {label: string;tone: string;}> = {
  open: { label: 'Submitted', tone: 'bg-canvas text-muted' },
  review: { label: 'Under review', tone: 'bg-sky-soft text-sky' },
  info: { label: 'Information requested', tone: 'bg-caution-soft text-caution' },
  upheld: { label: 'Report upheld', tone: 'bg-danger-soft text-danger' },
  corrected: { label: 'Information corrected', tone: 'bg-brand-soft text-brand-dark' },
  removed: { label: 'Report removed', tone: 'bg-brand-soft text-brand-dark' }
};

const requestLabels = { correction: 'Correct the information', removal: 'Remove the report', review: 'Review again' };

export function BusinessReports() {
  const { myBusiness, reports, disputes, addDispute, updateDispute, notify } = useTrust();
  const [disputing, setDisputing] = useState<UserReport | null>(null);
  const [request, setRequest] = useState<Dispute['request']>('correction');
  const [statement, setStatement] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const [threadReply, setThreadReply] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const myReports = reports.filter((r) => r.entityName === myBusiness.name);
  const myDisputes = disputes.filter((d) => d.businessId === myBusiness.id);
  const disputeFor = (reportId: string) => myDisputes.find((d) => d.reportId === reportId);

  const submitDispute = () => {
    setTried(true);
    if (!disputing || statement.trim().length < 30) return;
    const d = addDispute({ reportId: disputing.id, businessId: myBusiness.id, businessName: myBusiness.name, request, statement: statement.trim(), evidence: files });
    notify({ category: 'dispute', title: `Dispute ${d.id} submitted`, body: 'A person will review your evidence and the original report.', to: '/business/reports' });
    track('dispute_opened', { request });
    setDisputing(null);
    setStatement('');
    setFiles([]);
    setTried(false);
    toast.success('Dispute submitted');
  };

  return (
    <div className="space-y-8 pb-10">
      <section aria-labelledby="reports-h">
        <h2 id="reports-h" className="text-xl font-bold text-ink">
          Reports about your business
        </h2>
        <p className="text-sm text-muted">You can’t see who reported you. You can respond with evidence through a dispute.</p>
        {myReports.length === 0 ?
        <StateView kind="empty" className="mt-3" title="No reports" body="Nobody has reported your business." /> :

        <ul className="mt-3 space-y-3">
            {myReports.map((r) => {
            const d = disputeFor(r.id);
            return (
              <li key={r.id} className="rounded-3xl bg-surface p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{r.category}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${reportStatusMeta[r.status].tone}`}>{reportStatusMeta[r.status].label}</span>
                    <span className="text-sm text-muted">
                      {r.id} · {formatWhen(r.at)}
                    </span>
                  </div>
                  <p className="mt-2 text-ink-soft">“{r.description}”</p>
                  {d ?
                <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${disputeStatusMeta[d.status].tone}`}>Dispute {d.id}: {disputeStatusMeta[d.status].label}</p> :

                r.status !== 'rejected' &&
                <button type="button" onClick={() => setDisputing(r)} className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-violet ring-1 ring-line hover:bg-violet-soft">
                        <ScaleIcon className="h-4 w-4" aria-hidden="true" /> Dispute this report
                      </button>

                }
                </li>);

          })}
          </ul>
        }
      </section>

      <section aria-labelledby="disputes-h">
        <h2 id="disputes-h" className="text-xl font-bold text-ink">
          Your disputes
        </h2>
        {myDisputes.length === 0 ?
        <StateView kind="empty" className="mt-3" title="No disputes" /> :

        <ul className="mt-3 space-y-3">
            {myDisputes.map((d) => {
            const closed = ['upheld', 'corrected', 'removed'].includes(d.status);
            return (
              <li key={d.id} className="rounded-3xl bg-surface p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{d.id}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${disputeStatusMeta[d.status].tone}`}>{disputeStatusMeta[d.status].label}</span>
                    <span className="text-sm text-muted">
                      {requestLabels[d.request]} · report {d.reportId}
                    </span>
                  </div>
                  <ol className="mt-4 space-y-3">
                    {d.messages.map((m, i) =>
                  <li key={i} className={`max-w-[90%] rounded-2xl p-3 text-sm ${m.from === 'admin' ? 'bg-sky-soft text-ink' : 'ml-auto bg-canvas text-ink'}`}>
                        <p>{m.text}</p>
                        <p className="mt-1 text-xs text-muted">
                          {m.author} · {formatWhen(m.at)}
                        </p>
                      </li>
                  )}
                  </ol>
                  {d.evidence.length > 0 && <p className="mt-3 text-sm text-muted">Evidence: {d.evidence.join(', ')}</p>}
                  {d.decision && <p className="mt-3 rounded-2xl bg-canvas p-3 text-sm font-medium text-ink">Decision: {d.decision}</p>}
                  {!closed &&
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const text = threadReply[d.id]?.trim();
                    if (!text) return;
                    updateDispute(d.id, d.status === 'info' ? { status: 'review' } : {}, { from: 'business', author: myBusiness.name, text });
                    setThreadReply((x) => ({ ...x, [d.id]: '' }));
                  }}>
                  
                      <label htmlFor={`reply-${d.id}`} className="sr-only">
                        Reply to the trust team
                      </label>
                      <input id={`reply-${d.id}`} value={threadReply[d.id] ?? ''} onChange={(e) => setThreadReply((x) => ({ ...x, [d.id]: e.target.value }))} placeholder="Add information for the review team" className={`${inputClass} mt-0`} />
                      <button type="submit" aria-label="Send" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand text-white">
                        <SendIcon className="h-5 w-5" />
                      </button>
                    </form>
                }
                </li>);

          })}
          </ul>
        }
      </section>

      <BottomSheet
        open={disputing !== null}
        onClose={() => setDisputing(null)}
        title={`Dispute report ${disputing?.id ?? ''}`}
        description="A person reviews your evidence alongside the original report. You’ll be notified of the decision."
        footer={
        <button type="button" onClick={submitDispute} className={`${primaryButton} w-full`}>
            Submit dispute
          </button>
        }>
        
        <div className="space-y-4">
          <p className="rounded-2xl bg-canvas p-3 text-sm text-ink-soft">“{disputing?.description}”</p>
          <fieldset>
            <legend className="text-sm font-medium text-ink">What are you asking for?</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(requestLabels) as Dispute['request'][]).map((k) =>
              <button key={k} type="button" aria-pressed={request === k} onClick={() => setRequest(k)} className={chipClass(request === k)}>
                  {requestLabels[k]}
                </button>
              )}
            </div>
          </fieldset>
          <Field label="Your response" error={tried && statement.trim().length < 30 ? 'Explain what happened in at least 30 characters' : undefined}>
            <textarea rows={5} value={statement} onChange={(e) => setStatement(e.target.value)} className={textareaClass} placeholder="What really happened, with dates and references" />
          </Field>
          <input ref={fileRef} type="file" multiple accept="image/*,.pdf" className="sr-only" onChange={(e) => setFiles((l) => [...l, ...Array.from(e.target.files ?? []).map((f) => f.name)].slice(0, 6))} />
          <button type="button" onClick={() => fileRef.current?.click()} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line font-medium text-ink">
            <PaperclipIcon className="h-4 w-4" aria-hidden="true" /> {files.length ? `${files.length} file(s) attached` : 'Upload evidence'}
          </button>
        </div>
      </BottomSheet>
    </div>);

}