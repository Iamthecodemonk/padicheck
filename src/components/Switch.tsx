import React from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="grid h-11 w-14 shrink-0 place-items-center disabled:opacity-40">
      
      <span className={`relative h-7 w-12 rounded-full transition-colors duration-200 ease-out ${checked ? 'bg-brand' : 'bg-line'}`}>
        <span
          className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-card transition-transform duration-200 ease-out ${
          checked ? 'translate-x-5' : 'translate-x-0'}`
          } />
        
      </span>
    </button>);

}