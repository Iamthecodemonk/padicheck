import React from 'react';
import { AdminLayout } from './AdminLayout';
import { AdminDataProvider } from '../../contexts/AdminDataContext';
import { AdminSessionProvider } from '../../contexts/AdminSessionContext';
import { PwaProvider } from '../../contexts/PwaContext';
import type { AdminRole } from '../../types/admin';
import type { PlatformPreference } from '../../types/pwa';

interface AdminShellProps {
  platformPreview: PlatformPreference;
  simulateOffline: boolean;
  adminRole: AdminRole;
}

export function AdminShell({ platformPreview, simulateOffline, adminRole }: AdminShellProps) {
  return (
    <PwaProvider app="admin" platformPreview={platformPreview} simulateOffline={simulateOffline}>
      <AdminDataProvider>
        <AdminSessionProvider role={adminRole}>
          <AdminLayout />
        </AdminSessionProvider>
      </AdminDataProvider>
    </PwaProvider>);

}