import React, { useEffect, useState, type ReactNode } from 'react';
import { BottomSheet } from './BottomSheet';

interface ConfirmSheetProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  requireText?: string;
  children?: ReactNode;
}

export function ConfirmSheet({ open, onClose, onConfirm, title, description, confirmLabel, tone = 'default', requireText, children }: ConfirmSheetProps) {
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);
  const blocked = requireText !== undefined && typed.trim().toUpperCase() !== requireText;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
      <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="h-12 rounded-2xl border border-line font-semibold text-ink transition-colors hover:bg-canvas">
            Cancel
          </button>
          <button
          type="button"
          disabled={blocked}
          onClick={onConfirm}
          className={`h-12 rounded-2xl font-semibold text-white transition-colors disabled:opacity-40 ${
          tone === 'danger' ? 'bg-danger hover:bg-danger/90' : 'bg-brand hover:bg-brand-dark'}`
          }>
          
            {confirmLabel}
          </button>
        </div>
      }>
      
      {children}
      {requireText &&
      <label className="block">
          <span className="text-sm text-muted">
            Type <strong className="font-semibold text-ink">{requireText}</strong> to confirm
          </span>
          <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoCapitalize="characters"
          className="mt-2 h-12 w-full rounded-2xl bg-canvas px-4 text-base text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-brand" />
        
        </label>
      }
    </BottomSheet>);

}