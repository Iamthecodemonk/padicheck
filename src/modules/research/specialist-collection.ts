import type { Database, SqlExecutor } from '../../database/index.js';
import type { Investigation } from '../investigations/types.js';
import type { SpecialistCheck } from './specialist-types.js';
import { createHash } from 'node:crypto';

export type SpecialistAdapter = { signature: string; run(row: Investigation, authorize: () => Promise<unknown>): Promise<SpecialistCheck[]> };
export async function collectSpecialistChecks(db: Database, row: Investigation, adapter: SpecialistAdapter, authorize: (client?: SqlExecutor) => Promise<unknown>) {
  if (row.investigation_type === 'contract_review') return;
  const existing = await db.query(`SELECT 1 FROM sources s JOIN investigation_sources l ON l.source_id=s.source_id
    WHERE l.investigation_id=$1 AND s.metadata->>'origin'='specialist_check' AND s.metadata->>'config_signature'=$2 LIMIT 1`, [row.investigation_id, adapter.signature]);
  if (existing.rowCount) return;
  await authorize();
  const checks = await adapter.run(row, authorize);
  if (!checks.length) return;
  await authorize();
  // Network work is complete before this atomic persistence step. Retrying a
  // persisted check with the same configuration does not repeat provider calls.
  await db.transaction(async client => {
    await authorize(client);
    for (const check of checks.slice(0, 4)) {
      const excerpt = check.checked_at ? `${check.provider}: ${check.summary}\n${check.facts.map(fact => `${fact.label}: ${fact.value}`).join('\n')}\nThis provider response does not establish personal identity, property title or trustworthiness.` : null;
      const source = (await client.query(`INSERT INTO sources(source_type,url,title,publisher,excerpt,content_hash,fetched_at,visibility,metadata)
        VALUES('external_api',$1,$2,$3,$4,$5,$6,'private',$7::jsonb) RETURNING source_id`,
      [check.source_url, `${check.kind} check: ${check.status.replace(/_/g, ' ')}`, check.provider, excerpt, excerpt ? createHash('sha256').update(excerpt).digest('hex') : null, check.checked_at,
        JSON.stringify({ origin: 'specialist_check', content_kind: 'provider_record', content_retrieved: !!check.checked_at,
          config_signature: adapter.signature, specialist_check: check })])).rows[0]!;
      await client.query(`INSERT INTO investigation_sources(investigation_id,source_id,discovery_method,relevance_rank,used_in_analysis)
        VALUES($1,$2,'external_api',1,false)`, [row.investigation_id, source.source_id]);
    }
  });
}
