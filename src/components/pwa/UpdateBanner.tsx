import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RefreshCwIcon } from 'lucide-react';
import { usePwa } from '../../contexts/PwaContext';

export function UpdateBanner({ bottomOffsetClass = 'bottom-[calc(env(safe-area-inset-bottom)+92px)] lg:bottom-6' }: {bottomOffsetClass?: string;}) {
  const { sw, identity } = usePwa();
  return (
    <AnimatePresence>
      {sw.updateAvailable &&
      <motion.div
        role="status"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        className={`fixed inset-x-3 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink p-3 pl-4 text-white shadow-float ${bottomOffsetClass}`}>
        
          <RefreshCwIcon className="h-5 w-5 shrink-0 text-brand-bright" aria-hidden="true" />
          <p className="flex-1 text-sm">
            A new version of {identity.name} is available.
            <span className="block text-xs text-navy-text">Your drafts and queued checks are kept.</span>
          </p>
          <button type="button" onClick={sw.applyUpdate} className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-navy transition-colors hover:bg-navy-text">
            Update
          </button>
        </motion.div>
      }
    </AnimatePresence>);

}