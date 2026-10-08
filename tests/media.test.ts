import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { MediaStorage, UploadSpec } from '../src/modules/media/types.js';
import { cloudinaryStorage } from '../src/adapters/cloudinary.js';
import { testDatabase } from './support/database.js';

const config = loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', DATABASE_URL: 'postgres://unused:unused@localhost/test',
  JWT_SECRET: 'test-secret-32-bytes-minimum-long-value', MEDIA_MAX_BYTES: '1024' });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4l8AAAAASUVORK5CYII=', 'base64');
function multipart(data: Buffer, mime = 'image/png', name = 'sample.png', extra = '') {
  const boundary = 'padicheck-test-boundary';
  const payload = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: ${mime}\r\n\r\n`), data,
    Buffer.from(`\r\n${extra}--${boundary}--\r\n`)]);
  return { payload, contentType: `multipart/form-data; boundary=${boundary}` };
}

test('media upload and access integration against the supplied schema', async t => {
  const { db } = await testDatabase();
  const uploaded: UploadSpec[] = [];
  const destroyed: string[] = [];
  let mode: 'ok' | 'throw' | 'invalid' | 'wrong-type' | 'wrong-bytes' = 'ok';
  let cleanupFails = false;
  const storage: MediaStorage = {
    async upload(_data, spec) {
      uploaded.push(spec);
      const pending = await db.query('SELECT upload_status FROM media_files WHERE provider_public_id = $1', [spec.publicId]);
      assert.equal(pending.rows[0]!.upload_status, 'pending');
      if (mode === 'throw') throw new Error('Provider failure with secret text');
      return { asset_id: randomUUID(), public_id: mode === 'invalid' ? 'another-user/file' : spec.publicId,
        resource_type: spec.resourceType, type: mode === 'wrong-type' ? 'upload' : 'authenticated',
        bytes: mode === 'wrong-bytes' ? spec.bytes + 1 : spec.bytes, version: 123 };
    },
    async destroy(publicId) { destroyed.push(publicId); if (cleanupFails) throw new Error('provider cleanup secret'); },
    download(publicId, resourceType, format, expiresAt) {
      assert.ok(expiresAt > Date.now() / 1000 && expiresAt <= Date.now() / 1000 + 301);
      return `https://api.cloudinary.com/test/${resourceType}/download?public_id=${publicId}&format=${format}&expires_at=${expiresAt}&signature=test`;
    },
  };
  const app = buildApp(config, db, { storage });
  const register = async (email: string) => {
    const res = await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { email, display_name: 'Upload user', password: 'Upload test password long' } });
    assert.equal(res.statusCode, 201, res.body);
    return { token: res.json().access_token as string, id: res.json().user.users_id as string };
  };
  const owner = await register('owner@example.com');
  const other = await register('other@example.com');
  const upload = (data = png, mime = 'image/png', name = 'sample.png', extra = '') => {
    const form = multipart(data, mime, name, extra);
    return app.inject({ method: 'POST', url: '/v1/media', payload: form.payload,
      headers: { authorization: `Bearer ${owner.token}`, 'content-type': form.contentType } });
  };
  let mediaId: string;
  try {
    await t.test('unauthenticated uploads are rejected before any storage calls', async () => {
      const form = multipart(png);
      assert.equal((await app.inject({ method: 'POST', url: '/v1/media', headers: { 'content-type': form.contentType }, payload: form.payload })).statusCode, 401);
      assert.equal(uploaded.length, 0);
    });
    await t.test('pending upload becomes ready with canonical provider identifiers and metadata', async () => {
      const res = await upload();
      assert.equal(res.statusCode, 201, res.body);
      const media = res.json().media;
      mediaId = media.media_id;
      assert.equal(media.upload_status, 'ready');
      assert.equal(media.provider_public_id, uploaded[0]!.publicId);
      assert.ok(media.provider_asset_id);
      assert.equal(media.provider_version, '123');
      assert.equal(media.provider_delivery_type, 'authenticated');
      assert.equal(media.visibility, 'private');
      assert.equal(media.provider_resource_type, 'image');
      assert.equal(media.sha256, createHash('sha256').update(png).digest('hex'));
      assert.equal(Number(media.size_bytes), png.length);
      assert.equal(media.url, undefined);
      assert.equal(media.data, undefined);
    });
    await t.test('owner can get metadata and expiring delivery, other users cannot', async () => {
      const ownerHeaders = { authorization: `Bearer ${owner.token}` };
      assert.equal((await app.inject({ method: 'GET', url: `/v1/media/${mediaId}`, headers: ownerHeaders })).statusCode, 200);
      const delivered = await app.inject({ method: 'POST', url: `/v1/media/${mediaId}/delivery`, headers: ownerHeaders });
      assert.equal(delivered.statusCode, 200, delivered.body);
      assert.match(delivered.json().url, /signature=test/);
      assert.equal(delivered.headers['cache-control'], 'no-store');
      for (const [method, path] of [['GET', ''], ['POST', '/delivery'], ['DELETE', '']] as const) {
        const res = await app.inject({ method, url: `/v1/media/${mediaId}${path}`, headers: { authorization: `Bearer ${other.token}` } });
        assert.equal(res.statusCode, 404, res.body);
      }
    });
    await t.test('documents use raw IDs with extensions and audio/video map to video', async () => {
      const pdf = await upload(Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF'), 'application/pdf', 'contract.pdf');
      assert.equal(pdf.statusCode, 201, pdf.body);
      assert.equal(pdf.json().media.media_type, 'document');
      assert.equal(pdf.json().media.provider_resource_type, 'raw');
      assert.match(pdf.json().media.provider_public_id, /\.pdf$/);
      const wav = Buffer.alloc(44);
      wav.write('RIFF', 0); wav.writeUInt32LE(36, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
      wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24);
      wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36);
      const audio = await upload(wav, 'audio/wav', 'voice.wav');
      assert.equal(audio.statusCode, 201, audio.body);
      assert.equal(audio.json().media.media_type, 'audio');
      assert.equal(audio.json().media.provider_resource_type, 'video');
      const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypmp42'), Buffer.alloc(4), Buffer.from('mp42isom')]);
      const video = await upload(mp4, 'video/mp4', 'clip.mp4');
      assert.equal(video.statusCode, 201, video.body);
      assert.equal(video.json().media.media_type, 'video');
      assert.equal(video.json().media.provider_resource_type, 'video');
    });
    await t.test('empty, unsupported, spoofed, oversized and extra-part uploads do not reach storage', async () => {
      const before = uploaded.length;
      assert.equal((await upload(Buffer.alloc(0))).statusCode, 400);
      assert.equal((await upload(Buffer.from('<script>unsafe</script>'), 'text/html', 'page.html')).statusCode, 415);
      assert.equal((await upload(png, 'application/pdf', 'fake.pdf')).statusCode, 415);
      assert.equal((await upload(Buffer.alloc(1025))).statusCode, 413);
      const extra = '--padicheck-test-boundary\r\nContent-Disposition: form-data; name="visibility"\r\n\r\npublic\r\n';
      assert.equal((await upload(png, 'image/png', 'test.png', extra)).statusCode, 413);
      assert.equal(uploaded.length, before);
    });
    await t.test('provider failures and invalid responses mark failed and clean generated IDs', async () => {
      for (const failure of ['throw', 'invalid', 'wrong-type', 'wrong-bytes'] as const) {
        mode = failure;
        const res = await upload();
        assert.equal(res.statusCode, 502, res.body);
        assert.ok(!res.body.includes('secret'));
        const spec = uploaded.at(-1)!;
        assert.equal(destroyed.at(-1), spec.publicId);
        const row = (await db.query('SELECT * FROM media_files WHERE provider_public_id = $1', [spec.publicId])).rows[0]!;
        assert.equal(row.upload_status, 'failed');
        assert.equal(row.provider_asset_id, null);
      }
      mode = 'ok';
    });
    await t.test('database finalization failure cleans asset and records failed state', async () => {
      const realQuery = db.query;
      db.query = async (sql, values) => {
        if (sql.includes("upload_status = 'ready'")) throw new Error('Simulated database finalization failure');
        return realQuery(sql, values);
      };
      try {
        assert.equal((await upload()).statusCode, 502);
        const spec = uploaded.at(-1)!;
        assert.equal(destroyed.at(-1), spec.publicId);
        const row = (await realQuery('SELECT upload_status FROM media_files WHERE provider_public_id = $1', [spec.publicId])).rows[0]!;
        assert.equal(row.upload_status, 'failed');
      } finally { db.query = realQuery; }
    });
    await t.test('cleanup failure still leaves a failed record for reconciliation', async () => {
      mode = 'throw'; cleanupFails = true;
      assert.equal((await upload()).statusCode, 502);
      const row = (await db.query('SELECT upload_status FROM media_files WHERE provider_public_id = $1', [uploaded.at(-1)!.publicId])).rows[0]!;
      assert.equal(row.upload_status, 'failed');
      mode = 'ok'; cleanupFails = false;
    });
    await t.test('media.manage enables review and audited removal; referenced media is protected', async () => {
      await db.query("INSERT INTO user_roles (users_id, role_id) SELECT $1, role_id FROM roles WHERE role_key = 'admin'", [other.id]);
      const headers = { authorization: `Bearer ${other.token}` };
      assert.equal((await app.inject({ method: 'GET', url: `/v1/media/${mediaId}`, headers })).statusCode, 200);
      await db.query("INSERT INTO sources (source_type, media_id) VALUES ('uploaded_document', $1)", [mediaId]);
      assert.equal((await app.inject({ method: 'DELETE', url: `/v1/media/${mediaId}`, headers })).statusCode, 409);
      await db.query('DELETE FROM sources WHERE media_id = $1', [mediaId]);
      const removed = await app.inject({ method: 'DELETE', url: `/v1/media/${mediaId}`, headers });
      assert.equal(removed.statusCode, 204, removed.body);
      assert.equal((await db.query('SELECT upload_status FROM media_files WHERE media_id = $1', [mediaId])).rows[0]!.upload_status, 'deleted');
      assert.equal((await db.query('SELECT action FROM admin_audit_logs')).rows[0]!.action, 'media.delete');
      assert.equal((await app.inject({ method: 'POST', url: `/v1/media/${mediaId}/delivery`, headers })).statusCode, 409);
      assert.equal((await app.inject({ method: 'DELETE', url: `/v1/media/${mediaId}`, headers })).statusCode, 204);
    });
  } finally {
    await app.close(); await db.close();
  }
});

test('Cloudinary delivery URL is signed, expiring, and contains no API secret', () => {
  const storage = cloudinaryStorage({ cloudName: 'test-cloud', apiKey: '123', apiSecret: 'test-secret-that-must-stay-server-side' });
  for (const resourceType of ['image', 'video', 'raw'] as const) {
    const expiry = Math.floor(Date.now() / 1000) + 300;
    const url = new URL(storage.download(resourceType === 'raw' ? 'folder/doc.pdf' : 'folder/asset', resourceType, resourceType === 'raw' ? '' : 'png', expiry));
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'api.cloudinary.com');
    assert.equal(url.searchParams.get('type'), 'authenticated');
    assert.equal(Number(url.searchParams.get('expires_at')), expiry);
    assert.ok(url.searchParams.get('signature'));
    assert.ok(!url.toString().includes('test-secret-that-must-stay-server-side'));
  }
});
