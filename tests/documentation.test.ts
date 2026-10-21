import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { Database } from '../src/database/index.js';

const config = loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgres://unused:unused@localhost/test', JWT_SECRET: 'documentation-test-secret-at-least-32-bytes' });

test('Swagger covers every registered API route without accessing services or changing handlers', async () => {
  const db: Database = {
    async query() { throw new Error('Documentation must not query the database'); },
    async session() { throw new Error('Documentation must not query the database'); },
    async transaction() { throw new Error('Documentation must not query the database'); },
    async close() {},
  };
  const app = buildApp(config, db);
  const routes = new Set<string>();
  app.addHook('onRoute', route => {
    if (!route.url.startsWith('/docs')) {
      for (const method of [route.method].flat()) {
        if (method !== 'HEAD') routes.add(`${method.toLowerCase()} ${route.url.replace(/:([^/]+)/g, '{$1}')}`);
      }
    }
  });
  try {
    const docs = await app.inject('/docs/json');
    assert.equal(docs.statusCode, 200, docs.body);
    const spec = docs.json();
    assert.equal(spec.openapi, '3.0.3');
    assert.equal(spec.components.securitySchemes.bearerAuth.scheme, 'bearer');
    const documented = new Set<string>();
    const operationIds = new Set<string>();
    for (const [path, item] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(item as Record<string, any>)) {
        documented.add(`${method} ${path}`);
        assert.ok(operation.summary, `${method} ${path} summary`);
        assert.ok(operation.tags.length, `${method} ${path} tags`);
        assert.ok(operation.responses, `${method} ${path} responses`);
        assert.ok(!operationIds.has(operation.operationId), 'Operation IDs must be unique');
        operationIds.add(operation.operationId);
      }
    }
    assert.ok(routes.size > 50, 'Includes loop-generated registry and workflow routes');
    assert.deepEqual([...documented].sort(), [...routes].sort());
    assert.deepEqual(spec.paths['/v1/auth/me'].get.security, [{ bearerAuth: [] }]);
    assert.deepEqual(spec.paths['/v1/auth/register'].post.security, []);
    assert.deepEqual(spec.paths['/v1/shared-investigations/resolve'].post.security, []);
    assert.deepEqual(spec.paths['/v1/auth/google/link'].post.security, [{ bearerAuth: [] }]);
    assert.deepEqual(spec.paths['/v1/auth/google/challenge'].post.security, [{}, { bearerAuth: [] }]);
    assert.deepEqual(spec.paths['/v1/billing/offers'].get.security, []);
    assert.deepEqual(spec.paths['/v1/billing/checkouts'].post.security, [{ bearerAuth: [] }]);
    assert.deepEqual(spec.paths['/v1/webhooks/bachs'].post.security, []);
    assert.ok(spec.paths['/v1/billing/checkouts'].post.responses['201']);
    assert.ok(spec.paths['/v1/webhooks/bachs'].post.responses['202']);
    assert.ok(spec.paths['/v1/investigations'].post.responses['402']);
    assert.match(spec.paths['/v1/admin/users/{users_id}/roles'].post.description, /superadmin/);
    assert.ok(spec.paths['/v1/auth/register'].post.responses['202']);
    assert.ok(spec.paths['/v1/auth/register/verify'].post.responses['201']);
    assert.ok(spec.paths['/v1/investigations'].post.responses['202']);
    assert.ok(spec.paths['/v1/investigations/{investigation_id}/retry'].post.responses['202']);
    assert.ok(spec.paths['/v1/auth/logout'].post.responses['204']);
    assert.equal(spec.paths['/v1/auth/logout'].post.responses['204'].content, undefined);
    assert.ok(spec.paths['/ready'].get.responses['503']);
    const upload = spec.paths['/v1/media'].post;
    assert.equal(upload.requestBody.content['multipart/form-data'].schema.properties.file.format, 'binary');
    assert.ok(upload.responses['413']);
    assert.ok(upload.responses['415']);
    const login = spec.paths['/v1/auth/login'].post;
    assert.deepEqual(login.requestBody.content['application/json'].schema.required, ['email','password']);
    assert.equal(login.requestBody.content['application/json'].schema.properties.password.minLength, 12);
    assert.equal(spec.paths['/v1/investigations/{investigation_id}'].get.parameters[0].required, true);
    assert.ok((await app.inject('/docs/yaml')).body.includes('openapi: 3.0.3'));
    assert.equal((await app.inject('/docs/')).statusCode, 200);
    const ui = await app.inject('/docs/static/swagger-initializer.js');
    assert.equal(ui.statusCode, 200);
    assert.match(ui.body, /persistAuthorization.*false/);
    assert.equal((await app.inject('/docs/static/swagger-ui.css')).statusCode, 200);
    assert.deepEqual((await app.inject('/health')).json(), { status: 'ok', service: 'padicheck-backend' });
    assert.equal((await app.inject('/v1/auth/me')).statusCode, 401);
    const invalid = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'invalid', password: 'short' } });
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.json().error.code, 'invalid_request');
    assert.equal((await app.inject({ method: 'POST', url: '/v1/media' })).statusCode, 401);
  } finally { await app.close(); }
});
