import React from 'react';
import { CameraIcon, ClipboardPasteIcon, Link2Icon, PencilLineIcon, UploadIcon } from 'lucide-react';
import { toast } from 'sonner';
import { AnalysisProgress } from '../../components/check/AnalysisProgress';
import { CameraCapture } from '../../components/check/CameraCapture';
import { ConfirmCheckSheet } from '../../components/check/ConfirmCheckSheet';
import { FileUpload } from '../../components/check/FileUpload';
import { CreditPill } from '../../components/consumer/CreditPill';
import { PageHeader } from '../../components/consumer/PageHeader';
import { useUser } from '../../contexts/UserContext';
import { useCheckFlow } from '../../hooks/useCheckFlow';
import { ACCEPTED_DOCUMENTS, ACCEPTED_UPLOADS, domainOf, looksLikeUrl } from '../../utils/checks';
import type { InputMode } from '../../types/check';

const modeTabs: {id: InputMode;label: string;icon: typeof Link2Icon;}[] = [
{ id: 'link', label: 'Link', icon: Link2Icon },
{ id: 'text', label: 'Describe', icon: PencilLineIcon },
{ id: 'camera', label: 'Camera', icon: CameraIcon },
{ id: 'upload', label: 'Upload', icon: UploadIcon }];


export function CheckFlow() {
  const flow = useCheckFlow();
  const { dataSaver } = useUser();
  const { option } = flow;

  if (flow.analyzing) {
    return (
      <>
        <PageHeader back title="" />
        <AnalysisProgress title={option.longLabel} onDone={flow.finish} />
      </>);

  }

  const pasteUrl = async () => {
    try {
      flow.setUrl((await navigator.clipboard.readText()).trim());
    } catch {
      toast('Tap and hold the field, then choose Paste');
    }
  };

  const costLine =
  <p className="text-sm text-muted">
      Uses <strong className="font-semibold text-ink">{flow.cost} credit{flow.cost > 1 ? 's' : ''}</strong> · You have {flow.credits}
    </p>;

  const continueButton =
  <button
    type="button"
    disabled={!flow.ready}
    onClick={() => flow.setConfirmOpen(true)}
    className="h-12 w-full rounded-2xl bg-brand font-semibold text-white transition-colors hover:bg-brand-dark disabled:bg-line disabled:text-muted">
    
      {flow.online ? 'Continue' : 'Save for later'}
    </button>;

  const focusList =
  <ul className="mt-3 space-y-2.5">
      {option.focusAreas.map((area) =>
    <li key={area} className="flex gap-2.5 text-[15px] text-ink">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
          {area}
        </li>
    )}
    </ul>;


  return (
    <>
      <PageHeader back title={option.longLabel} actions={<CreditPill />} />
      <div className="mx-auto w-full max-w-6xl px-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12 lg:px-10">
        <section aria-label="Add what you want to check">
          <div role="tablist" aria-label="Input type" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
            {modeTabs.map((tab) => {
              const active = flow.mode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => flow.setMode(tab.id)}
                  className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-[15px] font-medium transition-colors ${
                  active ? 'bg-ink text-white' : 'bg-surface text-ink ring-1 ring-line hover:bg-canvas'}`
                  }>
                  
                  <tab.icon className="h-4 w-4" aria-hidden="true" />
                  {tab.label}
                </button>);

            })}
          </div>

          <div className="mt-4" role="tabpanel">
            {flow.mode === 'link' &&
            <div>
                <label htmlFor="check-url" className="text-sm font-medium text-ink">
                  Link to the listing, post or offer
                </label>
                <div className="mt-2 flex items-center gap-2 rounded-2xl bg-surface p-1.5 ring-1 ring-line focus-within:ring-2 focus-within:ring-ink">
                  <input
                  id="check-url"
                  type="url"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  enterKeyHint="go"
                  value={flow.url}
                  onChange={(e) => flow.setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && flow.ready && flow.setConfirmOpen(true)}
                  placeholder="https://"
                  className="h-12 min-w-0 flex-1 bg-transparent px-3 text-[17px] text-ink outline-none placeholder:text-muted/70" />
                
                  <button type="button" onClick={pasteUrl} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-canvas px-3 text-sm font-semibold text-ink hover:bg-line/60">
                    <ClipboardPasteIcon className="h-4 w-4" aria-hidden="true" /> Paste
                  </button>
                </div>
                {flow.url &&
              <p className={`mt-2 text-sm ${looksLikeUrl(flow.url) ? 'text-brand-dark' : 'text-muted'}`}>
                    {looksLikeUrl(flow.url) ? `We’ll check ${domainOf(flow.url)}` : 'That doesn’t look like a link yet'}
                  </p>
              }
              </div>
            }

            {flow.mode === 'text' &&
            <div>
                <label htmlFor="check-text" className="text-sm font-medium text-ink">
                  Describe the opportunity
                </label>
                <textarea
                id="check-text"
                value={flow.text}
                onChange={(e) => flow.setText(e.target.value)}
                rows={6}
                placeholder="What is it, who’s offering it, the price or pay, and how you found it."
                className="mt-2 block w-full resize-none rounded-2xl bg-surface p-4 text-[17px] leading-relaxed text-ink outline-none ring-1 ring-line placeholder:text-muted/70 focus:ring-2 focus:ring-ink" />
              
                <p className="mt-2 text-sm text-muted">More detail gives a more useful report. Your draft is saved on this device.</p>
              </div>
            }

            {flow.mode === 'camera' &&
            <CameraCapture photo={flow.photo} onChange={flow.setPhoto} onUse={() => flow.setConfirmOpen(true)} dataSaver={dataSaver} />
            }

            {flow.mode === 'upload' &&
            <FileUpload
              items={flow.uploads}
              onChange={flow.setUploads}
              accept={option.id === 'contract' ? ACCEPTED_DOCUMENTS : ACCEPTED_UPLOADS}
              formats={option.id === 'contract' ? 'PDF, DOCX or TXT up to 20 MB' : 'JPG, PNG, WEBP, PDF, DOCX or TXT · 20 MB max'}
              dataSaver={dataSaver} />

            }

          </div>

          <div className="mt-8 lg:hidden">
            <h2 className="text-sm font-medium text-muted">What PadiCheck looks at</h2>
            {focusList}
          </div>
        </section>

        <aside className="hidden lg:block">
          <div className="sticky top-8 rounded-3xl bg-surface p-6">
            <h2 className="font-semibold text-ink">What PadiCheck looks at</h2>
            {focusList}
            <div className="mt-6 border-t border-line pt-5">
              {costLine}
              <div className="mt-4">{continueButton}</div>
            </div>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-4">
          <div className="min-w-0 flex-1">{costLine}</div>
          <div className="w-40 shrink-0">{continueButton}</div>
        </div>
      </div>

      <ConfirmCheckSheet
        open={flow.confirmOpen}
        onClose={() => flow.setConfirmOpen(false)}
        onConfirm={flow.confirm}
        checkLabel={option.longLabel}
        summary={flow.summary}
        cost={flow.cost}
        credits={flow.credits}
        online={flow.online} />
      
    </>);

}