import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { PencilIcon, PlusIcon, StarIcon, Trash2Icon } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { LockedNotice } from '../../components/admin/LockedNotice';
import { PackageEditorSheet } from '../../components/admin/credits/PackageEditorSheet';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { useAdminData } from '../../contexts/AdminDataContext';
import { useAdminSession } from '../../contexts/AdminSessionContext';
import { usePlatform } from '../../contexts/PlatformContext';
import { usePwa } from '../../contexts/PwaContext';
import { checkTypes } from '../../data/checkTypes';
import { formatNaira, formatWhen } from '../../utils/checks';
import { primaryButton } from '../../utils/formStyles';
import type { CreditPackage } from '../../types/check';

export function AdminCredits() {
  const { packages, savePackage, removePackage } = usePlatform();
  const { audit } = useAdminData();
  const { permissions, log } = useAdminSession();
  const { online } = usePwa();
  const [editing, setEditing] = useState<CreditPackage | null | 'new'>(null);
  const [deleting, setDeleting] = useState<CreditPackage | null>(null);
  const canEdit = permissions.managePricing && online;
  const sorted = [...packages].sort((a, b) => a.credits - b.credits);
  const adjustments = audit.filter((a) => a.category === 'credits' || a.category === 'pricing').slice(0, 6);

  return (
    <>
      <AdminPageHeader
        title="Credits"
        subtitle="Packages people can buy, what checks cost, and recent changes."
        actions={
        canEdit &&
        <button type="button" onClick={() => setEditing('new')} className={`${primaryButton} h-11 px-4`}>
              <PlusIcon className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">New package</span>
            </button>

        } />
      
      <div className="grid gap-5 px-4 md:px-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          {!permissions.managePricing && <LockedNotice text="View only — editing packages needs the “Manage credit packages” permission." />}
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((p) => {
              const hidden = p.active === false;
              return (
                <li key={p.id} className={`flex flex-col rounded-3xl bg-surface p-5 ${p.featured ? 'ring-2 ring-brand' : ''} ${hidden ? 'opacity-70' : ''}`}>
                  <div className="flex items-center gap-2">
                    <h2 className="flex-1 font-semibold text-ink">{p.name}</h2>
                    {p.featured &&
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark">
                        <StarIcon className="h-3 w-3" aria-hidden="true" /> Recommended
                      </span>
                    }
                    {hidden && <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-muted">Hidden</span>}
                  </div>
                  <p className="mt-3 text-3xl font-bold tracking-tight text-ink">{p.credits} credits</p>
                  <p className="text-ink-soft">
                    {formatNaira(p.priceNaira)} · <span className="text-muted">{formatNaira(Math.round(p.priceNaira / p.credits))}/credit</span>
                  </p>
                  {p.note && <p className="mt-2 text-sm text-muted">{p.note}</p>}
                  {canEdit &&
                  <div className="mt-auto flex gap-2 pt-5">
                      <button type="button" onClick={() => setEditing(p)} className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-ink ring-1 ring-line hover:bg-canvas">
                        <PencilIcon className="h-4 w-4" aria-hidden="true" /> Edit
                      </button>
                      <button
                      type="button"
                      aria-label={`Delete ${p.name}`}
                      onClick={() => setDeleting(p)}
                      className="grid h-11 w-11 place-items-center rounded-xl text-danger ring-1 ring-line hover:bg-danger-soft">
                      
                        <Trash2Icon className="h-4 w-4" />
                      </button>
                    </div>
                  }
                </li>);

            })}
          </ul>

          <section aria-labelledby="costs-heading" className="mt-6 rounded-3xl bg-surface p-2">
            <h2 id="costs-heading" className="px-3 pb-1 pt-3 text-lg font-semibold text-ink">
              What checks cost
            </h2>
            <ul className="grid sm:grid-cols-2">
              {checkTypes.map((t) =>
              <li key={t.id} className="flex min-h-[56px] items-center gap-3 px-3">
                  <span className={`grid h-9 w-9 place-items-center rounded-xl ${t.tile}`}>
                    <t.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  </span>
                  <span className="flex-1 text-ink">{t.longLabel}</span>
                  <span className="font-semibold text-ink">{t.credits}</span>
                </li>
              )}
            </ul>
          </section>
        </div>

        <section aria-labelledby="changes-heading" className="self-start rounded-3xl bg-surface p-2">
          <h2 id="changes-heading" className="px-3 pb-1 pt-3 text-lg font-semibold text-ink">
            Recent credit changes
          </h2>
          <ul className="divide-y divide-line">
            {adjustments.map((a) =>
            <li key={a.id} className="px-3 py-3">
                <p className="font-medium text-ink">{a.action}</p>
                <p className="text-sm text-muted">
                  {a.actor} · {formatWhen(a.at)}
                  {a.detail ? ` · ${a.detail}` : ''}
                </p>
              </li>
            )}
          </ul>
          <Link to="/admin/users" className="m-2 flex h-11 items-center justify-center rounded-xl text-sm font-semibold text-brand-dark hover:bg-canvas">
            Adjust a user’s credits
          </Link>
        </section>
      </div>

      <PackageEditorSheet
        open={editing !== null}
        pkg={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSave={(pkg) => {
          const prev = packages.find((p) => p.id === pkg.id);
          savePackage(pkg);
          log(
            'pricing',
            prev ? `Updated ${pkg.name} package` : `Created ${pkg.name} package`,
            prev && prev.priceNaira !== pkg.priceNaira ? `${formatNaira(prev.priceNaira)} → ${formatNaira(pkg.priceNaira)}` : `${pkg.credits} credits · ${formatNaira(pkg.priceNaira)}`
          );
          setEditing(null);
          toast.success(prev ? 'Package updated' : 'Package created', { description: pkg.active ? 'Live on the Buy credits screen' : 'Hidden from buyers' });
        }} />
      
      <ConfirmSheet
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          if (packages.filter((p) => p.active !== false && p.id !== deleting.id).length === 0) {
            toast.error('Keep at least one package available to buy');
            setDeleting(null);
            return;
          }
          removePackage(deleting.id);
          log('pricing', `Deleted ${deleting.name} package`);
          setDeleting(null);
          toast.success('Package deleted');
        }}
        title={deleting ? `Delete ${deleting.name}?` : ''}
        description="Buyers won’t see it anymore. To pause it instead, edit it and turn off “Available to buy”."
        confirmLabel="Delete"
        tone="danger" />
      
    </>);

}