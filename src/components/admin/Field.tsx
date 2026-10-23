import React, { type ReactNode } from 'react';

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, error, children, className = '' }: FieldProps) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-sm text-danger">{error}</span> : hint ? <span className="mt-1 block text-sm text-muted">{hint}</span> : null}
    </label>);

}