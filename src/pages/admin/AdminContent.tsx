import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronRightIcon, PlusIcon } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { LockedNotice } from '../../components/admin/LockedNotice';
import { SegmentedTabs } from '../../components/admin/SegmentedTabs';
import { NewDocSheet } from '../../components/admin/content/NewDocSheet';
import { useAdminSession } from '../../contexts/AdminSessionContext';
import { usePlatform } from '../../contexts/PlatformContext';
import { usePwa } from '../../contexts/PwaContext';
import { formatWhen } from '../../utils/checks';
import { primaryButton } from '../../utils/formStyles';
import type { ContentKind } from '../../types/content';

const tabs: {id: ContentKind;label: string;}[] = [
{ id: 'legal', label: 'Terms & policies' },
{ id: 'help', label: 'Help articles' },
{ id: 'copy', label: 'App copy' }];


export function AdminContent() {
  const navigate = useNavigate();
  const { docs, createDoc } = usePlatform();
  const { session, permissions, log } = useAdminSession();
  const { online } = usePwa();
  const [tab, setTab] = useState<ContentKind>('legal');
  const [newOpen, setNewOpen] = useState(false);
  const list = docs.filter((d) => d.kind === tab);
  const drafts = docs.filter((d) => d.draft !== null).length;
  const canEdit = permissions.manageContent && online;

  return (
    <>
      <AdminPageHeader
        title="CMS & Policies"
        subtitle={drafts > 0 ? `${drafts} unpublished draft${drafts > 1 ? 's' : ''}` : 'Everything is published'}
        actions={
        canEdit && tab !== 'copy' &&
        <button type="button" onClick={() => setNewOpen(true)} className={`${primaryButton} h-11 px-4`}>
              <PlusIcon className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">New page</span>
            </button>

        } />
      
      <div className="px-4 md:px-8">
        {!permissions.manageContent && <LockedNotice text="View only — editing needs the “Edit content & policies” permission." />}
        <SegmentedTabs label="Content type" value={tab} onChange={setTab} tabs={tabs.map((t) => ({ ...t, count: docs.filter((d) => d.kind === t.id).length }))} />
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-3xl bg-surface lg:max-w-4xl">
          {list.map((d) =>
          <li key={d.id}>
              <Link to={`/admin/cms/${d.id}`} className="flex min-h-[76px] items-center gap-3 px-5 py-3 transition-colors hover:bg-canvas/70">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold text-ink">{d.title}</span>
                    {d.draft !== null && <span className="shrink-0 rounded-full bg-caution-soft px-2 py-0.5 text-xs font-semibold text-caution">{d.version === 0 ? 'Draft' : 'Unpublished edits'}</span>}
                  </span>
                  <span className="block truncate text-sm text-muted">
                    {d.version > 0 ? `v${d.version}` : 'Not published'} · {d.updatedBy} · {formatWhen(d.updatedAt)}
                  </span>
                </span>
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              </Link>
            </li>
          )}
          {list.length === 0 && <li className="px-5 py-10 text-center text-muted">Nothing here yet.</li>}
        </ul>
      </div>
      <NewDocSheet
        open={newOpen}
        kind={tab}
        existingSlugs={docs.map((d) => d.slug)}
        onClose={() => setNewOpen(false)}
        onCreate={(data) => {
          const doc = createDoc(data, session?.name ?? 'Admin');
          log('content', `Created “${doc.title}”`, 'Draft');
          setNewOpen(false);
          toast.success('Draft created');
          navigate(`/admin/cms/${doc.id}`);
        }} />
      
    </>);

}