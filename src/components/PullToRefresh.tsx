import React, { useRef, useState, type ReactNode } from 'react';
import { RefreshCwIcon } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

const TRIGGER = 64;

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY > 0 || refreshing) return;
    startY.current = e.touches[0].clientY;
    setDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    const delta = e.touches[0].clientY - startY.current;
    setPull(delta > 0 ? Math.min(delta * 0.5, 96) : 0);
  };
  const onTouchEnd = async () => {
    if (startY.current === null) return;
    startY.current = null;
    setDragging(false);
    if (pull >= TRIGGER) {
      setRefreshing(true);
      setPull(52);
      await onRefresh();
      setRefreshing(false);
    }
    setPull(0);
  };

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div
        aria-hidden={!refreshing}
        className="flex items-center justify-center overflow-hidden"
        style={{ height: pull, transition: dragging ? 'none' : 'height 220ms cubic-bezier(0.23, 1, 0.32, 1)' }}>
        
        <RefreshCwIcon
          className={`h-5 w-5 text-muted ${refreshing ? 'animate-spin' : ''}`}
          style={{ transform: refreshing ? undefined : `rotate(${pull * 3}deg)`, opacity: Math.min(pull / TRIGGER, 1) }} />
        
        {refreshing && <span className="sr-only">Refreshing</span>}
      </div>
      {children}
    </div>);

}