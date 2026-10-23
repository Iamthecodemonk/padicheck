import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRightIcon, SearchIcon, StoreIcon, UsersRoundIcon } from 'lucide-react';
import { BottomSheet } from '../BottomSheet';
import { captureModes, checkTypes } from '../../data/checkTypes';
import { entityTypes } from '../../data/entityTypes';

/** The single "What do you want to check?" picker, opened from the mobile tab bar and the desktop sidebar. */
export function CheckSheet({ open, onClose }: {open: boolean;onClose: () => void;}) {
  const navigate = useNavigate();
  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="What do you want to check?" description="Check before you trust — pick what you’re dealing with.">
      <ul className="grid grid-cols-4 gap-2" aria-label="Trust checks">
        {entityTypes.map((t) =>
        <li key={t.id}>
            <button
            type="button"
            onClick={() => go(`/verify/${t.id}`)}
            className="flex h-[88px] w-full flex-col items-center justify-center gap-2 rounded-2xl bg-canvas px-1 text-ink transition-colors hover:bg-line/60 active:bg-line">
            
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${t.tile}`}>
                <t.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-center text-[12px] font-semibold leading-tight">{t.id === 'social' ? 'Social' : t.label}</span>
            </button>
          </li>
        )}
      </ul>
      <button type="button" onClick={() => go('/search')} className="mt-2.5 flex h-12 w-full items-center gap-3 rounded-2xl px-3.5 text-left font-medium text-ink ring-1 ring-line hover:bg-canvas">
        <SearchIcon className="h-5 w-5 text-muted" aria-hidden="true" />
        <span className="flex-1">Search businesses, numbers and websites</span>
        <ChevronRightIcon className="h-4 w-4 text-muted" aria-hidden="true" />
      </button>

      <h3 className="mb-2.5 mt-6 text-sm font-medium text-muted">Analyse an offer, contract or message</h3>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {checkTypes.map((type) =>
        <li key={type.id}>
            <button
            type="button"
            onClick={() => go(`/check/${type.id}`)}
            className="flex h-full min-h-[76px] w-full items-center gap-3 rounded-2xl bg-canvas p-3 text-left transition-colors hover:bg-line/60 active:bg-line">
            
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${type.tile}`}>
                <type.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-ink">{type.label}</span>
                <span className="block text-xs leading-snug text-muted">{type.hint}</span>
              </span>
            </button>
          </li>
        )}
      </ul>

      <h3 className="mb-2.5 mt-6 text-sm font-medium text-muted">Or start from something you have</h3>
      <ul className="grid grid-cols-4 gap-2.5">
        {captureModes.map((mode) =>
        <li key={mode.id}>
            <button
            type="button"
            onClick={() => go(mode.to)}
            className="flex h-[84px] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-line text-ink transition-colors hover:bg-canvas active:bg-line">
            
              <span className={`grid h-9 w-9 place-items-center rounded-full ${mode.tile}`}>
                <mode.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-[13px] font-medium">{mode.label}</span>
            </button>
          </li>
        )}
      </ul>

      <button type="button" onClick={() => go('/directory')} className="mt-6 flex w-full items-center gap-3 rounded-2xl bg-sky-soft p-3.5 text-left transition-opacity hover:opacity-90">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky text-white dark:text-navy">
          <StoreIcon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">Explore businesses</span>
          <span className="block text-xs leading-snug text-ink-soft">Browse listed businesses by category and read reviews</span>
        </span>
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-sky" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => go('/talent')} className="mt-2.5 flex w-full items-center gap-3 rounded-2xl bg-brand-soft p-3.5 text-left transition-opacity hover:opacity-90">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-white">
          <UsersRoundIcon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">Jobs & Talent</span>
          <span className="block text-xs leading-snug text-ink-soft">Get matched to jobs, or find staff — free</span>
        </span>
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-brand-dark" aria-hidden="true" />
      </button>
    </BottomSheet>);

}