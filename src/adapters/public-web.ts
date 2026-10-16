import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import ipaddr from 'ipaddr.js';
import { load } from 'cheerio';
import { ResearchError, type RetrievedPage } from '../modules/research/types.js';

export type PublicAddress = { address: string; family: number };
export type WebResponse = { status: number; headers: Record<string, string | string[] | undefined>; body: Buffer };
export function publicAddress(address: string): boolean {
  try {
    let parsed = ipaddr.parse(address);
    if (parsed.kind() === 'ipv6' && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) parsed = (parsed as ipaddr.IPv6).toIPv4Address();
    return parsed.range() === 'unicast';
  } catch { return false; }
}

export function publicUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new ResearchError('unsafe_url'); }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      (url.port && url.port !== (url.protocol === 'https:' ? '443' : '80')) ||
      host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
      !host || (isIP(host) && !publicAddress(host))) throw new ResearchError('unsafe_url');
  url.hash = '';
  return url;
}

export async function resolvePublic(url: URL): Promise<PublicAddress> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let addresses: PublicAddress[];
  try {
    addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await Promise.race([
      lookup(host, { all: true, verbatim: true }), new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new ResearchError('dns_timeout')), 5000);
      }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
  if (!addresses.length || addresses.some(item => !publicAddress(item.address))) throw new ResearchError('unsafe_address');
  return addresses[0]!;
}

export async function pinnedRequest(url: URL, address: PublicAddress, maxBytes: number): Promise<WebResponse> {
  return new Promise((resolve, reject) => {
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    const transport = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const request = transport({ protocol: url.protocol, hostname: address.address,
      port: url.protocol === 'https:' ? 443 : 80, path: url.pathname + url.search,
      ...(url.protocol === 'https:' && !isIP(hostname) ? { servername: hostname } : {}),
      headers: { Host: url.host, Accept: 'text/html,text/plain,application/pdf', 'Accept-Encoding': 'identity', 'User-Agent': 'PadiCheck/0.1' },
      agent: false,
    }, response => {
      const status = response.statusCode ?? 0;
      const headers = response.headers;
      if ([301, 302, 303, 307, 308].includes(status)) {
        response.destroy(); resolve({ status, headers, body: Buffer.alloc(0) }); return;
      }
      if (status < 200 || status > 299 || (headers['content-encoding'] && headers['content-encoding'] !== 'identity')) {
        response.destroy(); reject(new ResearchError('source_unavailable')); return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) { response.destroy(); request.destroy(new ResearchError('source_too_large')); return; }
        chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => resolve({ status, headers, body: Buffer.concat(chunks) }));
    });
    const deadline = setTimeout(() => request.destroy(new ResearchError('source_timeout')), 10000);
    request.once('close', () => clearTimeout(deadline));
    request.on('error', reject);
    request.end();
  });
}

export function publicDownloader(dependencies = { resolve: resolvePublic, request: pinnedRequest }) {
  return async (raw: string, maxBytes = 2 * 1024 * 1024): Promise<{ url: URL; response: WebResponse }> => {
    let url = publicUrl(raw);
    for (let hop = 0; hop <= 3; hop++) {
      const address = await dependencies.resolve(url);
      // Revalidate injected/resolved addresses immediately before connecting.
      if (!publicAddress(address.address)) throw new ResearchError('unsafe_address');
      const response = await dependencies.request(url, address, maxBytes);
      if (response.body.length > maxBytes) throw new ResearchError('source_too_large');
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.location;
        if (typeof location !== 'string') throw new ResearchError('invalid_redirect');
        const next = publicUrl(new URL(location, url).toString());
        if (url.protocol === 'https:' && next.protocol !== 'https:') throw new ResearchError('unsafe_redirect');
        url = next; continue;
      }
      return { url, response };
    }
    throw new ResearchError('too_many_redirects');
  };
}

export async function fetchPublicPage(raw: string, download = publicDownloader()): Promise<RetrievedPage> {
  const { url, response } = await download(raw);
  const contentType = String(response.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
  if (!['text/html', 'text/plain', 'application/xhtml+xml'].includes(contentType)) throw new ResearchError('unsupported_source_type');
  const html = response.body.toString('utf8');
  const $ = load(html);
  const title = contentType === 'text/plain' ? url.hostname : $('title').text().trim().slice(0, 300);
  $('script,style,noscript,template,svg,nav,footer').remove();
  const text = (contentType === 'text/plain' ? html : $('body').text()).replace(/\s+/g, ' ').trim();
  if (!text) throw new ResearchError('empty_source');
  return { url: url.toString(), title, text: text.slice(0, 16000), truncated: text.length > 16000 };
}
