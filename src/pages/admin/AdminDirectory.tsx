import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ExternalLinkIcon, SearchIcon } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { LockedNotice } from '../../components/admin/LockedNotice';
import { SegmentedTabs } from '../../components/admin/SegmentedTabs';
import { ReasonSheet } from '../../components/admin/trust/ReasonSheet';
import { StateView } from '../../components/trust/StateView';
import { useAdminSession } from '../../contexts/AdminSessionContext';
import { useTrust } from '../../contexts/TrustContext';
import { DIRECTORY_FEE } from '../../data/directory';
import { MY_BUSINESS_ID } from '../../data/businesses';
import { track } from '../../utils/analytics';
import { formatDate, formatNaira, formatWhen } from '../../utils/checks';
import { isListed, YEAR_MS } from '../../utils/directory';
import type { Business } from '../../types/trust';

type Tab = 'pending' | 'live' | 'expiring' | 'closed';
type Action = 'reject' | 'suspend' | null;

const DAY = 86_400_000;

/** Moderation queue for paid directory listings (₦6,000 / year). */
export function AdminDirectory() {
  const { businesses, saveBusiness, notify } = useTrust();
  const { permissions, log } = useAdminSession();
  const canAct = permissions.verifyBusinesses;
  const [tab, setTab] = useState<Tab>('pending');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [action, setAction] = useState<Action>(null);
  const open = businesses.find((b) => b.id === openId) ?? null;

  const withListing = businesses.filter((b) => b.directory);
  const match = (b: Business, t: Tab) => {
    const d = b.directory!;
    const left = d.expiresAt ? new Date(d.expiresAt).getTime() - Date.now() : Infinity;
    if (t === 'pending') return d.status === 'pending';
    if (t === 'live') return isListed(b);
    if (t === 'expiring') return d.status === 'active' && left < 30 * DAY;
    return d.status === 'rejected' || d.status === 'suspended' || d.status === 'active' && left <= 0;
  };
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return withListing.filter((b) => match(b, tab)).filter((b) => !term || `${b.name} ${b.owner} ${b.category} ${b.location}`.toLowerCase().includes(term));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withListing, tab, q]);
  const live = withListing.filter((b) => isListed(b));
  const revenue = withListing.filter((b) => b.directory?.paidAt && b.directory.status !== 'rejected').length * DIRECTORY_FEE;

  const tell = (b: Business, title: string, body: string) => {
    if (b.id === MY_BUSINESS_ID) notify({ category: 'verification', title, body, to: '/business/listing' });
  };

  const approve = (b: Business) => {
    const now = new Date().toISOString();
    saveBusiness({ ...b, directory: { ...b.directory!, status: 'active', approvedAt: now, expiresAt: new Date(Date.now() + YEAR_MS).toISOString(), note: undefined } });
    log('trust', 'Approved directory listing', `${b.name} · ${b.category}`);
    tell(b, 'Your listing is live', `${b.name} now appears in Explore Businesses under ${b.category}.`);
    track('directory_listing_approved', { category: b.category });
    toast.success(`${b.name} is live in the directory`);
  };

  const count = (t: Tab) => withListing.filter((b) => match(b, t)).length;

  return (
    <>
      <AdminPageHeader title="Directory" subtitle={`Paid business listings · ${formatNaira(DIRECTORY_FEE)} per year`} />
      <div className="space-y-4 px-4 md:px-8">
        {!canAct && <LockedNotice text="Your role can view listings but can’t approve them." />}
        <dl className="grid grid-cols-3 gap-3">
          {[
          ['Awaiting approval', count('pending')],
          ['Live listings', live.length],
          ['Listing revenue', formatNaira(revenue)]].
          map(([k, v]) =>
          <div key={k} className="rounded-3xl bg-surface p-4 md:p-5">
              <dt className="text-sm text-muted">{k}</dt>
              <dd className="mt-1 text-xl font-bold text-ink md:text-2xl">{v}</dd>
            </div>
          )}
        </dl>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SegmentedTabs
            label="Listing status"
            value={tab}
            onChange={setTab}
            tabs={[
            { id: 'pending', label: 'To approve', count: count('pending') },
            { id: 'live', label: 'Live', count: count('live') },
            { id: 'expiring', label: 'Expiring soon', count: count('expiring') },
            { id: 'closed', label: 'Rejected & expired', count: count('closed') }]
            } />
          
          <label className="relative lg:ml-auto lg:w-72">
            <span className="sr-only">Search listings</span>
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Business, owner or city" className="h-11 w-full rounded-2xl bg-surface pl-10 pr-4 text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-brand" />
          </label>
        </div>
        {list.length === 0 ?
        <StateView kind="empty" title={tab === 'pending' ? 'No listings waiting for approval' : 'No listings here'} /> :

        <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface">
            {list.map((b) =>
          <li key={b.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <button type="button" onClick={() => setOpenId(b.id)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-semibold text-ink">{b.name}</span>
                  <span className="block truncate text-sm text-muted">
                    {b.category} · {b.location} · {b.owner}
                  </span>
                  <span className="block text-xs text-muted">
                    {b.directory!.status === 'pending' ? `Paid ${formatWhen(b.directory!.submittedAt)}` : b.directory!.expiresAt ? `Until ${formatDate(b.directory!.expiresAt)}` : ''}
                  </span>
                </button>
                {canAct && b.directory!.status === 'pending' ?
            <span className="flex w-full gap-2 sm:w-auto">
                    <button type="button" onClick={() => approve(b)} className="h-11 flex-1 rounded-xl bg-brand px-4 text-sm font-semibold text-white sm:flex-none">
                      Approve
                    </button>
                    <button
                type="button"
                onClick={() => {
                  setOpenId(b.id);
                  setAction('reject');
                }}
                className="h-11 flex-1 rounded-xl px-4 text-sm font-semibold text-danger ring-1 ring-line hover:bg-danger-soft sm:flex-none">
                
                      Reject
                    </button>
                  </span> :

            <button type="button" onClick={() => setOpenId(b.id)} className="h-11 rounded-xl px-3 text-sm font-semibold text-brand-dark hover:bg-canvas">
                    Details
                  </button>
            }
              </li>
          )}
          </ul>
        }
      </div>

      <BottomSheet
        open={open !== null && action === null}
        onClose={() => setOpenId(null)}
        title={open?.name ?? ''}
        description={open ? `${open.category} · owner ${open.owner}` : undefined}
        footer={
        open && canAct ?
        open.directory?.status === 'pending' ?
        <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setAction('reject')} className="h-12 rounded-2xl font-semibold text-danger ring-1 ring-line">
                  Reject & refund
                </button>
                <button
            type="button"
            onClick={() => {
              approve(open);
              setOpenId(null);
            }}
            className="h-12 rounded-2xl bg-brand font-semibold text-white">
            
                  Approve listing
                </button>
              </div> :
        open.directory?.status === 'active' ?
        <button type="button" onClick={() => setAction('suspend')} className="h-12 w-full rounded-2xl font-semibold text-danger ring-1 ring-line">
                Suspend listing
              </button> :
        open.directory?.status === 'suspended' ?
        <button
          type="button"
          onClick={() => {
            saveBusiness({ ...open, directory: { ...open.directory!, status: 'active', note: undefined } });
            log('trust', 'Restored directory listing', open.name);
            tell(open, 'Listing restored', `${open.name} is visible again.`);
            toast.success('Listing restored');
          }}
          className="h-12 w-full rounded-2xl bg-brand font-semibold text-white">
          
                Restore listing
              </button> :
        undefined :
        undefined
        }>
        
        {open?.directory &&
        <div className="space-y-4">
            <p className="text-ink-soft">{open.description}</p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
            ['Location', open.location],
            ['Phone', open.phone],
            ['Email', open.email],
            ['Website', open.website || '—'],
            ['Registration', open.regNumber || 'Not given'],
            ['Verification', open.verification === 'verified' ? 'Verified' : 'Not verified'],
            ['Payment', open.directory.reference ?? '—'],
            ['Hours', open.directory.hours ?? '—']].
            map(([k, v]) =>
            <div key={k} className="min-w-0">
                  <dt className="text-muted">{k}</dt>
                  <dd className="break-words font-medium text-ink">{v}</dd>
                </div>
            )}
            </dl>
            {open.directory.note && <p className="rounded-2xl bg-caution-soft p-3 text-sm text-caution">Note: {open.directory.note}</p>}
            <p className="text-xs text-muted">Check the phone, address and social page look genuine before approving. Approval doesn’t verify the business.</p>
            {isListed(open) &&
          <Link to={`/b/${open.slug}`} target="_blank" className="inline-flex h-11 items-center gap-2 text-sm font-semibold text-brand-dark">
                <ExternalLinkIcon className="h-4 w-4" aria-hidden="true" /> View public listing
              </Link>
          }
          </div>
        }
      </BottomSheet>

      <ReasonSheet
        open={action !== null && open !== null}
        onClose={() => setAction(null)}
        title={action === 'reject' ? 'Reject listing' : 'Suspend listing'}
        description={action === 'reject' ? `The owner is told why and refunded ${formatNaira(DIRECTORY_FEE)}.` : 'The listing is hidden from Explore Businesses until restored.'}
        confirmLabel={action === 'reject' ? 'Reject and refund' : 'Suspend'}
        tone="danger"
        onConfirm={(reason) => {
          if (open) {
            const status = action === 'reject' ? 'rejected' : 'suspended';
            saveBusiness({ ...open, directory: { ...open.directory!, status, note: reason } });
            log('trust', action === 'reject' ? 'Rejected directory listing (refund issued)' : 'Suspended directory listing', `${open.name} — ${reason}`);
            tell(open, action === 'reject' ? 'Listing not approved' : 'Listing suspended', reason);
            toast(action === 'reject' ? 'Listing rejected and refunded' : 'Listing suspended');
          }
          setAction(null);
          setOpenId(null);
        }} />
      
    </>);

}