import { createHash, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Database } from '../../database/index.js';
import type { Authorization, Principal } from '../authorization/index.js';
import { ApiError } from '../../errors.js';
import type { MediaStorage, MediaRow } from './types.js';
import { inspectUpload, mediaFormat, validateUploadResult } from './validation.js';

const paramsSchema = { type: 'object', additionalProperties: false, required: ['media_id'],
  properties: { media_id: { type: 'string', format: 'uuid' } } };
type Params = { media_id: string };

export async function mediaRoutes(app: FastifyInstance, db: Database, access: Authorization,
  storage: MediaStorage | undefined, maxBytes: number) {
  function available(): MediaStorage {
    if (!storage) throw new ApiError(503, 'media_unavailable', 'Media storage is not configured');
    return storage;
  }
  function checkOwner(row: MediaRow | undefined, principal: Principal): asserts row is MediaRow {
    if (!row || (row.uploaded_by_user_id !== principal.users_id && !access.can(principal, 'media.manage'))) {
      throw new ApiError(404, 'media_not_found', 'Media was not found');
    }
  }

  async function checkReadable(row: MediaRow | undefined, principal: Principal): Promise<void> {
    if (!row) throw new ApiError(404, 'media_not_found', 'Media was not found');
    if (row.uploaded_by_user_id === principal.users_id || access.can(principal, 'media.manage')) return;
    const linked = await db.query(`SELECT 1 WHERE
      ($2::boolean AND EXISTS (SELECT 1 FROM verification_evidence WHERE media_id = $1)) OR
      ($3::boolean AND EXISTS (SELECT 1 FROM user_report_evidence WHERE media_id = $1))`,
    [row.media_id, access.can(principal, 'verifications.review'),
      access.can(principal, 'reports.moderate') || access.can(principal, 'disputes.resolve')]);
    if (!linked.rowCount) throw new ApiError(404, 'media_not_found', 'Media was not found');
  }

  app.post('/v1/media', {
    onRequest: access.authenticate,
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const provider = available();
    let data: Buffer | undefined;
    let filename = '';
    let mime = '';
    // Consume every part before uploading: fields, duplicate files and oversized
    // payloads are rejected before any provider call or database insert.
    for await (const part of request.parts({ limits: { files: 1, fields: 0, parts: 1, fileSize: maxBytes } })) {
      if (part.type !== 'file' || part.fieldname !== 'file') throw new ApiError(400, 'invalid_upload', 'Send exactly one file named file');
      data = await part.toBuffer();
      if (part.file.truncated) throw new ApiError(413, 'upload_too_large', 'Upload exceeds the size limit');
      filename = part.filename.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 255);
      mime = part.mimetype;
    }
    if (!data || !filename) throw new ApiError(400, 'invalid_upload', 'A named file is required');
    const detected = await inspectUpload(data, mime);
    const id = randomUUID();
    // Raw assets include their extension in the public ID; images/videos do not.
    const publicId = `padicheck/${request.principal!.users_id}/${id}${detected.resourceType === 'raw' ? `.${detected.format}` : ''}`;
    const spec = { publicId, resourceType: detected.resourceType, bytes: data.length };
    const sha256 = createHash('sha256').update(data).digest('hex');
    await db.query(`INSERT INTO media_files (media_id, uploaded_by_user_id, storage_provider,
      provider_public_id, provider_resource_type, provider_delivery_type, original_filename,
      media_type, mime_type, size_bytes, sha256, visibility, upload_status)
      VALUES ($1, $2, 'cloudinary', $3, $4, 'authenticated', $5, $6, $7, $8, $9, 'private', 'pending')`,
    [id, request.principal!.users_id, publicId, detected.resourceType, filename,
      detected.mediaType, detected.mimeType, data.length, sha256]);
    try {
      const result = validateUploadResult(await provider.upload(data, spec), spec);
      const saved = await db.query<MediaRow>(`UPDATE media_files SET provider_asset_id = $2,
        provider_version = $3, size_bytes = $4, upload_status = 'ready'
        WHERE media_id = $1 AND upload_status = 'pending' RETURNING *`,
      [id, result.assetId, result.version, result.bytes]);
      if (!saved.rows[0]) throw new Error('Pending upload record unavailable');
      reply.header('Cache-Control', 'no-store');
      return reply.code(201).send({ media: saved.rows[0] });
    } catch (error) {
      // Only delete the server-generated public ID, never an untrusted ID from
      // a malformed response. A lost provider response may still mean success.
      try { await provider.destroy(publicId, spec.resourceType); }
      catch { request.log.error({ media_id: id }, 'Upload cleanup needs reconciliation'); }
      try { await db.query("UPDATE media_files SET upload_status = 'failed' WHERE media_id = $1 AND upload_status = 'pending'", [id]); }
      catch { request.log.error({ media_id: id }, 'Upload status needs reconciliation'); }
      if (error instanceof ApiError) throw error;
      throw new ApiError(502, 'upload_failed', 'Upload could not be completed');
    }
  });

  app.get<{ Params: Params }>('/v1/media/:media_id', {
    onRequest: access.authenticate, schema: { params: paramsSchema },
  }, async (request, reply) => {
    const result = await db.query<MediaRow>('SELECT * FROM media_files WHERE media_id = $1', [request.params.media_id]);
    const row = result.rows[0];
    await checkReadable(row, request.principal!);
    reply.header('Cache-Control', 'no-store');
    return { media: row };
  });

  app.post<{ Params: Params }>('/v1/media/:media_id/delivery', {
    onRequest: access.authenticate, schema: { params: paramsSchema },
  }, async (request, reply) => {
    const result = await db.query<MediaRow>('SELECT * FROM media_files WHERE media_id = $1', [request.params.media_id]);
    const row = result.rows[0];
    await checkReadable(row, request.principal!);
    if (!row) throw new ApiError(404, 'media_not_found', 'Media was not found');
    if (row.upload_status !== 'ready') throw new ApiError(409, 'media_not_ready', 'Media is not available for delivery');
    if (row.storage_provider !== 'cloudinary' || row.provider_delivery_type !== 'authenticated') {
      throw new ApiError(409, 'unsupported_storage', 'Stored media delivery configuration is unsupported');
    }
    const expiresAt = Math.floor(Date.now() / 1000) + 300;
    const url = available().download(row.provider_public_id, row.provider_resource_type, mediaFormat(row.mime_type), expiresAt);
    reply.header('Cache-Control', 'no-store');
    return { url, expires_at: expiresAt };
  });

  app.delete<{ Params: Params }>('/v1/media/:media_id', {
    onRequest: access.authenticate, schema: { params: paramsSchema },
  }, async (request, reply) => {
    await db.transaction(async client => {
      const result = await client.query<MediaRow>('SELECT * FROM media_files WHERE media_id = $1 FOR UPDATE', [request.params.media_id]);
      const row = result.rows[0];
      checkOwner(row, request.principal!);
      if (row.upload_status === 'deleted') return;
      if (row.upload_status === 'pending') throw new ApiError(409, 'upload_in_progress', 'Upload is still in progress');
      const references = await client.query(`SELECT 1 WHERE
        EXISTS (SELECT 1 FROM sources WHERE media_id = $1) OR
        EXISTS (SELECT 1 FROM verification_evidence WHERE media_id = $1) OR
        EXISTS (SELECT 1 FROM user_report_evidence WHERE media_id = $1) OR
        EXISTS (SELECT 1 FROM users WHERE avatar_media_id = $1)`, [row.media_id]);
      if (references.rowCount) throw new ApiError(409, 'media_in_use', 'Media is referenced by another record');
      if (row.storage_provider !== 'cloudinary' || row.provider_delivery_type !== 'authenticated') {
        throw new ApiError(409, 'unsupported_storage', 'Stored media delivery configuration is unsupported');
      }
      try { await available().destroy(row.provider_public_id, row.provider_resource_type); }
      catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(502, 'delete_failed', 'Storage deletion could not be completed');
      }
      await client.query("UPDATE media_files SET upload_status = 'deleted' WHERE media_id = $1", [row.media_id]);
      if (row.uploaded_by_user_id !== request.principal!.users_id) {
        await client.query(`INSERT INTO admin_audit_logs (actor_user_id, action, target_type, target_id, before_state, after_state, request_id)
          VALUES ($1, 'media.delete', 'media', $2, $3::jsonb, $4::jsonb, $5)`,
        [request.principal!.users_id, row.media_id, JSON.stringify({ upload_status: row.upload_status }), JSON.stringify({ upload_status: 'deleted' }), request.id]);
      }
    });
    return reply.code(204).send();
  });
}
