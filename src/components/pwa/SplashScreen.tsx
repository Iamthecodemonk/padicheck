import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface SplashScreenProps {
  icon: string;
  name: string;
  dark?: boolean;
}

// Brief launch screen shown once per app session while the shell hydrates.
export function SplashScreen({ icon, name, dark = false }: SplashScreenProps) {
  const key = `pc-splash-${name}`;
  const [visible, setVisible] = useState(() => sessionStorage.getItem(key) !== '1');

  useEffect(() => {
    if (!visible) return;
    sessionStorage.setItem(key, '1');
    const t = window.setTimeout(() => setVisible(false), 650);
    return () => window.clearTimeout(t);
  }, [visible, key]);

  return (
    <AnimatePresence>
      {visible &&
      <motion.div
        className={`fixed inset-0 z-[100] flex flex-col items-center justify-center ${dark ? 'bg-navy' : 'bg-canvas'}`}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        role="status"
        aria-label={`Opening ${name}`}>
        
          <img src={icon} alt="" className="h-20 w-20 rounded-[22px] object-cover shadow-float" />
          <p className={`mt-4 text-lg font-semibold ${dark ? 'text-white' : 'text-ink'}`}>{name}</p>
          <div className={`mt-6 h-1 w-16 overflow-hidden rounded-full ${dark ? 'bg-navy-line' : 'bg-line'}`}>
            <motion.div
            className="h-full w-1/2 rounded-full bg-brand-bright"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} />
          
          </div>
        </motion.div>
      }
    </AnimatePresence>);

}