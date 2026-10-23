import React, { useState } from 'react';
import { toast } from 'sonner';
import { CheckIcon } from 'lucide-react';
import { CheckoutSheet } from './CheckoutSheet';
import { ConfirmSheet } from '../ConfirmSheet';
import { useTrust } from '../../contexts/TrustContext';
import { plans, type Plan } from '../../data/plans';
import { track } from '../../utils/analytics';
import { formatNaira } from '../../utils/checks';

interface PlanPickerProps {
  audience: 'consumer' | 'business';
  /** When false, buttons route visitors to sign up instead of opening checkout. */
  signedIn: boolean;
  onRequireSignIn?: () => void;
}

/** Plan cards with monthly/yearly toggle, upgrade/downgrade and checkout. Shared by Pricing, Billing and the Business portal. */
export function PlanPicker({ audience, signedIn, onRequireSignIn }: PlanPickerProps) {
  const { subscription, setSubscription, addInvoice, notify } = useTrust();
  const [period, setPeriod] = useState<'monthly' | 'yearly'>(subscription.period);
  const [checkout, setCheckout] = useState<Plan | null>(null);
  const [downgrade, setDowngrade] = useState<Plan | null>(null);
  const list = plans.filter((p) => p.audience === audience);
  const currentIndex = plans.findIndex((p) => p.id === subscription.planId);
  const renews = () => new Date(Date.now() + (period === 'yearly' ? 365 : 30) * 864e5).toISOString();

  const choose = (p: Plan) => {
    if (!signedIn) return onRequireSignIn?.();
    if (p.id === subscription.planId && period === subscription.period) return;
    const idx = plans.findIndex((x) => x.id === p.id);
    if (p.monthly === 0 || idx < currentIndex && plans[currentIndex]?.audience === p.audience) setDowngrade(p);else
    setCheckout(p);
  };

  return (
    <div>
      <div role="radiogroup" aria-label="Billing period" className="mx-auto grid w-full max-w-xs grid-cols-2 gap-1 rounded-2xl bg-surface p-1 ring-1 ring-line">
        {(['monthly', 'yearly'] as const).map((p) =>
        <button key={p} type="button" role="radio" aria-checked={period === p} onClick={() => setPeriod(p)} className={`h-11 rounded-xl text-sm font-semibold transition-colors ${period === p ? 'bg-brand text-white' : 'text-ink-soft'}`}>
            {p === 'monthly' ? 'Monthly' : 'Yearly · save 17%'}
          </button>
        )}
      </div>
      <ul className="mt-6 grid gap-4 md:grid-cols-3">
        {list.map((p) => {
          const price = period === 'monthly' ? p.monthly : p.yearly;
          const current = signedIn && p.id === subscription.planId && subscription.status === 'active';
          return (
            <li key={p.id} className={`flex flex-col rounded-3xl bg-surface p-6 ${p.highlight ? 'ring-2 ring-brand' : 'ring-1 ring-line'}`}>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-ink">{p.name}</h3>
                {p.highlight && <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-dark">Most popular</span>}
              </div>
              <p className="mt-1 text-sm text-muted">{p.tagline}</p>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-ink">{price ? formatNaira(price) : 'Free'}</span>
                {price > 0 && <span className="text-muted">/{period === 'monthly' ? 'month' : 'year'}</span>}
              </p>
              <ul className="mt-5 space-y-2.5">
                {p.features.map((f) =>
                <li key={f} className="flex gap-2 text-[15px] text-ink-soft">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={3} aria-hidden="true" /> {f}
                  </li>
                )}
              </ul>
              <div className="mt-auto pt-6">
              <button
                  type="button"
                  onClick={() => choose(p)}
                  disabled={current && period === subscription.period}
                  className={`inline-flex h-12 w-full items-center justify-center rounded-2xl font-semibold transition-colors disabled:opacity-60 ${
                  p.highlight ? 'bg-brand text-white hover:bg-brand-dark' : 'text-ink ring-1 ring-line hover:bg-canvas'}`
                  }>
                  
                {current ? period === subscription.period ? 'Current plan' : `Switch to ${period}` : !signedIn ? price ? 'Get started' : 'Start free' : plans.findIndex((x) => x.id === p.id) < currentIndex && plans[currentIndex]?.audience === audience ? 'Downgrade' : 'Upgrade'}
              </button>
              </div>
            </li>);

        })}
      </ul>

      <CheckoutSheet
        open={checkout !== null}
        onClose={() => setCheckout(null)}
        title={`${checkout?.name ?? ''} · ${period}`}
        description="You can cancel any time. Your plan renews automatically until you do."
        amountNaira={checkout ? period === 'monthly' ? checkout.monthly : checkout.yearly : 0}
        onPaid={(method, ref) => {
          if (!checkout) return;
          setSubscription({ planId: checkout.id, period, status: 'active', renewsAt: renews() });
          addInvoice({ id: ref, label: `${checkout.name} · ${period}`, amountNaira: period === 'monthly' ? checkout.monthly : checkout.yearly, status: 'paid', method, at: new Date().toISOString() });
          notify({ category: 'subscription', title: `You’re on ${checkout.name}`, body: `Renews automatically. Manage it in Billing.`, to: '/account/billing' });
          track('subscription_started', { plan: checkout.id, period });
          track('payment_completed', { plan: checkout.id });
        }} />
      
      <ConfirmSheet
        open={downgrade !== null}
        onClose={() => setDowngrade(null)}
        onConfirm={() => {
          if (!downgrade) return;
          setSubscription({ ...subscription, planId: downgrade.id, period });
          toast.success(`Switching to ${downgrade.name} at your next renewal`);
          setDowngrade(null);
        }}
        title={`Downgrade to ${downgrade?.name}?`}
        description="You keep your current features until the end of this billing period. Nothing is refunded for the remaining time."
        confirmLabel="Downgrade" />
      
    </div>);

}