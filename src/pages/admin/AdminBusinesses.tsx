import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { BadgeCheckIcon, CheckIcon, ExternalLinkIcon, FileTextIcon, SearchIcon, XIcon } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { LockedNotice } from '../../components/admin/LockedNotice';
import { SegmentedTabs } from '../../components/admin/SegmentedTabs';
import { ReasonSheet } from '../../components/admin/trust/ReasonSheet';
import { StateView } from '../../components/trust/StateView';
import { useAdminData } from '../../contexts/AdminDataContext';
import { useAdminSession } from '../../contexts/AdminSessionContext';
import { useTrust } from '../../contexts/TrustContext';
import { MY_BUSINESS_ID } from '../../data/businesses';
import { verificationStatusMeta } from '../../data/businessPortal';
import { track } from '../../utils/analytics';
import { formatDate, formatWhen } from '../../utils/checks';
import type { Business, BusinessDocument, VerificationStatus } from '../../types/trust';

type Tab = 'queue' | 'info' | 'verified' | 'closed' | 'all';
type Action = 'reject' | 'info' | 'suspend' | 'restore' | null;

const tabMatch: Record<Tab, (s: VerificationStatus) => boolean> = {
  queue: (s) => s === 'review',
  info: (s) => s === 'info',
  verified: (s) => s === 'verified',
  closed: (s) => s === 'rejected' || s === 'suspended',
  all: () => true
};

export function AdminBusinesses() {
  const { businesses, saveBusiness, reports, disputes, notify } = useTrust();
  const { permissions, log, session } = useAdminSession();
  const { audit } = useAdminData();
  const canAct = permissions.verifyBusinesses;
  const [tab, setTab] = useState<Tab>('queue');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [action, setAction] = useState<Action>(null);
  const open = businesses.find((b) => b.id === openId) ?? null;

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return businesses.
    filter((b) => tabMatch[tab](b.verification) && b.verification !== 'none').
    filter((b) => !term || `${b.name} ${b.regNumber} ${b.owner} ${b.category}`.toLowerCase().includes(term)).
    sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
  }, [businesses, tab, q]);

  const count = (t: Tab) => businesses.filter((b) => tabMatch[t](b.verification) && b.verification !== 'none').length;

  const apply = (b: Business, patch: Partial<Business>, actionText: string, notice?: {title: string;body: string;}) => {
    saveBusiness({ ...b, ...patch });
    log('trust', actionText, `${b.name} (${b.regNumber})`);
    if (notice && b.id === MY_BUSINESS_ID) notify({ category: 'verification', ...notice, to: '/business/verification' });
  };

  const approve = (b: Business) => {
    if (b.documents.some((d) => d.status === 'rejected')) {
      toast.error('A document is marked rejected', { description: 'Accept every document or request new ones first.' });
      return;
    }
    const now = new Date().toISOString();
    const certificateId = b.certificateId ?? `PC-${b.tier === 'Basic Verification' ? 'BV' : 'VB'}-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900000) + 100000)}`;
    apply(
      b,
      { verification: 'verified', verifiedAt: b.verifiedAt ?? now, lastVerifiedAt: now, certificateId, infoRequest: undefined, documents: b.documents.map((d) => ({ ...d, status: 'accepted' })), score: Math.max(b.score, 70) },
      `Approved verification · ${b.tier}`,
      { title: 'You’re PadiCheck Verified', body: `Your certificate ${certificateId} and QR code are ready.` }
    );
    track('business_verification_completed', { tier: b.tier });
    toast.success(`${b.name} is now verified`);
  };

  const setDoc = (b: Business, doc: BusinessDocument, status: BusinessDocument['status']) => {
    saveBusiness({ ...b, documents: b.documents.map((d) => d.kind === doc.kind ? { ...d, status } : d) });
    log('trust', `Marked document ${status}`, `${b.name} · ${doc.kind}`);
  };

  const history = open ? audit.filter((a) => a.category === 'trust' && a.detail?.includes(open.name)).slice(0, 8) : [];
  const bizReports = open ? reports.filter((r) => r.entityName === open.name) : [];
  const bizDisputes = open ? disputes.filter((d) => d.businessId === open.id) : [];

  return (
    <>
      <AdminPageHeader title="Businesses" subtitle="Verification queue, verified businesses and suspensions" />
      <div className="space-y-4 px-4 md:px-8">
        {!canAct && <LockedNotice text="Your role can view businesses but can’t change verification." />}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SegmentedTabs
            label="Verification status"
            value={tab}
            onChange={setTab}
            tabs={[
            { id: 'queue', label: 'In review', count: count('queue') },
            { id: 'info', label: 'Info requested', count: count('info') },
            { id: 'verified', label: 'Verified', count: count('verified') },
            { id: 'closed', label: 'Rejected & suspended', count: count('closed') },
            { id: 'all', label: 'All' }]
            } />
          
          <label className="relative lg:ml-auto lg:w-72">
            <span className="sr-only">Search businesses</span>
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, RC number or owner" className="h-11 w-full rounded-2xl bg-surface pl-10 pr-4 text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-brand" />
          </label>
        </div>

        {list.length === 0 ?
        <StateView kind="empty" title={tab === 'queue' ? 'The verification queue is clear' : 'No businesses here'} body={q ? 'Try a different search.' : undefined} /> :

        <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface">
            {list.map((b) => {
            const meta = verificationStatusMeta[b.verification];
            return (
              <li key={b.id}>
                  <button type="button" onClick={() => setOpenId(b.id)} className="flex min-h-[72px] w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-canvas">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft font-bold text-brand-dark" aria-hidden="true">
                      {b.name[0]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{b.name}</span>
                      <span className="block truncate text-sm text-muted">
                        {b.regNumber} · {b.category} · {b.tier}
                      </span>
                    </span>
                    <span className="hidden text-sm text-muted md:block">{b.submittedAt ? `Submitted ${formatWhen(b.submittedAt)}` : b.lastVerifiedAt ? `Verified ${formatDate(b.lastVerifiedAt)}` : ''}</span>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.soft}`}>{meta.label.replace('PadiCheck ', '')}</span>
                  </button>
                </li>);

          })}
          </ul>
        }
      </div>

      <BottomSheet
        open={open !== null}
        onClose={() => setOpenId(null)}
        title={open?.name ?? ''}
        description={open ? `${open.regNumber} · owner ${open.owner}` : undefined}
        footer={
        open && canAct ?
        <div className="grid grid-cols-2 gap-2">
              {(open.verification === 'review' || open.verification === 'info') &&
          <>
                  <button type="button" onClick={() => approve(open)} className="col-span-2 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand font-semibold text-white hover:bg-brand-dark">
                    <BadgeCheckIcon className="h-5 w-5" aria-hidden="true" /> Approve verification
                  </button>
                  <button type="button" onClick={() => setAction('info')} className="h-12 rounded-2xl font-semibold text-ink ring-1 ring-line hover:bg-canvas">
                    Request information
                  </button>
                  <button type="button" onClick={() => setAction('reject')} className="h-12 rounded-2xl font-semibold text-danger ring-1 ring-line hover:bg-danger-soft">
                    Reject
                  </button>
                </>
          }
              {open.verification === 'verified' &&
          <button type="button" onClick={() => setAction('suspend')} className="col-span-2 h-12 rounded-2xl font-semibold text-danger ring-1 ring-line hover:bg-danger-soft">
                  Suspend verification
                </button>
          }
              {(open.verification === 'suspended' || open.verification === 'rejected') &&
          <button type="button" onClick={() => setAction('restore')} className="col-span-2 h-12 rounded-2xl bg-brand font-semibold text-white">
                  {open.verification === 'suspended' ? 'Restore verification' : 'Reopen for review'}
                </button>
          }
            </div> :
        undefined
        }>
        
        {open &&
        <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
            ['Status', verificationStatusMeta[open.verification].label],
            ['Plan', open.tier],
            ['Trust Score', `${open.score} / 100`],
            ['Location', open.location],
            ['Website', open.website],
            ['Phone', open.phone]].
            map(([k, v]) =>
            <div key={k} className="min-w-0">
                  <dt className="text-muted">{k}</dt>
                  <dd className="break-words font-medium text-ink">{v}</dd>
                </div>
            )}
            </dl>
            {open.infoRequest && <p className="rounded-2xl bg-caution-soft p-3 text-sm text-caution">Last message to business: {open.infoRequest}</p>}

            <section>
              <h3 className="text-sm font-semibold text-ink">Documents</h3>
              {open.documents.length === 0 ?
            <p className="mt-2 text-sm text-muted">No documents uploaded.</p> :

            <ul className="mt-2 divide-y divide-line rounded-2xl bg-canvas">
                  {open.documents.map((d) =>
              <li key={d.kind} className="flex items-center gap-3 px-4 py-3">
                      <FileTextIcon className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-ink">{d.kind}</span>
                        <span className="block truncate text-sm text-muted">{d.name}</span>
                      </span>
                      <span className={`text-xs font-semibold capitalize ${d.status === 'accepted' ? 'text-brand-dark' : d.status === 'rejected' ? 'text-danger' : 'text-muted'}`}>{d.status}</span>
                      {canAct && open.verification !== 'verified' &&
                <span className="flex gap-1">
                          <button type="button" aria-label={`Accept ${d.kind}`} onClick={() => setDoc(open, d, 'accepted')} className="grid h-10 w-10 place-items-center rounded-xl text-brand-dark hover:bg-brand-soft">
                            <CheckIcon className="h-4 w-4" />
                          </button>
                          <button type="button" aria-label={`Reject ${d.kind}`} onClick={() => setDoc(open, d, 'rejected')} className="grid h-10 w-10 place-items-center rounded-xl text-danger hover:bg-danger-soft">
                            <XIcon className="h-4 w-4" />
                          </button>
                        </span>
                }
                    </li>
              )}
                </ul>
            }
            </section>

            <section className="grid grid-cols-2 gap-3 text-sm">
              <Link to="/admin/reports" className="rounded-2xl bg-canvas p-3 hover:bg-line/50">
                <span className="block text-muted">Reports</span>
                <span className="text-lg font-bold text-ink">{bizReports.length}</span>
              </Link>
              <Link to="/admin/disputes" className="rounded-2xl bg-canvas p-3 hover:bg-line/50">
                <span className="block text-muted">Disputes</span>
                <span className="text-lg font-bold text-ink">{bizDisputes.length}</span>
              </Link>
            </section>

            {open.verification === 'verified' &&
          <Link to={`/b/${open.slug}`} target="_blank" className="inline-flex h-11 items-center gap-2 text-sm font-semibold text-brand-dark">
                <ExternalLinkIcon className="h-4 w-4" aria-hidden="true" /> View public profile
              </Link>
          }

            <section>
              <h3 className="text-sm font-semibold text-ink">Audit history</h3>
              {history.length === 0 ?
            <p className="mt-2 text-sm text-muted">No admin actions yet.</p> :

            <ol className="mt-2 space-y-2 text-sm">
                  {history.map((h) =>
              <li key={h.id} className="flex gap-2">
                      <span className="shrink-0 text-muted">{formatWhen(h.at)}</span>
                      <span className="text-ink">
                        {h.action} — {h.actor}
                      </span>
                    </li>
              )}
                </ol>
            }
            </section>
            <p className="text-xs text-muted">Signed in as {session?.name}. Every decision is logged and the business is told the outcome.</p>
          </div>
        }
      </BottomSheet>

      <ReasonSheet
        open={action === 'info'}
        onClose={() => setAction(null)}
        title="Request more information"
        description="The business sees this message and can resubmit."
        label="What do they need to provide?"
        placeholder="e.g. The utility bill is older than 3 months. Upload one from July or later."
        confirmLabel="Send request"
        onConfirm={(reason) => {
          if (open) apply(open, { verification: 'info', infoRequest: reason }, 'Requested more information', { title: 'More information needed', body: reason });
          setAction(null);
          toast.success('Request sent to the business');
        }} />
      
      <ReasonSheet
        open={action === 'reject'}
        onClose={() => setAction(null)}
        title="Reject verification"
        description="The business can fix the issue and apply again."
        confirmLabel="Reject"
        tone="danger"
        onConfirm={(reason) => {
          if (open) apply(open, { verification: 'rejected', infoRequest: reason }, 'Rejected verification', { title: 'Verification not approved', body: reason });
          setAction(null);
          toast('Verification rejected');
        }} />
      
      <ReasonSheet
        open={action === 'suspend'}
        onClose={() => setAction(null)}
        title="Suspend verification"
        description="The badge, certificate and QR immediately show as not valid."
        confirmLabel="Suspend"
        tone="danger"
        onConfirm={(reason) => {
          if (open) apply(open, { verification: 'suspended', infoRequest: reason }, 'Suspended verification', { title: 'Verification suspended', body: reason });
          setAction(null);
          toast('Verification suspended');
        }} />
      
      <ReasonSheet
        open={action === 'restore'}
        onClose={() => setAction(null)}
        title={open?.verification === 'suspended' ? 'Restore verification' : 'Reopen for review'}
        confirmLabel="Confirm"
        onConfirm={(reason) => {
          if (open) {
            const restored = open.verification === 'suspended';
            apply(open, { verification: restored ? 'verified' : 'review', infoRequest: undefined, lastVerifiedAt: restored ? new Date().toISOString() : open.lastVerifiedAt }, restored ? `Restored verification — ${reason}` : `Reopened for review — ${reason}`, restored ? { title: 'Verification restored', body: 'Your badge and certificate are valid again.' } : undefined);
          }
          setAction(null);
          toast.success('Done');
        }} />
      
    </>);

}