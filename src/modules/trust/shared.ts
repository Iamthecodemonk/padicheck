import type { FastifyRequest } from 'fastify';
import type { SqlExecutor } from '../../database/index.js';
import { ApiError } from '../../errors.js';

export const text = (maxLength: number, minLength = 1) => ({ type: 'string', minLength, maxLength, pattern: '\\S' });
export const uuid = { type: 'string', format: 'uuid' };
export const pagination = { type: 'object', additionalProperties: false, properties: {
  limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  offset: { type: 'integer', minimum: 0, maximum: 10000, default: 0 },
} };
export type Page = { limit?: number; offset?: number };
export const params = (name: string) => ({ type: 'object', additionalProperties: false, required: [name], properties: { [name]: uuid } });
export const body = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', additionalProperties: false, properties, required });
export const evidenceSchema = { type: 'array', maxItems: 10, uniqueItems: true, items: uuid };

export async function audit(client: SqlExecutor, request: FastifyRequest, action: string, target: string,
  id: string, before: unknown, after: unknown) {
  await client.query(`INSERT INTO admin_audit_logs (actor_user_id, action, target_type, target_id, before_state, after_state, request_id)
    VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)`,
  [request.principal!.users_id, action, target, id, JSON.stringify(before), JSON.stringify(after), request.id]);
}

// Take the same row lock as deletion, in stable order, before linking uploads.
export async function ownedEvidence(client: SqlExecutor, userId: string, ids: string[]) {
  if (new Set(ids.map(id => id.toLowerCase())).size !== ids.length) throw new ApiError(400, 'duplicate_evidence', 'Evidence must be unique');
  if (!ids.length) return;
  const found = await client.query(`SELECT media_id FROM media_files WHERE media_id = ANY($1::uuid[])
    AND uploaded_by_user_id = $2 AND upload_status = 'ready' AND visibility = 'private'
    AND storage_provider = 'cloudinary' AND provider_delivery_type = 'authenticated'
    ORDER BY media_id FOR UPDATE`, [ids, userId]);
  if (found.rows.length !== ids.length) throw new ApiError(400, 'invalid_evidence', 'Evidence must be your own ready, private upload');
}

export function transition(current: string, desired: string, allowed: Record<string, string[]>) {
  if (!allowed[current]?.includes(desired)) throw new ApiError(409, 'invalid_transition', 'This status transition is not allowed');
}

export function noSelfReview(request: FastifyRequest, owner: unknown) {
  if (owner === request.principal!.users_id) throw new ApiError(403, 'self_review_forbidden', 'You cannot review your own submission');
}

export async function noBusinessConflict(client: SqlExecutor, entityId: string, userId: string) {
  // Hold a shared profile lock so a concurrent claim decision cannot change the
  // ownership check before the moderation transaction commits.
  const profile = (await client.query('SELECT claimed_by_user_id FROM business_profiles WHERE entity_id = $1 FOR SHARE', [entityId])).rows[0];
  if (profile?.claimed_by_user_id === userId) throw new ApiError(403, 'self_review_forbidden', 'Business owners cannot review reports or disputes about their business');
}

export const reportTransitions = { submitted: ['under_review', 'published', 'rejected'], under_review: ['published', 'rejected'], published: ['under_review', 'rejected'] };
export const verificationTransitions = { pending: ['in_review', 'approved', 'rejected'], in_review: ['approved', 'rejected'] };
export const disputeTransitions = { submitted: ['under_review', 'resolved', 'rejected'], under_review: ['resolved', 'rejected'] };
