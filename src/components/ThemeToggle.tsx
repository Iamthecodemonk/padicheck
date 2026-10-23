import React from 'react';
import { MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ThemeToggleProps {
  variant?: 'default' | 'onDark';
  showLabel?: boolean;
  className?: string;
}

export function ThemeToggle({ variant = 'default', showLabel = false, className = '' }: ThemeToggleProps) {
  const { resolved, toggle } = useTheme();
  const dark = resolved === 'dark';
  const Icon = dark ? SunIcon : MoonIcon;
  const label = dark ? 'Light mode' : 'Dark mode';
  const tone =
  variant === 'onDark' ? 'text-navy-text hover:bg-navy-light hover:text-white' : 'text-ink hover:bg-ink/5 active:bg-ink/10';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={showLabel ? undefined : `Switch to ${label.toLowerCase()}`}
      className={`inline-flex h-11 shrink-0 items-center gap-3 transition-colors ${
      showLabel ? 'w-full rounded-xl px-3' : 'w-11 justify-center rounded-full'} ${
      tone} ${className}`}>
      
      <Icon className="h-5 w-5" aria-hidden="true" />
      {showLabel && <span className="text-[15px] font-medium">{label}</span>}
    </button>);

}