import React, { useEffect, useRef, useState } from 'react';
import { CircleCheckIcon, CircleXIcon, LoaderCircleIcon, LockIcon, BanIcon } from 'lucide-react';
import { BottomSheet } from '../BottomSheet';
import { Field } from '../admin/Field';
import { paymentMethods } from '../../data/plans';
import { formatNaira } from '../../utils/checks';
import { inputClass, primaryButton, secondaryButton } from '../../utils/formStyles';

type Phase = 'details' | 'processing' | 'success' | 'failed' | 'cancelled';

interface CheckoutSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  amountNaira: number;
  onPaid: (method: string, reference: string) => void;
}

/**
 * Checkout UI. In production this hands off to the payment provider (Paystack/Flutterwave for NGN,
 * Stripe for international cards) and confirms via webhook before granting access.
 * Test: card ending 0002 declines.
 */
export function CheckoutSheet({ open, onClose, title, description, amountNaira, onPaid }: CheckoutSheetProps) {
  const [phase, setPhase] = useState<Phase>('details');
  const [method, setMethod] = useState<(typeof paymentMethods)[number]['id']>('card');
  const [card, setCard] = useState('');
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const timer = useRef<number>();

  useEffect(() => {
    if (open) {
      setPhase('details');
      setError('');
      setCard('');
    }
    return () => window.clearTimeout(timer.current);
  }, [open]);

  const pay = () => {
    const digits = card.replace(/\D/g, '');
    if ((method === 'card' || method === 'intl') && digits.length < 15) {
      setError('Enter a valid card number');
      return;
    }
    setError('');
    setPhase('processing');
    timer.current = window.setTimeout(() => {
      if ((method === 'card' || method === 'intl') && digits.endsWith('0002')) {
        setPhase('failed');
        return;
      }
      const ref = `PCK-${Date.now().toString(36).toUpperCase()}`;
      setReference(ref);
      setPhase('success');
      onPaid(paymentMethods.find((m) => m.id === method)?.label ?? method, ref);
    }, 1800);
  };

  const cancel = () => {
    window.clearTimeout(timer.current);
    setPhase('cancelled');
  };

  const footer =
  phase === 'details' ?
  <button type="button" onClick={pay} className={`${primaryButton} w-full`}>
        <LockIcon className="h-4 w-4" aria-hidden="true" /> Pay {formatNaira(amountNaira)}
      </button> :
  phase === 'processing' ?
  <button type="button" onClick={cancel} className={`${secondaryButton} w-full`}>
        Cancel payment
      </button> :
  phase === 'success' ?
  <button type="button" onClick={onClose} className={`${primaryButton} w-full`}>
        Done
      </button> :

  <div className="flex gap-2">
        <button type="button" onClick={onClose} className={`${secondaryButton} flex-1`}>
          Close
        </button>
        <button type="button" onClick={() => setPhase('details')} className={`${primaryButton} flex-1`}>
          Try again
        </button>
      </div>;


  return (
    <BottomSheet open={open} onClose={phase === 'processing' ? cancel : onClose} dismissible={phase !== 'processing'} title={title} description={phase === 'details' ? description : undefined} footer={footer}>
      {phase === 'details' &&
      <div className="space-y-4">
          <fieldset>
            <legend className="text-sm font-medium text-ink">Pay with</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {paymentMethods.map((m) =>
            <button
              key={m.id}
              type="button"
              aria-pressed={method === m.id}
              onClick={() => setMethod(m.id)}
              className={`rounded-2xl p-3 text-left ring-1 transition-colors ${method === m.id ? 'bg-brand-soft ring-2 ring-brand' : 'ring-line hover:bg-canvas'}`}>
              
                  <span className="block font-semibold text-ink">{m.label}</span>
                  <span className="block text-xs text-muted">{m.hint}</span>
                </button>
            )}
            </div>
          </fieldset>
          {(method === 'card' || method === 'intl') &&
        <Field label="Card number" error={error || undefined}>
              <input inputMode="numeric" autoComplete="cc-number" value={card} onChange={(e) => setCard(e.target.value.replace(/[^\d ]/g, '').slice(0, 23))} placeholder="4242 4242 4242 4242" className={inputClass} />
            </Field>
        }
          {method === 'transfer' && <p className="rounded-2xl bg-canvas p-4 text-sm text-ink-soft">You’ll get a one-time account number. Your plan starts as soon as the transfer lands — usually within a minute.</p>}
          {method === 'ussd' && <p className="rounded-2xl bg-canvas p-4 text-sm text-ink-soft">We’ll show a code like *737*000*{amountNaira}# to dial from the phone linked to your bank.</p>}
          <p className="flex items-center gap-2 text-xs text-muted">
            <LockIcon className="h-3.5 w-3.5" aria-hidden="true" /> Card details go straight to our licensed payment partner. PadiCheck never stores them.
          </p>
        </div>
      }
      {phase === 'processing' &&
      <div className="py-8 text-center" role="status">
          <LoaderCircleIcon className="mx-auto h-10 w-10 animate-spin text-brand" aria-hidden="true" />
          <p className="mt-4 font-semibold text-ink">Confirming your payment…</p>
          <p className="mt-1 text-sm text-muted">Don’t close the app. This usually takes a few seconds.</p>
        </div>
      }
      {phase === 'success' &&
      <div className="py-6 text-center" role="status">
          <CircleCheckIcon className="mx-auto h-12 w-12 text-brand" aria-hidden="true" />
          <p className="mt-3 text-lg font-semibold text-ink">Payment successful</p>
          <dl className="mx-auto mt-4 max-w-xs divide-y divide-line rounded-2xl bg-canvas text-sm">
            <div className="flex justify-between p-3">
              <dt className="text-muted">Amount</dt>
              <dd className="font-semibold text-ink">{formatNaira(amountNaira)}</dd>
            </div>
            <div className="flex justify-between p-3">
              <dt className="text-muted">Reference</dt>
              <dd className="font-mono text-ink">{reference}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-muted">A receipt has been emailed to you and added to Billing.</p>
        </div>
      }
      {phase === 'failed' &&
      <div className="py-6 text-center" role="alert">
          <CircleXIcon className="mx-auto h-12 w-12 text-danger" aria-hidden="true" />
          <p className="mt-3 text-lg font-semibold text-ink">Payment declined</p>
          <p className="mt-1 text-sm text-muted">Your bank declined this card. You haven’t been charged. Try another card or pay by transfer.</p>
        </div>
      }
      {phase === 'cancelled' &&
      <div className="py-6 text-center" role="status">
          <BanIcon className="mx-auto h-12 w-12 text-muted" aria-hidden="true" />
          <p className="mt-3 text-lg font-semibold text-ink">Payment cancelled</p>
          <p className="mt-1 text-sm text-muted">Nothing was charged. Your current plan hasn’t changed.</p>
        </div>
      }
    </BottomSheet>);

}