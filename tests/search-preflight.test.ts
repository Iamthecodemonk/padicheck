import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from '../src/config.js';
import type { Database } from '../src/database/index.js';
import { integrationProbes } from '../src/runtime/integrations.js';

test('search preflight uses a public query and requires usable absolute source URLs', async () => {
  const original = globalThis.fetch;
  const config = loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgres://unused:unused@localhost/test',
    JWT_SECRET: 'test-secret-32-bytes-minimum-long-value', ULTRASEARCH_URL: 'http://127.0.0.1:8082' });
  let payload: unknown = { results: [{ rank: 1, title: 'PostgreSQL', url: 'https://www.postgresql.org/docs/' }] };
  let requests = 0;
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input)); requests++;
    assert.equal(url.origin, 'http://127.0.0.1:8082');
    assert.equal(url.pathname, '/search');
    assert.equal(url.searchParams.get('q'), 'PostgreSQL official documentation');
    assert.equal(url.searchParams.get('ai_mode'), 'none');
    assert.equal(url.searchParams.get('content'), 'false');
    assert.equal(url.searchParams.get('limit'), '1');
    assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer synthetic-search-key');
    return Response.json(payload);
  };
  try {
    const probe = integrationProbes(config, {} as Database, { ULTRASEARCH_API_KEY: 'synthetic-search-key' }).ultrasearch;
    await probe();
    for (const invalid of [{ results: null }, { results: [] }, { results: [{ rank: 1, url: '/goto?url=opaque' }] }, {}]) {
      payload = invalid;
      await assert.rejects(probe());
    }
    assert.equal(requests, 5);
  } finally { globalThis.fetch = original; }
});
