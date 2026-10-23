import React from 'react';
import { CheckIcon } from 'lucide-react';
import { BottomSheet } from '../../BottomSheet';
import type { PreferenceOption } from '../../../data/preferences';

interface PreferenceSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  options: PreferenceOption[];
  value: string;
  onSelect: (value: string) => void;
}

export function PreferenceSheet({ open, onClose, title, options, value, onSelect }: PreferenceSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <ul role="radiogroup" aria-label={title} className="divide-y divide-line overflow-hidden rounded-2xl bg-canvas">
        {options.map((o) =>
        <li key={o.value}>
            <button
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => {
              onSelect(o.value);
              onClose();
            }}
            className="flex h-14 w-full items-center gap-3 px-4 text-left font-medium text-ink hover:bg-line/50">
            
              <span className="flex-1">{o.label}</span>
              {o.hint && <span className="text-sm text-muted">{o.hint}</span>}
              {value === o.value && <CheckIcon className="h-5 w-5 text-brand" aria-hidden="true" />}
            </button>
          </li>
        )}
      </ul>
    </BottomSheet>);

}