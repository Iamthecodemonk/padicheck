import React from "react";
import { EllipsisVerticalIcon, MonitorDownIcon, ShareIcon, SquarePlusIcon, BoxIcon } from "lucide-react";
import { BottomSheet } from "../BottomSheet";
import { usePwa } from "../../contexts/PwaContext";
interface Step {
  icon: BoxIcon;
  text: React.ReactNode;
}
export function InstallGuideSheet() {
  const {
    installGuideOpen,
    closeInstallGuide,
    platform,
    identity,
    install,
    browser
  } = usePwa();
  const isIos = platform === 'ios';
  const steps: Step[] = isIos ? [{
    icon: ShareIcon,
    text: <>Tap <strong>Share</strong> in Safari’s toolbar</>
  }, {
    icon: SquarePlusIcon,
    text: <>Scroll down and choose <strong>Add to Home Screen</strong></>
  }, {
    icon: SquarePlusIcon,
    text: <>Tap <strong>Add</strong> — {identity.shortName} appears on your Home Screen</>
  }] : platform === 'desktop' ? [{
    icon: MonitorDownIcon,
    text: <>Click the <strong>install icon</strong> at the right of the address bar</>
  }, {
    icon: SquarePlusIcon,
    text: <>Choose <strong>Install</strong> to open {identity.name} in its own window</>
  }] : [{
    icon: EllipsisVerticalIcon,
    text: <>Open the <strong>{browser} menu</strong> (⋮)</>
  }, {
    icon: SquarePlusIcon,
    text: <>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong></>
  }];
  const finish = () => {
    install.dismiss(30);
    closeInstallGuide();
  };
  return <BottomSheet open={installGuideOpen} onClose={closeInstallGuide} title={isIos ? `Add ${identity.name} to your Home Screen` : `Install ${identity.name}`} description={isIos ? 'Safari installs web apps from the Share menu.' : 'Your browser can install this as an app.'} footer={<div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={finish} className="h-12 rounded-2xl border border-line font-semibold text-ink transition-colors hover:bg-canvas">
            Maybe later
          </button>
          <button type="button" onClick={() => {
      install.markInstalled();
      closeInstallGuide();
    }} className="h-12 rounded-2xl bg-brand font-semibold text-white transition-colors hover:bg-brand-dark">
            I’ve added it
          </button>
        </div>}>
      <ol className="space-y-3">
        {steps.map((step, i) => <li key={i} className="flex items-center gap-4 rounded-2xl bg-canvas p-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-white">{i + 1}</span>
            <span className="flex-1 text-[15px] text-ink">{step.text}</span>
            <step.icon className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
          </li>)}
      </ol>
      {isIos && browser !== 'Safari' && <p className="mt-4 text-sm text-muted">On iPhone and iPad, installing works from Safari. Open this page in Safari first.</p>}
    </BottomSheet>;
}