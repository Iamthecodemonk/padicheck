import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ExternalLinkIcon } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { Field } from '../../components/admin/Field';
import { SegmentedTabs } from '../../components/admin/SegmentedTabs';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { RichText } from '../../components/RichText';
import { useAdminSession } from '../../contexts/AdminSessionContext';
import { usePlatform } from '../../contexts/PlatformContext';
import { usePwa } from '../../contexts/PwaContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { formatWhen } from '../../utils/checks';
import { inputClass, primaryButton, secondaryButton, textareaClass } from '../../utils/formStyles';

export function AdminContentEditor() {
  const { id } = useParams<{id: string;}>();
  const navigate = useNavigate();
  const { docs, saveDraft, publishDoc, discardDraft, removeDoc } = usePlatform();
  const { session, permissions, log } = useAdminSession();
  const { online } = usePwa();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const doc = docs.find((d) => d.id === id);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [text, setText] = useState('');
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [confirm, setConfirm] = useState<'publish' | 'delete' | null>(null);

  useEffect(() => {
    if (!doc) return;
    setTitle(doc.title);
    setSummary(doc.summary);
    setText(doc.draft ?? doc.body);
    // Only reset when switching documents, not on every save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id]);

  if (!doc) return <Navigate to="/admin/cms" replace />;

  const canEdit = permissions.manageContent && online;
  const by = session?.name ?? 'Admin';
  const isCopy = doc.kind === 'copy';
  const dirty = title !== doc.title || summary !== doc.summary || text !== (doc.draft ?? doc.body);
  const hasUnpublished = doc.draft !== null || dirty;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  const save = () => {
    saveDraft(doc.id, { title: title.trim() || doc.title, summary: summary.trim(), draft: text }, by);
    log('content', `Saved draft of “${title}”`);
    toast.success('Draft saved', { description: 'Not visible to users until you publish.' });
  };

  const publish = () => {
    saveDraft(doc.id, { title: title.trim() || doc.title, summary: summary.trim(), draft: text }, by);
    publishDoc(doc.id, by);
    log('content', `Published “${title}”`, `Version ${doc.version + 1}`);
    setConfirm(null);
    toast.success(`Published v${doc.version + 1}`, { description: doc.kind === 'legal' ? 'Users will see the update next time they open it.' : 'Live in the app now.' });
  };

  const editor =
  <div className="space-y-4">
      {!isCopy &&
    <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} className={inputClass} />
          </Field>
          <Field label="Summary">
            <input value={summary} onChange={(e) => setSummary(e.target.value)} disabled={!canEdit} className={inputClass} />
          </Field>
        </div>
    }
      <Field label={isCopy ? 'Text' : 'Content'} hint={isCopy ? `${text.length} characters` : `${words} words · Use “## ” for headings and “- ” for bullet points`}>
        <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={!canEdit}
        rows={isCopy ? 3 : 18}
        className={`${textareaClass} ${isCopy ? '' : 'font-mono text-[15px]'}`} />
      
      </Field>
    </div>;


  const preview =
  <div className="rounded-3xl bg-canvas p-5 ring-1 ring-line md:p-6">
      <p className="text-xs font-semibold text-muted">Preview</p>
      {isCopy ?
    <p className="mt-3 text-2xl font-bold leading-tight text-ink">{text}</p> :

    <>
          <h2 className="mt-2 text-2xl font-bold text-ink">{title}</h2>
          <p className="mb-5 text-sm text-muted">Last updated {formatWhen(new Date().toISOString())}</p>
          <RichText text={text || 'Start writing…'} />
        </>
    }
    </div>;


  return (
    <>
      <AdminPageHeader
        back="/admin/cms"
        title={doc.title}
        subtitle={`${doc.version > 0 ? `Live version ${doc.version}` : 'Never published'} · last edited by ${doc.updatedBy}, ${formatWhen(doc.updatedAt)}`}
        actions={
        doc.kind !== 'copy' &&
        doc.version > 0 &&
        <Link to={`/legal/${doc.slug}`} target="_blank" className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-ink ring-1 ring-line hover:bg-surface">
              <ExternalLinkIcon className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">View live</span>
            </Link>

        } />
      
      <div className="px-4 pb-28 md:px-8 lg:pb-0">
        {hasUnpublished &&
        <p className="mb-4 rounded-2xl bg-caution-soft px-4 py-3 text-sm text-caution">
            {dirty ? 'You have unsaved changes.' : 'This draft hasn’t been published yet.'} Users still see {doc.version > 0 ? `version ${doc.version}` : 'nothing'}.
          </p>
        }
        {isDesktop ?
        <div className="grid grid-cols-2 gap-6">
            <div className="rounded-3xl bg-surface p-5">{editor}</div>
            {preview}
          </div> :

        <>
            <SegmentedTabs label="Editor view" value={view} onChange={setView} tabs={[{ id: 'edit', label: 'Edit' }, { id: 'preview', label: 'Preview' }]} />
            <div className="mt-4">{view === 'edit' ? <div className="rounded-3xl bg-surface p-4">{editor}</div> : preview}</div>
          </>
        }

        {canEdit &&
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+62px)] z-30 border-t border-line bg-surface/95 p-3 backdrop-blur-md md:bottom-0 lg:static lg:mt-6 lg:border-0 lg:bg-transparent lg:p-0">
            <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2">
              {doc.draft !== null && doc.version > 0 &&
            <button
              type="button"
              onClick={() => {
                discardDraft(doc.id);
                setText(doc.body);
                toast('Draft discarded');
              }}
              className="h-12 rounded-2xl px-4 text-sm font-semibold text-muted hover:text-ink">
              
                  Discard draft
                </button>
            }
              {doc.kind !== 'copy' &&
            <button type="button" onClick={() => setConfirm('delete')} className="h-12 rounded-2xl px-4 text-sm font-semibold text-danger hover:bg-danger-soft">
                  Delete
                </button>
            }
              <span className="flex-1" />
              <button type="button" onClick={save} disabled={!dirty} className={secondaryButton}>
                Save draft
              </button>
              <button type="button" onClick={() => setConfirm('publish')} disabled={!hasUnpublished || !text.trim()} className={primaryButton}>
                Publish
              </button>
            </div>
          </div>
        }
      </div>

      <ConfirmSheet
        open={confirm === 'publish'}
        onClose={() => setConfirm(null)}
        onConfirm={publish}
        title={`Publish version ${doc.version + 1}?`}
        description={doc.kind === 'legal' ? 'This replaces the live policy. The change is logged with your name.' : 'This replaces what users see in the app right now.'}
        confirmLabel="Publish" />
      
      <ConfirmSheet
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          removeDoc(doc.id);
          log('content', `Deleted “${doc.title}”`);
          toast.success('Page deleted');
          navigate('/admin/cms', { replace: true });
        }}
        title={`Delete “${doc.title}”?`}
        description="Users will no longer be able to open it. This can’t be undone."
        confirmLabel="Delete"
        tone="danger" />
      
    </>);

}