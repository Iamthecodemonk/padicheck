import React from 'react';
import { CircleCheckIcon, TriangleAlertIcon } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { StatusPill } from '../../components/admin/StatusPill';
import { usePwa } from '../../contexts/PwaContext';
import { appIdentities } from '../../data/appIdentity';
import { services } from '../../data/adminOps';
import { readInstallEvents } from '../../utils/installTracking';

const workerLabels = { registering: 'Starting', active: 'Active', unavailable: 'Not registered in this preview', unsupported: 'Not supported by this browser' };

export function AdminHealth() {
  const { sw, platform, browser, install, online } = usePwa();
  const issues = services.filter((s) => s.status !== 'operational');
  const events = readInstallEvents();

  const apps = [
  { name: appIdentities.consumer.name, version: appIdentities.consumer.version, scope: appIdentities.consumer.scope },
  { name: appIdentities.admin.name, version: appIdentities.admin.version, scope: appIdentities.admin.scope }];


  return (
    <>
      <AdminPageHeader title="System Health" subtitle="Services, providers and app delivery." />
      <div className="grid gap-5 px-4 md:px-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <section
            role="status"
            className={`flex items-center gap-3 rounded-3xl p-5 ${issues.length ? 'bg-caution-soft text-caution' : 'bg-brand-soft text-brand-dark'}`}>
            
            {issues.length ? <TriangleAlertIcon className="h-6 w-6 shrink-0" aria-hidden="true" /> : <CircleCheckIcon className="h-6 w-6 shrink-0" aria-hidden="true" />}
            <div>
              <p className="text-lg font-semibold">{issues.length ? `${issues.length} service degraded` : 'All systems operational'}</p>
              <p className="text-sm">{issues.length ? issues.map((i) => i.detail).join(' · ') : 'No incidents in the last 24 hours.'}</p>
            </div>
          </section>
          <section aria-labelledby="services-heading" className="rounded-3xl bg-surface p-2">
            <h2 id="services-heading" className="px-3 pb-1 pt-3 text-lg font-semibold text-ink">
              Services
            </h2>
            <ul className="divide-y divide-line">
              {services.map((s) =>
              <li key={s.id} className="flex min-h-[64px] items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink">{s.name}</span>
                    <span className="block truncate text-sm text-muted">
                      {s.detail} · {s.uptime} uptime
                    </span>
                  </span>
                  <StatusPill status={s.status} />
                </li>
              )}
            </ul>
          </section>
        </div>

        <section aria-labelledby="apps-heading" className="self-start rounded-3xl bg-surface p-5">
          <h2 id="apps-heading" className="text-lg font-semibold text-ink">
            App delivery
          </h2>
          <ul className="mt-3 divide-y divide-line">
            {apps.map((a) =>
            <li key={a.name} className="flex items-center justify-between gap-3 py-3">
                <span>
                  <span className="block font-medium text-ink">{a.name}</span>
                  <span className="block text-sm text-muted">Scope {a.scope}</span>
                </span>
                <span className="font-mono text-sm text-ink">v{a.version}</span>
              </li>
            )}
          </ul>
          <h3 className="mt-5 text-sm font-medium text-muted">This device</h3>
          <dl className="mt-2 space-y-2 text-sm">
            {[
            ['Platform', `${platform === 'ios' ? 'iOS' : platform === 'android' ? 'Android' : 'Desktop'} · ${browser}`],
            ['Connection', online ? 'Online' : 'Offline'],
            ['Offline support', workerLabels[sw.status]],
            ['Installed', install.installed ? 'Yes' : 'No'],
            ['Install events logged', String(events.length)]].
            map(([k, v]) =>
            <div key={k} className="flex justify-between gap-4">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-medium text-ink">{v}</dd>
              </div>
            )}
          </dl>
        </section>
      </div>
    </>);

}