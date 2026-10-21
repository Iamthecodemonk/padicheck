import type { Database } from '../../database/index.js';
export const platformTables = ['auth_sessions','auth_totp_factors','auth_recovery_codes','auth_login_challenges',
  'investigation_bookmarks','notification_preferences','user_notifications','business_memberships','business_invitations','user_api_keys'];
export async function platformReadiness(db: Database) {
  for (const table of platformTables) await db.query(`SELECT * FROM ${table} LIMIT 0`);
}
