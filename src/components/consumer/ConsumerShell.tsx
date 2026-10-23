import React from 'react';
import { ConsumerLayout } from './ConsumerLayout';
import { PwaProvider } from '../../contexts/PwaContext';
import { UserProvider } from '../../contexts/UserContext';
import type { PlatformPreference } from '../../types/pwa';

interface ConsumerShellProps {
  platformPreview: PlatformPreference;
  simulateOffline: boolean;
}

export function ConsumerShell({ platformPreview, simulateOffline }: ConsumerShellProps) {
  return (
    <PwaProvider app="consumer" platformPreview={platformPreview} simulateOffline={simulateOffline}>
      <UserProvider>
        <ConsumerLayout />
      </UserProvider>
    </PwaProvider>);

}