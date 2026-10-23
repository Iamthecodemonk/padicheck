import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ExternalLinkIcon } from 'lucide-react';
import { Field } from '../../components/admin/Field';
import { useTrust } from '../../contexts/TrustContext';
import { businessCategories } from '../../data/businessPortal';
import { chipClass, inputClass, primaryButton, secondaryButton, textareaClass } from '../../utils/formStyles';

export function BusinessProfileEdit() {
  const { myBusiness, saveBusiness } = useTrust();
  const [form, setForm] = useState(myBusiness);
  const [tried, setTried] = useState(false);
  useEffect(() => setForm(myBusiness), [myBusiness]);

  const set = <K extends keyof typeof form,>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const errors = {
    name: form.name.trim().length < 2 ? 'Enter your business name' : '',
    email: !/^\S+@\S+\.\S+$/.test(form.email) ? 'Enter a valid email' : '',
    phone: form.phone.replace(/\D/g, '').length < 10 ? 'Enter a full phone number' : '',
    website: form.website && !/^[\w-]+(\.[\w-]+)+/.test(form.website.replace(/^https?:\/\//, '')) ? 'Enter a valid website' : ''
  };
  const dirty = JSON.stringify(form) !== JSON.stringify(myBusiness);
  const verifiedFieldChanged = myBusiness.verification === 'verified' && (form.name !== myBusiness.name || form.regNumber !== myBusiness.regNumber);

  const save = () => {
    setTried(true);
    if (Object.values(errors).some(Boolean)) return;
    saveBusiness({ ...form, verification: verifiedFieldChanged ? 'review' : form.verification });
    toast.success(verifiedFieldChanged ? 'Saved — your verification will be re-checked' : 'Profile updated');
  };

  return (
    <div className="grid gap-8 pb-10 lg:grid-cols-[minmax(0,1fr)_300px]">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="space-y-5">
        
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" error={tried ? errors.name : undefined}>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Registration number" hint="CAC RC or BN number">
            <input value={form.regNumber} onChange={(e) => set('regNumber', e.target.value)} className={inputClass} />
          </Field>
        </div>
        <fieldset>
          <legend className="text-sm font-medium text-ink">Category</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {businessCategories.map((c) =>
            <button key={c} type="button" aria-pressed={form.category === c} onClick={() => set('category', c)} className={chipClass(form.category === c)}>
                {c}
              </button>
            )}
          </div>
        </fieldset>
        <Field label="Description" hint={`${form.description.length}/280`}>
          <textarea rows={3} maxLength={280} value={form.description} onChange={(e) => set('description', e.target.value)} className={textareaClass} />
        </Field>
        <Field label="Address">
          <input value={form.location} onChange={(e) => set('location', e.target.value)} className={inputClass} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Website" error={tried ? errors.website : undefined}>
            <input value={form.website} onChange={(e) => set('website', e.target.value)} inputMode="url" className={inputClass} />
          </Field>
          <Field label="Phone" error={tried ? errors.phone : undefined}>
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" className={inputClass} />
          </Field>
          <Field label="Email" error={tried ? errors.email : undefined}>
            <input value={form.email} onChange={(e) => set('email', e.target.value)} type="email" className={inputClass} />
          </Field>
        </div>
        <Field label="Social links" hint="One per line">
          <textarea rows={2} value={form.socials.join('\n')} onChange={(e) => set('socials', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))} className={textareaClass} />
        </Field>
        {verifiedFieldChanged && <p className="rounded-2xl bg-caution-soft p-4 text-sm text-caution">Changing your name or registration number sends your verification back for review.</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={!dirty} className={primaryButton}>
            Save changes
          </button>
          {dirty &&
          <button type="button" onClick={() => setForm(myBusiness)} className={secondaryButton}>
              Discard
            </button>
          }
        </div>
      </form>
      <aside className="space-y-3">
        <p className="text-sm text-muted">Your public profile is visible to anyone once you’ve started verification.</p>
        <Link to={`/b/${myBusiness.slug}`} className="inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-brand-dark ring-1 ring-line hover:bg-surface">
          <ExternalLinkIcon className="h-4 w-4" aria-hidden="true" /> View public profile
        </Link>
      </aside>
    </div>);

}