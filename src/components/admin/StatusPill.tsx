import React from 'react';

type Tone = 'good' | 'warn' | 'bad' | 'neutral' | 'info';

const statusMap: Record<string, {tone: Tone;label: string;}> = {
  operational: { tone: 'good', label: 'Operational' },
  degraded: { tone: 'warn', label: 'Degraded' },
  down: { tone: 'bad', label: 'Down' },
  succeeded: { tone: 'good', label: 'Succeeded' },
  pending: { tone: 'warn', label: 'Pending' },
  failed: { tone: 'bad', label: 'Failed' },
  completed: { tone: 'good', label: 'Completed' },
  active: { tone: 'good', label: 'Active' },
  suspended: { tone: 'bad', label: 'Suspended' },
  open: { tone: 'info', label: 'Open' },
  waiting: { tone: 'warn', label: 'Waiting on user' },
  resolved: { tone: 'neutral', label: 'Resolved' },
  ok: { tone: 'good', label: 'Healthy' },
  warn: { tone: 'warn', label: 'Needs review' },
  off: { tone: 'neutral', label: 'Off' }
};

const toneClass: Record<Tone, string> = {
  good: 'bg-brand-soft text-brand-dark',
  warn: 'bg-caution-soft text-caution',
  bad: 'bg-danger-soft text-danger',
  neutral: 'bg-canvas text-muted',
  info: 'bg-ink text-white'
};

export function StatusPill({ status }: {status: string;}) {
  const meta = statusMap[status] ?? { tone: 'neutral' as Tone, label: status };
  return (
    <span className={`inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-semibold ${toneClass[meta.tone]}`}>
      {meta.label}
    </span>);

}