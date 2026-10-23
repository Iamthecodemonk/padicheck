import React from 'react';
import { DownloadIcon, XIcon } from 'lucide-react';
import { usePwa } from '../../contexts/PwaContext';

interface InstallCardProps {
  context?: string;
  className?: string;
}

// Contextual, non-blocking install invitation. Only renders when the user has engaged
// and has not installed or recently dismissed it.
export function InstallCard({ context, className = '' }: InstallCardProps) {
  const { install, platform, identity, requestInstall } = usePwa();
  if (!install.shouldOffer) return null;

  const heading =
  platform === 'ios' ? `Add ${identity.name} to your Home Screen` : platform === 'desktop' ? 'Install App' : `Install ${identity.name}`;
  const body =
  context ?? (
  platform === 'desktop' ?
  'Open it from your dock or taskbar in its own window.' :
  'Open it like any other app, share links straight into it, and keep saved results offline.');

  return (
    <section aria-label="Install the app" className={`flex items-start gap-3 rounded-3xl bg-ink p-4 text-white ${className}`}>
      <img src={identity.icon} alt="" className="h-12 w-12 shrink-0 rounded-2xl bg-white object-cover" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{heading}</p>
        <p className="mt-0.5 text-sm text-navy-text">{body}</p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={requestInstall}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-bright px-4 text-sm font-semibold text-navy transition-colors hover:bg-white">
            
            <DownloadIcon className="h-4 w-4" />
            {platform === 'ios' ? 'Show me how' : 'Install'}
          </button>
          <button type="button" onClick={() => install.dismiss()} className="h-11 rounded-xl px-3 text-sm font-medium text-navy-text transition-colors hover:text-white">
            Not now
          </button>
        </div>
      </div>
      <button type="button" aria-label="Dismiss" onClick={() => install.dismiss()} className="-mr-2 -mt-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-navy-text hover:text-white">
        <XIcon className="h-4 w-4" />
      </button>
    </section>);

}