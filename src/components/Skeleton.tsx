import React from 'react';

export function Skeleton({ className = '' }: {className?: string;}) {
  return <div aria-hidden="true" className={`animate-pulse rounded-xl bg-line/70 ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-[calc(env(safe-area-inset-top)+20px)] lg:px-8" role="status" aria-label="Loading">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-6 h-36 w-full rounded-3xl" />
      <div className="mt-4 space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-4/5" />
      </div>
    </div>);

}