import React, { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { useAdminData } from './AdminDataContext';
import { allPermissions } from '../data/adminRoles';
import type { AdminRole, AdminSession, AuditCategory, Permissions } from '../types/admin';

interface AdminSessionValue {
  session: AdminSession | null;
  permissions: Permissions;
  roleName: string;
  signIn: (email: string) => void;
  signOut: () => void;
  log: (category: AuditCategory, action: string, detail?: string) => void;
}

const roleLabels: Record<AdminRole, string> = {
  superAdmin: 'Super admin',
  support: 'Support agent',
  finance: 'Finance'
};

const AdminSessionContext = createContext<AdminSessionValue | null>(null);

export function AdminSessionProvider({ role, children }: {role: AdminRole;children: ReactNode;}) {
  const { roles, addAudit } = useAdminData();
  const [stored, setStored] = usePersistentState<Omit<AdminSession, 'role'> | null>('pc-admin-session', {
    name: 'Tunde Bakare',
    email: 'tunde@padicheck.com'
  });

  // Permissions come from the role definition, so edits made in Team & Roles apply immediately.
  const roleDef = roles.find((r) => r.id === role);
  const granted = role === 'superAdmin' ? allPermissions : roleDef?.permissions ?? [];
  const permissions = useMemo(
    () => Object.fromEntries(allPermissions.map((k) => [k, granted.includes(k)])) as Permissions,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [granted.join(',')]
  );

  const name = stored?.name ?? 'System';
  const log = useCallback((category: AuditCategory, action: string, detail?: string) => addAudit({ actor: name, category, action, detail }), [addAudit, name]);

  const value = useMemo<AdminSessionValue>(
    () => ({
      session: stored ? { ...stored, role } : null,
      permissions,
      roleName: roleDef?.name ?? roleLabels[role],
      signIn: (email) => setStored({ name: email.split('@')[0].replace(/\W/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), email }),
      signOut: () => setStored(null),
      log
    }),
    [stored, role, permissions, roleDef, setStored, log]
  );

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession(): AdminSessionValue {
  const ctx = useContext(AdminSessionContext);
  if (!ctx) throw new Error('useAdminSession must be used inside AdminSessionProvider');
  return ctx;
}

export function roleLabel(role: AdminRole): string {
  return roleLabels[role];
}