import React, { ReactNode } from "react";
import { ChevronRightIcon, BoxIcon } from "lucide-react";
interface SettingsRowProps {
  icon: BoxIcon;
  label: string;
  hint?: string;
  value?: string;
  onClick?: () => void;
  trailing?: ReactNode;
  tone?: 'default' | 'danger';
}
export function SettingsRow({
  icon: Icon,
  label,
  hint,
  value,
  onClick,
  trailing,
  tone = 'default'
}: SettingsRowProps) {
  const content = <>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-brand-soft text-brand-dark'}`}>
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-medium ${tone === 'danger' ? 'text-danger' : 'text-ink'}`}>{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
      {value && <span className="shrink-0 text-sm text-muted">{value}</span>}
      {trailing}
      {onClick && !trailing && <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />}
    </>;
  const base = 'flex min-h-[60px] w-full items-center gap-3 px-4 py-2 text-left';
  return <li>
      {onClick ? <button type="button" onClick={onClick} className={`${base} transition-colors hover:bg-canvas/70 active:bg-canvas`}>
          {content}
        </button> : <div className={`${base} pr-2`}>{content}</div>}
    </li>;
}