import { providerJson, environmentSecret } from './provider-http.js';
import { publicUrl } from './public-web.js';
import { ResearchError, type SearchResult } from '../modules/research/types.js';

export function ultraSearch(baseUrl: string, env: NodeJS.ProcessEnv = process.env, transport: typeof fetch = fetch) {
  // Trusted operator configuration. It can intentionally point to a local
  // UltraSearch service; user-supplied source URLs use the separate public fetcher.
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new ResearchError('invalid_search_endpoint');
  return async (query: string, maxResults: number, secretRef: string | null): Promise<SearchResult[]> => {
    const url = new URL('search', base.toString().replace(/\/?$/, '/'));
    url.search = new URLSearchParams({ q: query.slice(0, 500), limit: String(maxResults), ai_mode: 'none', content: 'false', engine: 'google' }).toString();
    const headers: Record<string, string> = { Accept: 'application/json' };
    // Optional bearer token for a deployment's authenticating reverse proxy.
    if (secretRef) headers.Authorization = `Bearer ${environmentSecret(secretRef, 'ULTRASEARCH_API_KEY', env)}`;
    const value = await providerJson(url.toString(), { headers }, transport);
    if (!Array.isArray(value.results)) throw new ResearchError('invalid_search_response');
    const results: SearchResult[] = [];
    for (const item of value.results.slice(0, 20)) {
      if (!item || typeof item.url !== 'string' || typeof item.rank !== 'number' || item.rank <= 0) continue;
      try {
        const resultUrl = publicUrl(item.url).toString();
        if (results.some(result => result.url === resultUrl)) continue;
        results.push({ url: resultUrl, title: typeof item.title === 'string' ? item.title.slice(0, 300) : '',
          snippet: typeof item.snippet === 'string' ? item.snippet.slice(0, 2000) : '' });
      } catch { continue; }
      if (results.length >= maxResults) break;
    }
    return results;
  };
}
