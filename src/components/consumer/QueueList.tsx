import React from 'react';
import { Link } from 'react-router-dom';
import { CircleCheckIcon, CloudUploadIcon, HourglassIcon, LoaderCircleIcon, RotateCcwIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import { useUser } from '../../contexts/UserContext';
import { formatBytes, formatWhen } from '../../utils/checks';
import type { QueueStatus } from '../../types/check';

const statusMeta: Record<QueueStatus, {label: string;icon: typeof HourglassIcon;tone: string;spin?: boolean;}> = {
  waiting: { label: 'Waiting for connection', icon: HourglassIcon, tone: 'text-caution' },
  uploading: { label: 'Uploading securely', icon: CloudUploadIcon, tone: 'text-ink' },
  processing: { label: 'Analyzing', icon: LoaderCircleIcon, tone: 'text-ink', spin: true },
  done: { label: 'Report ready', icon: CircleCheckIcon, tone: 'text-brand-dark' },
  failed: { label: 'Couldn’t run', icon: TriangleAlertIcon, tone: 'text-danger' }
};

export function QueueList() {
  const { queue, remove, retry, clearFinished } = useUser();

  if (queue.length === 0) {
    return (
      <div className="rounded-3xl bg-surface px-6 py-10 text-center">
        <p className="font-semibold text-ink">Nothing waiting</p>
        <p className="mt-1 text-sm text-muted">Checks you start while offline are kept here and run when you reconnect.</p>
      </div>);

  }

  return (
    <div>
      <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface">
        {queue.map((task) => {
          const meta = statusMeta[task.status];
          return (
            <li key={task.id} className="flex items-center gap-3 py-3 pl-4 pr-2">
              <meta.icon className={`h-5 w-5 shrink-0 ${meta.tone} ${meta.spin ? 'animate-spin' : ''}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{task.label}</p>
                <p className={`text-sm ${meta.tone}`}>
                  {task.status === 'failed' && task.error ? task.error : meta.label}
                  <span className="text-muted">
                    {' '}· {task.credits} credit{task.credits > 1 ? 's' : ''}
                    {task.sizeBytes ? ` · ${formatBytes(task.sizeBytes)}` : ''} · {formatWhen(task.createdAt)}
                  </span>
                </p>
              </div>
              {task.status === 'done' && task.resultId &&
              <Link to={`/result/${task.resultId}`} className="inline-flex h-11 items-center rounded-xl bg-ink px-4 text-sm font-semibold text-white">
                  View
                </Link>
              }
              {task.status === 'failed' &&
              <button type="button" onClick={() => retry(task.id)} aria-label="Retry" className="grid h-11 w-11 place-items-center rounded-full text-ink hover:bg-canvas">
                  <RotateCcwIcon className="h-4 w-4" />
                </button>
              }
              {(task.status === 'waiting' || task.status === 'failed') &&
              <button type="button" onClick={() => remove(task.id)} aria-label={`Remove ${task.label}`} className="grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-canvas hover:text-ink">
                  <XIcon className="h-4 w-4" />
                </button>
              }
            </li>);

        })}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-3 px-1">
        <p className="text-xs text-muted">Stored privately on this device. Credits are only used when a check runs.</p>
        {queue.some((t) => t.status === 'done') &&
        <button type="button" onClick={clearFinished} className="h-11 shrink-0 rounded-xl px-3 text-sm font-semibold text-ink hover:bg-surface">
            Clear finished
          </button>
        }
      </div>
    </div>);

}