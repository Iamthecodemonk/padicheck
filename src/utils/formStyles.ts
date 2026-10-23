export const inputClass =
'mt-1.5 h-12 w-full rounded-2xl bg-canvas px-4 text-base text-ink outline-none ring-1 ring-line placeholder:text-muted/80 focus:ring-2 focus:ring-brand disabled:opacity-60';

export const textareaClass =
'mt-1.5 block w-full resize-y rounded-2xl bg-canvas p-4 text-base leading-relaxed text-ink outline-none ring-1 ring-line placeholder:text-muted/80 focus:ring-2 focus:ring-brand disabled:opacity-60';

export const primaryButton =
'inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand px-5 font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-40';

export const secondaryButton =
'inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 font-semibold text-ink ring-1 ring-line transition-colors hover:bg-canvas disabled:opacity-40';

export const chipClass = (on: boolean) =>
`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors ${
on ? 'bg-ink text-white' : 'bg-surface text-ink ring-1 ring-line hover:bg-canvas'}`;