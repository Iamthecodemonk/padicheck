import React from 'react';
import { BadgeCheckIcon, BotIcon, CheckIcon, MessageSquareWarningIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import type { SignalSource, TrustSignal } from '../../types/trust';

const groups: {source: SignalSource;label: string;hint: string;icon: typeof BadgeCheckIcon;tone: string;}[] = [
{ source: 'verified', label: 'Verified information', hint: 'Confirmed from an authorised or official source', icon: BadgeCheckIcon, tone: 'bg-brand-soft text-brand-dark' },
{ source: 'reports', label: 'User reports', hint: 'From people who dealt with them. Reviewed by our moderators', icon: MessageSquareWarningIcon, tone: 'bg-sky-soft text-sky' },
{ source: 'ai', label: 'AI risk signals', hint: 'Patterns our models noticed — not confirmed facts', icon: BotIcon, tone: 'bg-violet-soft text-violet' },
{ source: 'warning', label: 'Possible warnings', hint: 'Things worth checking yourself before you commit', icon: TriangleAlertIcon, tone: 'bg-caution-soft text-caution' }];


export function SignalGroups({ signals }: {signals: TrustSignal[];}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {groups.map((g) => {
        const items = signals.filter((s) => s.source === g.source);
        if (!items.length) return null;
        return (
          <section key={g.source} aria-label={g.label} className="rounded-3xl bg-surface p-5">
            <div className="flex items-start gap-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${g.tone}`}>
                <g.icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-semibold text-ink">{g.label}</h3>
                <p className="text-sm text-muted">{g.hint}</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2.5">
              {items.map((s) =>
              <li key={s.text} className="flex gap-2.5 text-[15px] leading-snug text-ink">
                  {s.positive ?
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={3} aria-label="Positive" /> :

                <XIcon className="mt-0.5 h-4 w-4 shrink-0 text-danger" strokeWidth={3} aria-label="Concern" />
                }
                  {s.text}
                </li>
              )}
            </ul>
          </section>);

      })}
    </div>);

}