import React from 'react';
import { LockIcon } from 'lucide-react';

export function LockedNotice({ text }: {text: string;}) {
  return (
    <p className="mb-4 flex items-center gap-2 rounded-2xl bg-caution-soft px-4 py-3 text-sm text-caution">
      <LockIcon className="h-4 w-4 shrink-0" aria-hidden="true" /> {text}
    </p>);

}