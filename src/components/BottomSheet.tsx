import React, { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
import { useMediaQuery } from '../hooks/useMediaQuery';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  dismissible?: boolean;
  /** Wider dialog on desktop for side-by-side content. */
  size?: 'md' | 'lg';
}

const EASE = [0.23, 1, 0.32, 1] as const;
const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * The single dialog used across PadiCheck: a bottom sheet on phones, a centred dialog on wider screens.
 * Focus is moved in once on open, trapped while open, and restored on close — re-renders (e.g. typing
 * a message) never steal focus from the field.
 */
export function BottomSheet({ open, onClose, title, description, children, footer, dismissible = true, size = 'md' }: BottomSheetProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const keyboardInset = useKeyboardInset();
  const isWide = useMediaQuery('(min-width: 768px)');
  const dragControls = useDragControls();
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  onCloseRef.current = onClose;
  dismissibleRef.current = dismissible;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissibleRef.current) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => {
      if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus();
    }, 30);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open &&
      <div className="fixed inset-0 z-[70] flex items-end justify-center md:items-center md:p-6" role="presentation">
          <motion.div
          className="absolute inset-0 bg-navy/70 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          onClick={dismissible ? onClose : undefined} />
        
          <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          tabIndex={-1}
          className={`relative flex max-h-[92dvh] w-full flex-col rounded-t-[28px] bg-surface text-ink shadow-sheet outline-none ring-1 ring-line pl-safe pr-safe md:max-h-[86dvh] md:rounded-3xl ${size === 'lg' ? 'md:max-w-2xl' : 'md:max-w-lg'}`}
          style={{ marginBottom: isWide ? 0 : keyboardInset, maxHeight: !isWide && keyboardInset ? `calc(100dvh - ${keyboardInset}px - 16px)` : undefined }}
          initial={isWide ? { opacity: 0, scale: 0.96 } : { y: '100%' }}
          animate={isWide ? { opacity: 1, scale: 1 } : { y: 0 }}
          exit={isWide ? { opacity: 0, scale: 0.96 } : { y: '100%' }}
          transition={{ duration: isWide ? 0.2 : 0.28, ease: EASE }}
          drag={!isWide && dismissible ? 'y' : false}
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.7 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 110 || info.velocity.y > 600) onClose();
          }}>
          
            <div className="flex touch-none justify-center pb-1 pt-3 md:hidden" onPointerDown={(e) => dismissible && dragControls.start(e)} aria-hidden="true">
              <span className="h-1.5 w-10 rounded-full bg-line" />
            </div>
            <div className="flex items-start gap-3 px-5 pb-3 pt-2 md:px-6 md:pt-5">
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="break-words text-lg font-semibold text-ink">
                  {title}
                </h2>
                {description &&
              <p id={descId} className="mt-1 text-sm text-muted">
                    {description}
                  </p>
              }
              </div>
              {dismissible &&
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 -mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-canvas hover:text-ink active:bg-line">
              
                  <XIcon className="h-5 w-5" />
                </button>
            }
            </div>
            <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 md:px-6 ${footer ? 'pb-4' : 'pb-[calc(env(safe-area-inset-bottom)+20px)] md:pb-6'}`}>{children}</div>
            {footer && <div className="border-t border-line bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 md:rounded-b-3xl md:px-6 md:pb-5">{footer}</div>}
          </motion.div>
        </div>
      }
    </AnimatePresence>,
    document.body
  );
}