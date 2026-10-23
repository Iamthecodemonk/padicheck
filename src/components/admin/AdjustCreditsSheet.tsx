import React, { useEffect, useState } from 'react';
import { MinusIcon, PlusIcon } from 'lucide-react';
import { BottomSheet } from '../BottomSheet';

interface AdjustCreditsSheetProps {
  open: boolean;
  onClose: () => void;
  userName: string;
  balance: number;
  onApply: (delta: number, reason: string) => void;
}

const reasons = ['Refund for failed check', 'Payment issue', 'Goodwill', 'Correction'];

export function AdjustCreditsSheet({ open, onClose, userName, balance, onApply }: AdjustCreditsSheetProps) {
  const [direction, setDirection] = useState<'add' | 'remove'>('add');
  const [amount, setAmount] = useState(3);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setDirection('add');
      setAmount(3);
      setReason('');
      setNote('');
    }
  }, [open]);

  const max = direction === 'remove' ? balance : 500;
  const delta = direction === 'add' ? amount : -amount;
  const valid = amount > 0 && amount <= max && reason !== '';

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Adjust credits"
      description={`${userName} has ${balance} credits. This is recorded in the audit log.`}
      footer={
      <button
        type="button"
        disabled={!valid}
        onClick={() => onApply(delta, note ? `${reason} — ${note}` : reason)}
        className="h-12 w-full rounded-2xl bg-ink font-semibold text-white transition-colors hover:bg-ink-soft disabled:opacity-40">
        
          {direction === 'add' ? `Add ${amount} credit${amount === 1 ? '' : 's'}` : `Remove ${amount} credit${amount === 1 ? '' : 's'}`} · new balance {balance + delta}
        </button>
      }>
      
      <div role="radiogroup" aria-label="Direction" className="grid grid-cols-2 gap-1 rounded-2xl bg-line/60 p-1">
        {(['add', 'remove'] as const).map((d) =>
        <button
          key={d}
          type="button"
          role="radio"
          aria-checked={direction === d}
          onClick={() => setDirection(d)}
          className={`h-11 rounded-xl text-sm font-semibold transition-colors ${direction === d ? 'bg-surface text-ink shadow-card' : 'text-muted'}`}>
          
            {d === 'add' ? 'Add' : 'Remove'}
          </button>
        )}
      </div>

      <div className="mt-5 flex items-center justify-center gap-4">
        <button type="button" aria-label="Decrease" onClick={() => setAmount((a) => Math.max(1, a - 1))} className="grid h-12 w-12 place-items-center rounded-full bg-canvas text-ink hover:bg-line/60">
          <MinusIcon className="h-5 w-5" />
        </button>
        <label className="sr-only" htmlFor="credit-amount">
          Amount
        </label>
        <input
          id="credit-amount"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(Math.min(max, Number(e.target.value.replace(/\D/g, '')) || 0))}
          className="h-14 w-24 rounded-2xl bg-canvas text-center text-3xl font-bold text-ink outline-none focus:ring-2 focus:ring-ink" />
        
        <button type="button" aria-label="Increase" onClick={() => setAmount((a) => Math.min(max, a + 1))} className="grid h-12 w-12 place-items-center rounded-full bg-canvas text-ink hover:bg-line/60">
          <PlusIcon className="h-5 w-5" />
        </button>
      </div>

      <h3 className="mt-6 text-sm font-medium text-muted">Reason (required)</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {reasons.map((r) =>
        <button
          key={r}
          type="button"
          aria-pressed={reason === r}
          onClick={() => setReason(r)}
          className={`h-11 rounded-full px-4 text-sm font-medium transition-colors ${reason === r ? 'bg-ink text-white' : 'bg-canvas text-ink hover:bg-line/60'}`}>
          
            {r}
          </button>
        )}
      </div>
      <label className="mt-4 block">
        <span className="text-sm font-medium text-muted">Note (optional)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="mt-1.5 block w-full resize-none rounded-2xl bg-canvas p-3 text-base text-ink outline-none focus:ring-2 focus:ring-ink" />
        
      </label>
    </BottomSheet>);

}