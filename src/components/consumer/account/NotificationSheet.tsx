import React, { useState } from 'react';
import { BellIcon } from 'lucide-react';
import { BottomSheet } from '../../BottomSheet';
import { Switch } from '../../Switch';
import { usePwa } from '../../../contexts/PwaContext';
import { useUser } from '../../../contexts/UserContext';
import { notificationTypes } from '../../../data/preferences';

type Permission = NotificationPermission | 'unsupported';

function currentPermission(): Permission {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

export function NotificationSheet({ open, onClose }: {open: boolean;onClose: () => void;}) {
  const { notificationPrefs, setNotificationPref } = useUser();
  const { platform, install } = usePwa();
  const [permission, setPermission] = useState<Permission>(currentPermission);
  const iosNeedsInstall = platform === 'ios' && !install.installed;

  const request = async () => {
    if (typeof Notification === 'undefined') return;
    setPermission(await Notification.requestPermission());
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Notifications" description="We only notify you about things you’ve asked us to.">
      {permission !== 'granted' &&
      <div className="mb-4 flex gap-3 rounded-2xl bg-canvas p-4">
          <BellIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
          <div className="flex-1 text-sm">
            {iosNeedsInstall || permission === 'unsupported' ?
          <p className="text-ink">On iPhone and iPad, notifications work once PadiCheck is added to your Home Screen.</p> :
          permission === 'denied' ?
          <p className="text-ink">Notifications are blocked. Turn them on for PadiCheck in your browser or device settings.</p> :

          <>
                <p className="text-ink">Allow notifications to hear when reports are ready.</p>
                <button type="button" onClick={request} className="mt-3 h-11 rounded-xl bg-ink px-4 font-semibold text-white hover:bg-ink-soft">
                  Allow notifications
                </button>
              </>
          }
          </div>
        </div>
      }
      <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-canvas">
        {notificationTypes.map((n) =>
        <li key={n.id} className="flex items-center gap-3 py-2 pl-4 pr-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">{n.label}</p>
              <p className="text-sm text-muted">{n.hint}</p>
            </div>
            <Switch checked={notificationPrefs[n.id] ?? false} onChange={(on) => setNotificationPref(n.id, on)} label={n.label} />
          </li>
        )}
      </ul>
    </BottomSheet>);

}