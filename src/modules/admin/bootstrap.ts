import 'dotenv/config';
import { createDatabase } from '../../database/index.js';

const email = process.argv[2];
if (!email || !process.env.DATABASE_URL) throw new Error('Usage: npm run admin:bootstrap -- owner@example.com (DATABASE_URL required)');
const db = createDatabase(process.env.DATABASE_URL);
try {
  await db.transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [721934202]);
    const existing = await client.query(`SELECT 1 FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id WHERE r.role_key = 'superadmin' LIMIT 1`);
    if (existing.rowCount) throw new Error('A superadmin already exists; use authenticated role administration');
    const user = await client.query("SELECT users_id FROM users WHERE lower(email) = lower($1) AND account_status = 'active' FOR UPDATE", [email]);
    if (!user.rowCount) throw new Error('Register the active owner account first');
    const id = user.rows[0]!.users_id;
    await client.query(`INSERT INTO user_roles (users_id, role_id, granted_by_user_id)
      SELECT $1, role_id, $1 FROM roles WHERE role_key = 'superadmin'`, [id]);
    await client.query(`INSERT INTO admin_audit_logs (actor_user_id, action, target_type, target_id, after_state)
      VALUES ($1, 'roles.bootstrap_superadmin', 'user', $1, $2::jsonb)`, [id, JSON.stringify({ granted_role: 'superadmin' })]);
  });
  console.log('Superadmin bootstrap completed and audited.');
} finally {
  await db.close();
}
