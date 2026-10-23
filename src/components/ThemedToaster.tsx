import React from 'react';
import { Toaster } from 'sonner';
import { useTheme } from '../contexts/ThemeContext';

export function ThemedToaster() {
  const { resolved } = useTheme();
  return (
    <Toaster
      theme={resolved}
      position="top-center"
      closeButton
      offset={16}
      visibleToasts={3}
      toastOptions={{
        style: {
          borderRadius: 16,
          background: 'rgb(var(--surface))',
          color: 'rgb(var(--ink))',
          border: '1px solid rgb(var(--line))',
          fontFamily: 'Inter, system-ui, sans-serif'
        },
        descriptionClassName: 'text-muted'
      }} />);


}