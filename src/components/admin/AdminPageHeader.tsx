import React, { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon } from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle';

interface AdminPageHeaderProps {
  title: string;
  subtitle?: string;
  back?: string;
  actions?: ReactNode;
}

export function AdminPageHeader({ title, subtitle, back, actions }: AdminPageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 px-4 pb-4 pt-5 md:px-8 md:pb-6 md:pt-8">
      <div className="min-w-0 flex-1">
        {back &&
        <Link to={back} className="-ml-2 mb-1 inline-flex h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-muted hover:text-ink">
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" /> Back
          </Link>
        }
        <h1 className="truncate text-2xl font-bold text-ink md:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <ThemeToggle />
      </div>
    </div>);

}