import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { BanknoteIcon, BellIcon, CircleCheckIcon, ScaleIcon, DownloadIcon, GaugeIcon, GlobeIcon, KeyRoundIcon, LanguagesIcon, LogOutIcon, MonitorSmartphoneIcon, MoonIcon, PaletteIcon, RefreshCwIcon, SmartphoneIcon, SunIcon, Trash2Icon, BoxIcon } from "lucide-react";
import { BookmarkIcon, Building2Icon, CodeIcon, CoinsIcon, FlagIcon, HistoryIcon, ShieldCheckIcon, SparklesIcon } from "lucide-react";
import { useTrust } from "../../contexts/TrustContext";
import { useTheme, ThemeMode } from "../../contexts/ThemeContext";
import { usePlatform } from "../../contexts/PlatformContext";
import { ConfirmSheet } from "../../components/ConfirmSheet";
import { Switch } from "../../components/Switch";
import { NotificationSheet } from "../../components/consumer/account/NotificationSheet";
import { PreferenceSheet } from "../../components/consumer/account/PreferenceSheet";
import { SettingsRow } from "../../components/consumer/account/SettingsRow";
import { PageHeader } from "../../components/consumer/PageHeader";
import { usePwa } from "../../contexts/PwaContext";
import { useUser } from "../../contexts/UserContext";
import { countryOptions, currencyOptions, languageOptions, PreferenceOption } from "../../data/preferences";
const themeOptions: {
  value: ThemeMode;
  label: string;
  icon: typeof SunIcon;
}[] = [{
  value: 'dark',
  label: 'Dark',
  icon: MoonIcon
}, {
  value: 'light',
  label: 'Light',
  icon: SunIcon
}, {
  value: 'system',
  label: 'Auto',
  icon: SmartphoneIcon
}];
type Sheet = null | 'notifications' | 'country' | 'currency' | 'language' | 'logoutAll' | 'delete';
const providerLabels = {
  google: 'Google',
  apple: 'Apple',
  email: 'Email & password',
  otp: 'One-time code'
};
export function Account() {
  const navigate = useNavigate();
  const {
    session,
    signOut,
    dataSaver,
    setDataSaver,
    preferences,
    setPreference
  } = useUser();
  const {
    install,
    platform,
    requestInstall,
    sw,
    identity,
    online
  } = usePwa();
  const {
    mode,
    setMode
  } = useTheme();
  const {
    docs
  } = usePlatform();
  const { unreadCount } = useTrust();
  const [sheet, setSheet] = useState<Sheet>(null);
  const close = () => setSheet(null);
  const labelFor = (options: PreferenceOption[], value: string) => options.find((o) => o.value === value)?.label ?? value;
  const installLabel = platform === 'ios' ? 'Add to Home Screen' : platform === 'desktop' ? 'Install App' : 'Install PadiCheck';
  const checkUpdates = async () => {
    const outcome = await sw.checkForUpdate();
    if (outcome === 'available') toast('A new version is ready', {
      description: 'Tap Update on the banner to switch.'
    });else if (outcome === 'latest') toast.success(`You’re on the latest version (${identity.version})`);else toast(`You’re on version ${identity.version}`, {
      description: 'Update checks run automatically in the installed app.'
    });
  };
  const logOut = () => {
    signOut();
    navigate('/signin', {
      replace: true
    });
  };
  const initials = (session?.name ?? '').split(' ').map((p) => p[0]).join('').slice(0, 2);
  const group = 'divide-y divide-line overflow-hidden rounded-3xl bg-surface';
  const heading = 'mb-2 mt-7 px-1 text-sm font-medium text-muted';
  return <>
      <PageHeader title="Account" />
      <div className="mx-auto w-full max-w-5xl px-4 lg:grid lg:grid-cols-2 lg:gap-x-10 lg:px-10">
        <div>
          <section aria-label="Profile" className="flex items-center gap-4 rounded-3xl bg-surface p-5">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand text-lg font-semibold text-white">{initials}</span>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-ink">{session?.name}</p>
              <p className="truncate text-sm text-muted">{session?.email}</p>
            </div>
          </section>

          <h2 className={heading}>App</h2>
          <ul className={group}>
            {install.installed ? <SettingsRow icon={CircleCheckIcon} label="Installed on this device" hint="Opens like an app, works offline" /> : <SettingsRow icon={DownloadIcon} label={installLabel} hint="Faster to open, works offline" onClick={requestInstall} />}
            <li className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
              <span className="flex flex-1 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-soft text-violet">
                  <PaletteIcon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <span className="text-[15px] font-medium text-ink">Appearance</span>
              </span>
              <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-3 gap-1 rounded-2xl bg-canvas p-1">
                {themeOptions.map((o) => <button key={o.value} type="button" role="radio" aria-checked={mode === o.value} onClick={() => setMode(o.value)} className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors ${mode === o.value ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink'}`}>
                    <o.icon className="h-4 w-4" aria-hidden="true" />
                    {o.label}
                  </button>)}
              </div>
            </li>
            <SettingsRow icon={GaugeIcon} label="Data Saver" hint="Smaller uploads, no prefetching, less motion" trailing={<Switch checked={dataSaver} onChange={setDataSaver} label="Data Saver" />} />
            <SettingsRow icon={BellIcon} label="Notifications" onClick={() => setSheet('notifications')} />
            <SettingsRow icon={RefreshCwIcon} label="Check for updates" value={`v${identity.version}`} onClick={checkUpdates} />
          </ul>

          <h2 className={heading}>Region & language</h2>
          <ul className={group}>
            <SettingsRow icon={GlobeIcon} label="Country" value={labelFor(countryOptions, preferences.country)} onClick={() => setSheet('country')} />
            <SettingsRow icon={BanknoteIcon} label="Currency" value={preferences.currency} onClick={() => setSheet('currency')} />
            <SettingsRow icon={LanguagesIcon} label="Language" value={labelFor(languageOptions, preferences.language)} onClick={() => setSheet('language')} />
          </ul>
        </div>

        <div>
          <h2 className={`${heading} lg:mt-0`}>Your activity</h2>
          <ul className={group}>
            <SettingsRow icon={HistoryIcon} label="Check history" onClick={() => navigate('/history')} />
            <SettingsRow icon={BookmarkIcon} label="Saved checks" onClick={() => navigate('/saved')} />
            <SettingsRow icon={FlagIcon} label="My reports" hint="Track reports you’ve submitted" onClick={() => navigate('/my-reports')} />
            <SettingsRow icon={BellIcon} label="Alerts" value={unreadCount ? `${unreadCount} unread` : undefined} onClick={() => navigate('/notifications')} />
            <SettingsRow icon={CoinsIcon} label="Credits" onClick={() => navigate('/credits')} />
          </ul>

          <h2 className={heading}>Plan & workspaces</h2>
          <ul className={group}>
            <SettingsRow icon={SparklesIcon} label="Subscription & billing" hint="Plans, invoices and receipts" onClick={() => navigate('/account/billing')} />
            <SettingsRow icon={Building2Icon} label="Business portal" hint="Verify your business, reviews, certificate" onClick={() => navigate('/business')} />
            <SettingsRow icon={CodeIcon} label="Developer portal" hint="API keys, sandbox, webhooks" onClick={() => navigate('/developers')} />
          </ul>

          <h2 className={heading}>Sign-in & security</h2>
          <ul className={group}>
            <SettingsRow icon={ShieldCheckIcon} label="Security & privacy" hint="Password, two-factor, devices, data export" onClick={() => navigate('/account/security')} />
            <SettingsRow icon={KeyRoundIcon} label="Signed in with" value={session ? providerLabels[session.provider] : ''} />
            <SettingsRow icon={LogOutIcon} label="Log out" onClick={logOut} />
            <SettingsRow icon={MonitorSmartphoneIcon} label="Log out of all devices" hint="Ends every session, including this one" onClick={() => setSheet('logoutAll')} />
            <SettingsRow icon={Trash2Icon} label="Delete account" tone="danger" onClick={() => setSheet('delete')} />
          </ul>

          <h2 className={heading}>Help & policies</h2>
          <ul className={group}>
            {docs.filter((d) => d.kind !== 'copy' && d.version > 0).sort((a, b) => a.kind === b.kind ? 0 : a.kind === 'help' ? -1 : 1).map((d) => <SettingsRow key={d.id} icon={d.kind === 'help' ? BoxIcon : ScaleIcon} label={d.title} hint={d.summary} onClick={() => navigate(`/legal/${d.slug}`)} />)}
          </ul>
          <p className="mt-6 px-1 text-xs text-muted">
            {identity.name} {identity.version} · Offline support {sw.status === 'active' ? 'active' : 'available in the installed app'}
            {online ? '' : ' · Offline'}
          </p>
        </div>
      </div>

      <NotificationSheet open={sheet === 'notifications'} onClose={close} />
      <PreferenceSheet open={sheet === 'country'} onClose={close} title="Country" options={countryOptions} value={preferences.country} onSelect={(v) => setPreference('country', v)} />
      <PreferenceSheet open={sheet === 'currency'} onClose={close} title="Currency" options={currencyOptions} value={preferences.currency} onSelect={(v) => setPreference('currency', v)} />
      <PreferenceSheet open={sheet === 'language'} onClose={close} title="Language" options={languageOptions} value={preferences.language} onSelect={(v) => setPreference('language', v)} />
      <ConfirmSheet open={sheet === 'logoutAll'} onClose={close} onConfirm={() => {
      toast.success('Signed out everywhere');
      logOut();
    }} title="Log out of all devices?" description="You’ll need to sign in again on every phone, tablet and computer." confirmLabel="Log out all" />
      <ConfirmSheet open={sheet === 'delete'} onClose={close} onConfirm={() => {
      toast('Your account is scheduled for deletion', {
        description: 'We’ve emailed you a link to cancel within 14 days.'
      });
      logOut();
    }} title="Delete your account?" description="Your reports, saved items and remaining credits will be permanently removed after 14 days." confirmLabel="Delete" tone="danger" requireText="DELETE" />
    </>;
}