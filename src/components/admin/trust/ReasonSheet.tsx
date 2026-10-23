import React, { useEffect, useState } from 'react';
import { BottomSheet } from '../../BottomSheet';
import { Field } from '../Field';
import { textareaClass } from '../../../utils/formStyles';

interface ReasonSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  label?: string;
  placeholder?: string;
  /** Reasons are required for anything users or businesses will see. */
  minLength?: number;
  onConfirm: (reason: string) => void;
}

/** Confirmation that captures the reason recorded in the audit log and shown to the affected party. */
export function ReasonSheet({ open, onClose, title, description, confirmLabel, tone = 'default', label = 'Reason', placeholder, minLength = 10, onConfirm }: ReasonSheetProps) {
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (open) {
      setReason('');
      setTried(false);
    }
  }, [open]);
  const tooShort = reason.trim().length < minLength;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
      <button
        type="button"
        onClick={() => {
          setTried(true);
          if (tooShort) return;
          onConfirm(reason.trim());
        }}
        className={`inline-flex h-12 w-full items-center justify-center rounded-2xl font-semibold text-white transition-colors ${tone === 'danger' ? 'bg-danger hover:opacity-90' : 'bg-brand hover:bg-brand-dark'}`}>
        
          {confirmLabel}
        </button>
      }>
      
      <Field label={label} error={tried && tooShort ? `Write at least ${minLength} characters — this is recorded in the audit log` : undefined} hint="Recorded with your name and the time in the audit log">
        <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} className={textareaClass} />
      </Field>
    </BottomSheet>);

}