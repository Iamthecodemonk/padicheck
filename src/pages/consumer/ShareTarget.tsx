import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRightIcon, FileTextIcon, ImageIcon, InboxIcon, Link2Icon, LoaderCircleIcon, TextIcon } from 'lucide-react';
import { PageHeader } from '../../components/consumer/PageHeader';
import { anyCheck, checkTypes } from '../../data/checkTypes';
import { detectFileKind, domainOf, extractUrl, formatBytes, processorFor } from '../../utils/checks';
import { putSharedFiles, readShareInbox } from '../../utils/shareInbox';
import type { CheckType } from '../../types/check';

export function ShareTarget() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const title = params.get('title') ?? '';
  const text = params.get('text') ?? '';
  const rawUrl = params.get('url') ?? '';
  const fileCount = Number(params.get('files') ?? 0);

  const url = useMemo(() => {
    const normalized = rawUrl.replace(/^web\+padicheck:\/*/i, 'https://');
    return normalized ? extractUrl(normalized) : extractUrl(`${title} ${text}`);
  }, [rawUrl, title, text]);
  const sharedText = [title, text].filter(Boolean).join(' — ').replace(url ?? '', '').trim();

  const [files, setFiles] = useState<File[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(fileCount > 0);
  const [type, setType] = useState<CheckType>(url ? 'link' : 'any');

  useEffect(() => {
    if (fileCount <= 0) return;
    readShareInbox(fileCount).then((received) => {
      setFiles(received);
      setLoadingFiles(false);
    });
  }, [fileCount]);

  const kind = files.length ? detectFileKind(files[0]) : null;
  const inputKind: 'files' | 'link' | 'text' | null = files.length ? 'files' : url ? 'link' : sharedText ? 'text' : null;
  const route =
  inputKind === 'files' ? processorFor(kind ?? 'unsupported') : inputKind === 'link' ? 'Link analyzer' : 'Opportunity detection';

  const analyze = () => {
    if (inputKind === 'files') {
      putSharedFiles(files);
      navigate(`/check/${kind === 'pdf' || kind === 'document' ? type === 'any' ? 'contract' : type : type}?mode=upload`, { replace: true });
    } else if (inputKind === 'link' && url) {
      navigate(`/check/${type === 'any' ? 'link' : type}?mode=link&url=${encodeURIComponent(url)}`, { replace: true });
    } else {
      navigate(`/check/${type}?mode=text&text=${encodeURIComponent(sharedText)}`, { replace: true });
    }
  };

  if (loadingFiles) {
    return (
      <>
        <PageHeader back="/" title="Shared to PadiCheck" />
        <p className="flex items-center justify-center gap-2 pt-20 text-muted" role="status">
          <LoaderCircleIcon className="h-5 w-5 animate-spin" aria-hidden="true" /> Receiving files…
        </p>
      </>);

  }

  if (!inputKind) {
    return (
      <>
        <PageHeader back="/" title="Shared to PadiCheck" />
        <div className="mx-auto flex max-w-md flex-col items-center px-6 pt-14 text-center">
          <InboxIcon className="h-10 w-10 text-muted" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-semibold text-ink">Nothing was shared</h2>
          <p className="mt-2 text-muted">In any app, tap Share and choose PadiCheck to send a link, screenshot or document here.</p>
          <Link to="/" className="mt-6 inline-flex h-12 items-center rounded-2xl bg-ink px-6 font-semibold text-white">
            Go to Home
          </Link>
        </div>
      </>);

  }

  const choices = [anyCheck, ...checkTypes];

  return (
    <>
      <PageHeader back="/" title="Shared to PadiCheck" />
      <div className="mx-auto w-full max-w-2xl px-4 lg:px-10">
        <section aria-label="What you shared" className="rounded-3xl bg-surface p-5">
          {inputKind === 'link' && url &&
          <div className="flex items-start gap-3">
              <Link2Icon className="mt-1 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-lg font-semibold text-ink">{domainOf(url)}</p>
                <p className="break-all text-sm text-muted">{url}</p>
              </div>
            </div>
          }
          {sharedText &&
          <div className={`flex items-start gap-3 ${inputKind === 'link' ? 'mt-4 border-t border-line pt-4' : ''}`}>
              <TextIcon className="mt-1 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
              <p className="line-clamp-4 text-[15px] text-ink">{sharedText}</p>
            </div>
          }
          {inputKind === 'files' &&
          <ul className="space-y-3">
              {files.map((f) => {
              const Icon = detectFileKind(f) === 'image' ? ImageIcon : FileTextIcon;
              return (
                <li key={f.name} className="flex items-center gap-3">
                    <Icon className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate font-medium text-ink">{f.name}</span>
                    <span className="text-sm text-muted">{formatBytes(f.size)}</span>
                  </li>);

            })}
            </ul>
          }
          <p className="mt-4 rounded-2xl bg-canvas px-4 py-3 text-sm text-muted">
            We’ll use <strong className="font-semibold text-ink">{route}</strong>, then work out what kind of opportunity it is.
          </p>
        </section>

        <h2 className="mt-7 text-sm font-medium text-muted">What is it? (optional)</h2>
        <div className="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {choices.map((c) =>
          <button
            key={c.id}
            type="button"
            aria-pressed={type === c.id}
            onClick={() => setType(c.id)}
            className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-[15px] font-medium transition-colors ${
            type === c.id ? 'bg-ink text-white' : 'bg-surface text-ink ring-1 ring-line hover:bg-canvas'}`
            }>
            
              <c.icon className="h-4 w-4" aria-hidden="true" />
              {c.id === 'any' ? 'Auto-detect' : c.label}
            </button>
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur-md lg:static lg:mx-auto lg:mt-8 lg:max-w-2xl lg:border-0 lg:bg-transparent lg:px-10">
        <button type="button" onClick={analyze} className="mx-auto flex h-12 w-full max-w-xl items-center justify-center gap-2 rounded-2xl bg-brand font-semibold text-white transition-colors hover:bg-brand-dark">
          {inputKind === 'link' ? 'Analyze this link' : inputKind === 'files' ? `Analyze ${files.length > 1 ? 'these files' : 'this file'}` : 'Analyze this'}
          <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </>);

}