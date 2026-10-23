import React, { useEffect, useState } from 'react';
import { BottomSheet } from '../../BottomSheet';
import { Switch } from '../../Switch';
import { Field } from '../Field';
import { formatNaira } from '../../../utils/checks';
import { inputClass, primaryButton } from '../../../utils/formStyles';
import type { CreditPackage } from '../../../types/check';

interface PackageEditorSheetProps {
  open: boolean;
  pkg: CreditPackage | null;
  onClose: () => void;
  onSave: (pkg: CreditPackage) => void;
}

const digits = (v: string) => Number(v.replace(/\D/g, '')) || 0;

export function PackageEditorSheet({ open, pkg, onClose, onSave }: PackageEditorSheetProps) {
  const [name, setName] = useState('');
  const [credits, setCredits] = useState(0);
  const [price, setPrice] = useState(0);
  const [note, setNote] = useState('');
  const [active, setActive] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(pkg?.name ?? '');
    setCredits(pkg?.credits ?? 30);
    setPrice(pkg?.priceNaira ?? 3000);
    setNote(pkg?.note ?? '');
    setActive(pkg?.active !== false);
    setFeatured(pkg?.featured ?? false);
    setTried(false);
  }, [open, pkg]);

  const errors = {
    name: name.trim().length < 2 ? 'Give the package a name' : '',
    credits: credits < 1 || credits > 10000 ? 'Between 1 and 10,000 credits' : '',
    price: price < 100 ? 'Minimum price is ₦100' : ''
  };
  const valid = !errors.name && !errors.credits && !errors.price;
  const perCredit = credits > 0 ? price / credits : 0;

  const save = () => {
    setTried(true);
    if (!valid) return;
    onSave({
      id: pkg?.id ?? `pkg-${Date.now().toString(36)}`,
      name: name.trim(),
      credits,
      priceNaira: price,
      note: note.trim() || undefined,
      active,
      featured: active && featured
    });
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={pkg ? `Edit ${pkg.name}` : 'New credit package'}
      description="Changes apply to the Buy credits screen immediately. Past purchases aren’t affected."
      footer={
      <button type="button" onClick={save} className={`${primaryButton} w-full`}>
          {pkg ? 'Save package' : 'Create package'}
        </button>
      }>
      
      <div className="space-y-4">
        <Field label="Name" error={tried ? errors.name : undefined}>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. Business" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Credits" error={tried ? errors.credits : undefined}>
            <input inputMode="numeric" value={credits || ''} onChange={(e) => setCredits(digits(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Price (₦)" error={tried ? errors.price : undefined}>
            <input inputMode="numeric" value={price ? price.toLocaleString() : ''} onChange={(e) => setPrice(digits(e.target.value))} className={inputClass} />
          </Field>
        </div>
        <p className="rounded-2xl bg-amber-soft px-4 py-3 text-sm text-amber">
          {credits > 0 ? `${formatNaira(Math.round(perCredit))} per credit` : 'Enter the number of credits'}
        </p>
        <Field label="Tagline (optional)" hint="Shown under the package name">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={60} className={inputClass} placeholder="e.g. For small businesses" />
        </Field>
        <div className="divide-y divide-line rounded-2xl ring-1 ring-line">
          <div className="flex min-h-[60px] items-center gap-3 px-4">
            <span className="flex-1">
              <span className="block font-medium text-ink">Available to buy</span>
              <span className="block text-sm text-muted">Hidden packages stay in purchase history</span>
            </span>
            <Switch checked={active} onChange={setActive} label="Available to buy" />
          </div>
          <div className="flex min-h-[60px] items-center gap-3 px-4">
            <span className="flex-1">
              <span className="block font-medium text-ink">Recommended</span>
              <span className="block text-sm text-muted">Pre-selected for buyers. Only one at a time.</span>
            </span>
            <Switch checked={featured && active} disabled={!active} onChange={setFeatured} label="Recommended" />
          </div>
        </div>
      </div>
    </BottomSheet>);

}