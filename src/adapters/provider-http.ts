import { ResearchError } from '../modules/research/types.js';

export async function providerJson(url: string, options: RequestInit, transport: typeof fetch = fetch): Promise<Record<string, unknown>> {
  let response: Response;
  try { response = await transport(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(45000) }); }
  catch (error) {
    const name = error instanceof Error ? error.name : '';
    throw new ResearchError(name === 'TimeoutError' || name === 'AbortError' ? 'provider_timeout' : 'provider_connection_failed');
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new ResearchError(response.status === 429 ? 'provider_rate_limited' : response.status >= 500 ? 'provider_unavailable' : 'provider_request_failed');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new ResearchError('invalid_provider_response');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2 * 1024 * 1024) throw new ResearchError('provider_response_too_large');
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof ResearchError) throw error;
    const name = error instanceof Error ? error.name : '';
    throw new ResearchError(name === 'TimeoutError' || name === 'AbortError' ? 'provider_timeout' : 'invalid_provider_response');
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new ResearchError('invalid_provider_response'); }
}

export function environmentSecret(ref: string | null, name: string, env: NodeJS.ProcessEnv = process.env): string {
  if (ref !== `env:${name}` || !env[name]) throw new ResearchError('provider_secret_unconfigured');
  return env[name]!;
}
