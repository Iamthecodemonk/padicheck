import assert from 'node:assert/strict';
import { test } from 'node:test';
import { providerJson } from '../src/adapters/provider-http.js';

test('provider failures retain safe actionable codes without exposing response bodies', async () => {
  for (const [status, code] of [[400, 'provider_request_failed'], [429, 'provider_rate_limited'], [503, 'provider_unavailable']] as const) {
    await assert.rejects(providerJson('https://example.com/', {}, async () => new Response('private provider response', { status })),
      error => error instanceof Error && error.message === code);
  }
  for (const name of ['TimeoutError', 'AbortError']) {
    await assert.rejects(providerJson('https://example.com/', {}, async () => { throw new DOMException('private request details', name); }), /provider_timeout/);
  }
  await assert.rejects(providerJson('https://example.com/', {}, async () => { throw new TypeError('private connection details'); }), /provider_connection_failed/);
  const interrupted = new ReadableStream({ pull(controller) { controller.error(new DOMException('private body details', 'TimeoutError')); } });
  await assert.rejects(providerJson('https://example.com/', {}, async () => new Response(interrupted)), /provider_timeout/);
});
