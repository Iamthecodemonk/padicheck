import React, { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../Logo';

/** Same split layout as Sign in, shared by every authentication screen. */
export function AuthShell({ title, subtitle, children }: {title: string;subtitle?: string;children: ReactNode;}) {
  return (
    <div className="flex min-h-[100dvh] w-full bg-canvas">
      <aside className="hidden w-[44%] flex-col justify-between bg-ink p-12 text-canvas lg:flex">
        <p className="text-sm font-medium opacity-70">PadiCheck</p>
        <div>
          <p className="text-4xl font-bold leading-tight">Check before you trust.</p>
          <p className="mt-4 max-w-sm text-lg opacity-70">Verify people, businesses, websites and opportunities before you buy, pay or engage.</p>
        </div>
        <p className="text-sm opacity-70">Available on Android, iPhone, tablets and desktop.</p>
      </aside>
      <main className="flex flex-1 flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+28px)] sm:items-center sm:justify-center">
        <div className="w-full sm:max-w-sm">
          <Link to="/welcome" aria-label="PadiCheck home">
            <Logo height={32} />
          </Link>
          <h1 className="mt-8 text-2xl font-bold text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>);

}

export const authInput = 'mt-1.5 h-12 w-full rounded-2xl bg-surface px-4 text-base text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-brand aria-[invalid=true]:ring-danger';