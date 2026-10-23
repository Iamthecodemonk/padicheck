import React from 'react';

interface SegmentedTabsProps<T extends string> {
  tabs: {id: T;label: string;count?: number;}[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}

export function SegmentedTabs<T extends string>({ tabs, value, onChange, label }: SegmentedTabsProps<T>) {
  return (
    <div role="tablist" aria-label={label} className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="flex gap-1 rounded-2xl bg-surface p-1 ring-1 ring-line">
        {tabs.map((t) =>
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition-colors ${
          value === t.id ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`
          }>
          
            {t.label}
            {t.count !== undefined && <span className={value === t.id ? 'text-white/70' : 'text-muted'}>{t.count}</span>}
          </button>
        )}
      </div>
    </div>);

}