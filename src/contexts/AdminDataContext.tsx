import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { initialRoles, initialTeam } from '../data/adminRoles';
import { initialAudit, initialCampaigns, initialDataSources, initialSettings, initialTemplates } from '../data/adminPlatform';
import { makeId } from '../utils/checks';
import type { AdminRoleDef, AdminSettings, AuditEntry, Campaign, DataSource, NotificationTemplate, TeamMember } from '../types/admin';

interface AdminDataValue {
  roles: AdminRoleDef[];
  saveRole: (role: AdminRoleDef) => void;
  removeRole: (id: string) => void;
  team: TeamMember[];
  saveMember: (member: TeamMember) => void;
  removeMember: (id: string) => void;
  audit: AuditEntry[];
  addAudit: (entry: Omit<AuditEntry, 'id' | 'at'>) => void;
  dataSources: DataSource[];
  saveDataSource: (source: DataSource) => void;
  templates: NotificationTemplate[];
  saveTemplate: (template: NotificationTemplate) => void;
  campaigns: Campaign[];
  addCampaign: (campaign: Campaign) => void;
  removeCampaign: (id: string) => void;
  settings: AdminSettings;
  saveSettings: (settings: AdminSettings) => void;
}

const AdminDataContext = createContext<AdminDataValue | null>(null);

function upsert<T extends {id: string;}>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id) ? list.map((x) => x.id === item.id ? item : x) : [...list, item];
}

export function AdminDataProvider({ children }: {children: ReactNode;}) {
  const [roles, setRoles] = usePersistentState('pc-admin-roles', initialRoles);
  const [team, setTeam] = usePersistentState('pc-admin-team', initialTeam);
  const [audit, setAudit] = usePersistentState('pc-admin-audit', initialAudit);
  const [dataSources, setDataSources] = usePersistentState('pc-admin-sources', initialDataSources);
  const [templates, setTemplates] = usePersistentState('pc-admin-templates', initialTemplates);
  const [campaigns, setCampaigns] = usePersistentState('pc-admin-campaigns', initialCampaigns);
  const [settings, setSettings] = usePersistentState('pc-admin-settings', initialSettings);

  const value = useMemo<AdminDataValue>(
    () => ({
      roles,
      saveRole: (role) => setRoles((l) => upsert(l, role)),
      removeRole: (id) => setRoles((l) => l.filter((r) => r.id !== id || r.builtIn)),
      team,
      saveMember: (m) => setTeam((l) => upsert(l, m)),
      removeMember: (id) => setTeam((l) => l.filter((m) => m.id !== id)),
      audit,
      addAudit: (entry) => setAudit((l) => [{ ...entry, id: makeId('al'), at: new Date().toISOString() }, ...l].slice(0, 500)),
      dataSources,
      saveDataSource: (s) => setDataSources((l) => upsert(l, s)),
      templates,
      saveTemplate: (t) => setTemplates((l) => upsert(l, t)),
      campaigns,
      addCampaign: (c) => setCampaigns((l) => [c, ...l]),
      removeCampaign: (id) => setCampaigns((l) => l.filter((c) => c.id !== id)),
      settings,
      saveSettings: setSettings
    }),
    [roles, team, audit, dataSources, templates, campaigns, settings, setRoles, setTeam, setAudit, setDataSources, setTemplates, setCampaigns, setSettings]
  );

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

export function useAdminData(): AdminDataValue {
  const ctx = useContext(AdminDataContext);
  if (!ctx) throw new Error('useAdminData must be used inside AdminDataProvider');
  return ctx;
}