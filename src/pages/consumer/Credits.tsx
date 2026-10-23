import React, { useState } from 'react';
import { toast } from 'sonner';
import { CheckIcon, LoaderCircleIcon, LockIcon, WifiOffIcon } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { PageHeader } from '../../components/consumer/PageHeader';
import { usePwa } from '../../contexts/PwaContext';
import { useUser } from '../../contexts/UserContext';
import { checkTypes } from '../../data/checkTypes';
import { usePlatform } from '../../contexts/PlatformContext';
import { formatNaira, formatWhen } from '../../utils/checks';

export function Credits() {
  const { credits, transactions, addCredits } = useUser();
  const { online } = usePwa();
  const [buyOpen, setBuyOpen] = useState(false);
  const { activePackages: creditPackages } = usePlatform();
  const [selected, setSelected] = useState(() => creditPackages.find((p) => p.featured)?.id ?? creditPackages[0]?.id ?? '');
  const [paying, setPaying] = useState(false);
  const pkg = creditPackages.find((p) => p.id === selected) ?? creditPackages[0];

  const pay = async () => {
    if (!pkg) return;
    setPaying(true);
    await new Promise((r) => window.setTimeout(r, 1600));
    addCredits(pkg.credits, `${pkg.name} pack`);
    setPaying(false);
    setBuyOpen(false);
    toast.success(`${pkg.credits} credits added`, { description: `Paid ${formatNaira(pkg.priceNaira)}` });
  };

  return (
    <>
      <PageHeader title="Credits" />
      <div className="mx-auto w-full max-w-6xl px-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12 lg:px-10">
        <div>
          <section aria-label="Balance" className="rounded-3xl bg-ink p-6 text-white">
            <p className="text-sm text-navy-text">Available balance</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-6xl font-bold tracking-tight">{credits}</span>
              <span className="text-lg text-navy-text">credits</span>
            </p>
            {credits < 5 && <p className="mt-3 text-sm text-brand-bright">You’re running low — most checks use 2–3 credits.</p>}
            <button
              type="button"
              onClick={() => setBuyOpen(true)}
              disabled={!online || !pkg}
              className="mt-6 h-12 w-full rounded-2xl bg-brand-bright font-semibold text-navy transition-colors hover:bg-white disabled:bg-navy-light disabled:text-navy-text">
              
              Buy credits
            </button>
            {!online &&
            <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-navy-text">
                <WifiOffIcon className="h-4 w-4" aria-hidden="true" /> Purchases need a connection
              </p>
            }
          </section>

          <section aria-labelledby="costs-heading" className="mt-7">
            <h2 id="costs-heading" className="font-semibold text-ink">
              What checks cost
            </h2>
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-3xl bg-surface">
              {checkTypes.map((t) =>
              <li key={t.id} className="flex min-h-[56px] items-center gap-3 px-4">
                  <span className={`grid h-9 w-9 place-items-center rounded-xl ${t.tile}`}>
                    <t.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  </span>
                  <span className="flex-1 text-ink">{t.longLabel}</span>
                  <span className="font-semibold text-ink">{t.credits}</span>
                </li>
              )}
            </ul>
          </section>
        </div>

        <section aria-labelledby="activity-heading" className="mt-7 lg:mt-0">
          <h2 id="activity-heading" className="font-semibold text-ink">
            Activity
          </h2>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-3xl bg-surface">
            {transactions.map((tx) =>
            <li key={tx.id} className="flex min-h-[64px] items-center gap-3 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{tx.label}</p>
                  <p className="text-sm text-muted">{formatWhen(tx.at)}</p>
                </div>
                <span className={`font-semibold tabular-nums ${tx.amount > 0 ? 'text-brand-dark' : 'text-ink'}`}>
                  {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                </span>
              </li>
            )}
          </ul>
        </section>
      </div>

      <BottomSheet
        open={buyOpen}
        onClose={() => !paying && setBuyOpen(false)}
        dismissible={!paying}
        title="Buy credits"
        description="Credits never expire."
        footer={
        <button
          type="button"
          onClick={pay}
          disabled={paying}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-80">
          
            {paying ?
          <>
                <LoaderCircleIcon className="h-5 w-5 animate-spin" aria-hidden="true" /> Confirming payment…
              </> :

          `Pay ${formatNaira(pkg?.priceNaira ?? 0)}`
          }
          </button>
        }>
        
        <ul className="space-y-2.5" role="radiogroup" aria-label="Credit packages">
          {creditPackages.map((p) => {
            const on = p.id === selected;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setSelected(p.id)}
                  className={`flex w-full items-center gap-4 rounded-2xl p-4 text-left ring-1 transition-colors ${on ? 'bg-brand-soft ring-2 ring-brand' : 'bg-surface ring-line hover:bg-canvas'}`}>
                  
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">
                      {p.credits} credits · {p.name}
                    </span>
                    {(p.note || p.featured) && <span className="block text-sm text-muted">{p.featured ? `Recommended${p.note ? ` · ${p.note}` : ''}` : p.note}</span>}
                  </span>
                  <span className="font-semibold text-ink">{formatNaira(p.priceNaira)}</span>
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${on ? 'bg-brand text-white' : 'border-2 border-line'}`}>
                    {on && <CheckIcon className="h-4 w-4" aria-hidden="true" />}
                  </span>
                </button>
              </li>);

          })}
        </ul>
        <p className="mt-4 flex gap-2 text-sm text-muted">
          <LockIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Pay by card, bank transfer or USSD through our payment partner. PadiCheck never stores your card details.
        </p>
      </BottomSheet>
    </>);

}