import React, { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CircleCheckIcon, LoaderCircleIcon, PaperclipIcon, XIcon } from 'lucide-react';
import { PageHeader } from '../../components/consumer/PageHeader';
import { Field } from '../../components/admin/Field';
import { useTrust } from '../../contexts/TrustContext';
import { useUser } from '../../contexts/UserContext';
import { entityTypeById, entityTypes, reportCategories } from '../../data/entityTypes';
import { track } from '../../utils/analytics';
import { chipClass, inputClass, primaryButton, textareaClass } from '../../utils/formStyles';
import { submit } from '../../utils/trustApi';
import type { EntityType, UserReport } from '../../types/trust';

const MAX_FILE_MB = 10;

export function ReportIssue() {
  const [params] = useSearchParams();
  const { getEntity, addReport, notify } = useTrust();
  const { session } = useUser();
  const entity = getEntity(params.get('entity') ?? '');
  const [name, setName] = useState(entity?.name ?? params.get('name') ?? '');
  const [type, setType] = useState<EntityType>(entity?.type ?? params.get('type') as EntityType ?? 'website');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [contact, setContact] = useState(session?.email ?? '');
  const [declared, setDeclared] = useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [done, setDone] = useState<UserReport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const errors = {
    name: name.trim().length < 2 ? 'Tell us what you’re reporting' : '',
    category: !category ? 'Choose a category' : '',
    description: description.trim().length < 20 ? 'Describe what happened in at least 20 characters' : '',
    declared: !declared ? 'Please confirm the declaration' : ''
  };
  const valid = Object.values(errors).every((e) => !e);

  const send = async () => {
    setTried(true);
    setFailure('');
    if (!valid) return;
    setBusy(true);
    try {
      await submit(null);
      const report = addReport({
        entityId: entity?.id ?? `e-${type}-${name.toLowerCase().replace(/\W+/g, '-')}`,
        entityName: name.trim(),
        entityType: type,
        category,
        description: description.trim() + (evidence.trim() ? `\n\nEvidence: ${evidence.trim()}` : ''),
        evidence: files.map((f) => f.name),
        reporter: session?.name ?? 'Anonymous',
        contact: contact.trim() || undefined,
        risk: /fraud|paid|money|transfer/i.test(description) ? 'high' : 'medium'
      });
      notify({ category: 'report', title: `Report ${report.id} received`, body: 'We’ll update you as a moderator reviews it.', to: '/my-reports' });
      track('report_submitted', { type, category });
      setDone(report);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'We couldn’t send your report. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <>
        <PageHeader title="Report an issue" back="/" />
        <div className="mx-auto max-w-lg px-4 py-10 text-center" role="status">
          <CircleCheckIcon className="mx-auto h-14 w-14 text-brand" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-bold text-ink">Report received.</h1>
          <p className="mt-2 text-ink-soft">
            Reference <strong className="text-ink">{done.id}</strong>. A moderator will review your evidence — usually within 48 hours. Reports only affect a score once they’ve been reviewed.
          </p>
          <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link to="/my-reports" className={primaryButton}>
              Track my reports
            </Link>
            <Link to="/verify" className="inline-flex h-12 items-center justify-center rounded-2xl px-5 font-semibold text-ink ring-1 ring-line">
              Start a check
            </Link>
          </div>
        </div>
      </>);

  }

  return (
    <>
      <PageHeader title="Report an issue" back />
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="mx-auto w-full max-w-2xl space-y-5 px-4 pb-12">
        
        <p className="text-ink-soft">Your report helps protect others. Be factual — reports are reviewed by people, and the other party may be able to respond.</p>

        <Field label="What are you reporting?" error={tried ? errors.name : undefined}>
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={Boolean(entity)} className={inputClass} placeholder="Business, phone, website, listing…" />
        </Field>
        {!entity &&
        <fieldset>
            <legend className="text-sm font-medium text-ink">Type</legend>
            <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
              {entityTypes.map((t) =>
            <button key={t.id} type="button" aria-pressed={type === t.id} onClick={() => setType(t.id)} className={chipClass(type === t.id)}>
                  {t.label}
                </button>
            )}
            </div>
          </fieldset>
        }
        <fieldset>
          <legend className="text-sm font-medium text-ink">Category</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {reportCategories.map((c) =>
            <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={chipClass(category === c)}>
                {c}
              </button>
            )}
          </div>
          {tried && errors.category && <p className="mt-1.5 text-sm text-danger">{errors.category}</p>}
        </fieldset>
        <Field label="What happened?" error={tried ? errors.description : undefined} hint={`${description.length}/1000`}>
          <textarea rows={5} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} className={textareaClass} placeholder={`e.g. I paid for a ${entityTypeById(type)?.label.toLowerCase() ?? 'item'} and never received it…`} />
        </Field>
        <Field label="Evidence (optional)" hint="Dates, amounts, transaction references — anything that supports your report">
          <textarea rows={2} value={evidence} onChange={(e) => setEvidence(e.target.value)} className={textareaClass} />
        </Field>

        <div>
          <span className="text-sm font-medium text-ink">Attachments (optional)</span>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,.pdf"
            className="sr-only"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              const tooBig = picked.find((f) => f.size > MAX_FILE_MB * 1024 * 1024);
              if (tooBig) setFailure(`${tooBig.name} is over ${MAX_FILE_MB} MB.`);
              setFiles((l) => [...l, ...picked.filter((f) => f.size <= MAX_FILE_MB * 1024 * 1024)].slice(0, 5));
              e.target.value = '';
            }} />
          
          <button type="button" onClick={() => fileRef.current?.click()} className="mt-1.5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line font-medium text-ink hover:bg-surface">
            <PaperclipIcon className="h-4 w-4" aria-hidden="true" /> Add screenshots or receipts
          </button>
          {files.length > 0 &&
          <ul className="mt-2 space-y-1.5">
              {files.map((f, i) =>
            <li key={f.name + i} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-ink">{f.name}</span>
                  <span className="text-muted">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                  <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((l) => l.filter((_, j) => j !== i))} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:text-ink">
                    <XIcon className="h-4 w-4" />
                  </button>
                </li>
            )}
            </ul>
          }
          <p className="mt-1.5 text-xs text-muted">Images or PDF, up to {MAX_FILE_MB} MB each. Attachments are stored privately and only moderators can open them.</p>
        </div>

        <Field label="How can we reach you? (optional)" hint="Only used by our moderators. Never shared with the other party.">
          <input type="email" value={contact} onChange={(e) => setContact(e.target.value)} className={inputClass} />
        </Field>

        <label className="flex gap-3 rounded-2xl bg-surface p-4">
          <input type="checkbox" checked={declared} onChange={(e) => setDeclared(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[rgb(var(--brand))]" />
          <span className="text-sm text-ink-soft">
            I confirm this report is true to the best of my knowledge, and I understand false reports may lead to my account being restricted.{' '}
            <Link to="/legal/report-dispute-policy" className="font-semibold text-brand-dark underline">
              Report policy
            </Link>
          </span>
        </label>
        {tried && errors.declared && <p className="-mt-3 text-sm text-danger">{errors.declared}</p>}

        {failure &&
        <p role="alert" className="rounded-2xl bg-danger-soft p-4 text-sm text-danger">
            {failure}
          </p>
        }
        <button type="submit" disabled={busy} className={`${primaryButton} w-full sm:w-auto`}>
          {busy && <LoaderCircleIcon className="h-5 w-5 animate-spin" aria-hidden="true" />}
          {busy ? 'Sending…' : 'Submit report'}
        </button>
      </form>
    </>);

}