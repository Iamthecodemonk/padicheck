import React, { useEffect, useState } from 'react';
import { BellRingIcon, DownloadIcon, WifiOffIcon, ZapIcon } from 'lucide-react';
import { BottomSheet } from '../BottomSheet';
import { usePwa } from '../../contexts/PwaContext';
import { primaryButton, secondaryButton } from '../../utils/formStyles';

const SESSION_KEY = 'pc-install-prompt-shown';
const DELAY_MS = 6000;

const benefits = [
{ icon: ZapIcon, text: 'Opens instantly from your Home Screen' },
{ icon: BellRingIcon, text: 'Alerts when a saved business or number changes' },
{ icon: WifiOffIcon, text: 'Saved reports work offline' }];


/**
 * Install pop-up. Appears once per session, a few seconds after arrival, only when the app isn't
 * installed and the user hasn't recently said "Not now". Uses the browser's native prompt when it can.
 */
export function InstallPrompt() {
  const { install, identity, platform, requestInstall, installGuideOpen } = usePwa();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!install.eligible || sessionStorage.getItem(SESSION_KEY)) return;
    const t = window.setTimeout(() => {
      sessionStorage.setItem(SESSION_KEY, '1');
      setOpen(true);
    }, DELAY_MS);
    return () => window.clearTimeout(t);
  }, [install.eligible]);

  useEffect(() => {
    if (install.installed) setOpen(false);
  }, [install.installed]);

  const later = () => {
    install.dismiss(7);
    setOpen(false);
  };

  return (
    <BottomSheet
      open={open && !installGuideOpen}
      onClose={later}
      title={platform === 'ios' ? `Add ${identity.name} to your Home Screen` : `Install the ${identity.name} app`}
      description="Check before you trust — wherever you are. Free, and takes a few seconds."
      footer={
      <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={later} className={secondaryButton}>
            Not now
          </button>
          <button
          type="button"
          onClick={() => {
            setOpen(false);
            requestInstall();
          }}
          className={primaryButton}>
          
            <DownloadIcon className="h-4 w-4" aria-hidden="true" />
            {platform === 'ios' ? 'Show me how' : 'Install'}
          </button>
        </div>
      }>
      
      <div className="flex items-center gap-4 rounded-2xl bg-canvas p-4">
        <img src={identity.icon} alt="" className="h-14 w-14 shrink-0 rounded-2xl bg-white object-cover" />
        <div className="min-w-0">
          <p className="font-semibold text-ink">{identity.name}</p>
          <p className="text-sm text-muted">{platform === 'desktop' ? 'Opens in its own window' : 'Works like a native app'} · No app store needed</p>
        </div>
      </div>
      <ul className="mt-4 space-y-3">
        {benefits.map((b) =>
        <li key={b.text} className="flex items-center gap-3 text-[15px] text-ink">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-dark">
              <b.icon className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            {b.text}
          </li>
        )}
      </ul>
    </BottomSheet>);

}