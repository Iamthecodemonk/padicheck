import { useCallback, useEffect, useRef } from 'react';
import { usePersistentState } from './usePersistentState';
import { demoResultByType } from '../data/results';
import { makeId } from '../utils/checks';
import type { QueuedTask } from '../types/check';

interface QueueOptions {
  online: boolean;
  charge: (task: QueuedTask) => boolean;
  onReady: (task: QueuedTask) => void;
}

export interface OfflineQueueApi {
  queue: QueuedTask[];
  enqueue: (task: Omit<QueuedTask, 'id' | 'status' | 'createdAt'>) => QueuedTask;
  remove: (id: string) => void;
  retry: (id: string) => void;
  clearFinished: () => void;
}

// Each task's id doubles as its idempotency key, so a retried upload is never charged twice.
export function useOfflineQueue({ online, charge, onReady }: QueueOptions): OfflineQueueApi {
  const [queue, setQueue] = usePersistentState<QueuedTask[]>('pc-offline-queue', []);
  const activeRef = useRef<string | null>(null);
  const chargeRef = useRef(charge);
  const readyRef = useRef(onReady);
  chargeRef.current = charge;
  readyRef.current = onReady;

  const patch = useCallback(
    (id: string, next: Partial<QueuedTask>) => setQueue((q) => q.map((t) => t.id === id ? { ...t, ...next } : t)),
    [setQueue]
  );

  // Recover tasks interrupted by a closed app or an update.
  useEffect(() => {
    setQueue((q) => q.map((t) => t.status === 'uploading' || t.status === 'processing' ? { ...t, status: 'waiting' } : t));
  }, [setQueue]);

  useEffect(() => {
    if (!online || activeRef.current) return;
    const next = queue.find((t) => t.status === 'waiting');
    if (!next) return;
    activeRef.current = next.id;
    patch(next.id, { status: 'uploading', error: undefined });

    window.setTimeout(() => {
      if (!chargeRef.current(next)) {
        patch(next.id, { status: 'failed', error: 'Not enough credits' });
        activeRef.current = null;
        return;
      }
      patch(next.id, { status: 'processing' });
      window.setTimeout(() => {
        const resultId = demoResultByType[next.type];
        patch(next.id, { status: 'done', resultId });
        activeRef.current = null;
        readyRef.current({ ...next, status: 'done', resultId });
      }, 2400);
    }, 1400);
  }, [online, queue, patch]);

  const enqueue = useCallback(
    (task: Omit<QueuedTask, 'id' | 'status' | 'createdAt'>) => {
      const full: QueuedTask = { ...task, id: makeId('q'), status: 'waiting', createdAt: new Date().toISOString() };
      setQueue((q) => [full, ...q]);
      return full;
    },
    [setQueue]
  );

  const remove = useCallback((id: string) => setQueue((q) => q.filter((t) => t.id !== id)), [setQueue]);
  const retry = useCallback((id: string) => patch(id, { status: 'waiting', error: undefined }), [patch]);
  const clearFinished = useCallback(() => setQueue((q) => q.filter((t) => t.status !== 'done')), [setQueue]);

  return { queue, enqueue, remove, retry, clearFinished };
}