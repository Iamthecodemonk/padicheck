import React, { useState } from 'react';
import { CheckIcon, PlusIcon } from 'lucide-react';

interface ChipPickerProps {
  label: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  allowCustom?: boolean;
  max?: number;
}

export function ChipPicker({ label, options, value, onChange, allowCustom, max }: ChipPickerProps) {
  const [custom, setCustom] = useState('');
  const all = [...options, ...value.filter((v) => !options.includes(v))];
  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt));else
    if (!max || value.length < max) onChange([...value, opt]);
  };
  const addCustom = () => {
    const v = custom.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setCustom('');
  };

  return (
    <fieldset>
      <legend className="text-sm font-medium text-ink">
        {label}
        {max && <span className="font-normal text-muted"> · up to {max}</span>}
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {all.map((opt) => {
          const on = value.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(opt)}
              className={`inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors ${
              on ? 'bg-brand text-white' : 'bg-surface text-ink ring-1 ring-line hover:bg-canvas'}`
              }>
              
              {on && <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />}
              {opt}
            </button>);

        })}
      </div>
      {allowCustom &&
      <div className="mt-2 flex gap-2">
          <label className="sr-only" htmlFor={`${label}-custom`}>
            Add your own
          </label>
          <input
          id={`${label}-custom`}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Add another skill"
          className="h-11 min-w-0 flex-1 rounded-full bg-surface px-4 text-[15px] text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-brand" />
        
          <button type="button" onClick={addCustom} disabled={!custom.trim()} aria-label="Add skill" className="grid h-11 w-11 place-items-center rounded-full bg-canvas text-ink ring-1 ring-line disabled:opacity-40">
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>
      }
    </fieldset>);

}