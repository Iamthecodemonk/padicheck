import React, { useEffect, useState } from 'react';
import { BottomSheet } from '../../BottomSheet';
import { Field } from '../Field';
import { inputClass, primaryButton } from '../../../utils/formStyles';
import type { ContentKind } from '../../../types/content';

interface NewDocSheetProps {
  open: boolean;
  kind: ContentKind;
  existingSlugs: string[];
  onClose: () => void;
  onCreate: (data: {kind: ContentKind;title: string;summary: string;slug: string;}) => void;
}

const slugify = (s: string) =>
s.
toLowerCase().
replace(/[^a-z0-9]+/g, '-').
replace(/^-|-$/g, '');

export function NewDocSheet({ open, kind, existingSlugs, onClose, onCreate }: NewDocSheetProps) {
  const [docKind, setDocKind] = useState<ContentKind>(kind);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (open) {
      setDocKind(kind === 'copy' ? 'legal' : kind);
      setTitle('');
      setSummary('');
      setTried(false);
    }
  }, [open, kind]);

  const slug = slugify(title);
  const error = title.trim().length < 3 ? 'Enter a title' : existingSlugs.includes(slug) ? 'A page with this title already exists' : '';

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="New page"
      description="It starts as a draft — nothing is visible to users until you publish."
      footer={
      <button
        type="button"
        onClick={() => {
          setTried(true);
          if (!error) onCreate({ kind: docKind, title: title.trim(), summary: summary.trim(), slug });
        }}
        className={`${primaryButton} w-full`}>
        
          Create draft
        </button>
      }>
      
      <div className="space-y-4">
        <div role="radiogroup" aria-label="Type" className="grid grid-cols-2 gap-1 rounded-2xl bg-canvas p-1">
          {(['legal', 'help'] as const).map((k) =>
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={docKind === k}
            onClick={() => setDocKind(k)}
            className={`h-11 rounded-xl text-sm font-semibold transition-colors ${docKind === k ? 'bg-surface text-ink shadow-card' : 'text-muted'}`}>
            
              {k === 'legal' ? 'Policy' : 'Help article'}
            </button>
          )}
        </div>
        <Field label="Title" error={tried ? error : undefined} hint={slug ? `Address: /legal/${slug}` : undefined}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder={docKind === 'legal' ? 'e.g. Cookie Policy' : 'e.g. How to check a property'} />
        </Field>
        <Field label="Short summary">
          <input value={summary} onChange={(e) => setSummary(e.target.value)} className={inputClass} placeholder="One line shown in lists" />
        </Field>
      </div>
    </BottomSheet>);

}