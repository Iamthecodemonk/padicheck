import type { Investigation } from '../investigations/types.js';
import { ResearchError, type SearchResult, type Evidence } from './types.js';

export type SearchLimits = { results: number; queries: number; sources: number; seconds: number };
export function searchLimits(config: Record<string, unknown>): SearchLimits {
  const read = (key: string, fallback: number, min: number, max: number) => {
    const value = config[key] ?? fallback;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new ResearchError('invalid_tool_configuration');
    return value;
  };
  return { results: read('max_results', 5, 1, 5), queries: read('max_queries', 1, 1, 8),
    sources: read('max_sources', 25, 5, 30), seconds: read('max_seconds', 120, 30, 180) };
}

export function searchPlan(row: Pick<Investigation, 'investigation_type' | 'input_data' | 'user_prompt'>, maxQueries: number): string[] {
  // Uploaded contract text and its question never enter the web-search plan.
  if (row.investigation_type === 'contract_review') return [];
  const clean = (value: string) => value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  const queries: string[] = [];
  const add = (query: string) => { query = clean(query).slice(0, 500); if (query && !queries.includes(query)) queries.push(query); };
  const targets = row.input_data.targets ?? [];
  for (const target of targets) {
    const identifiers = (target.identifiers ?? []).filter(id => ['domain', 'phone', 'registration_number'].includes(id.identifier_type));
    add([target.canonical_name, ...identifiers.map(id => id.value)].join(' '));
  }
  if (!queries.length) {
    for (const raw of row.input_data.urls ?? []) {
      try { add(new URL(raw).hostname); } catch { /* URL validation happens at creation and fetch. */ }
    }
  }
  if (!queries.length) add(row.user_prompt);
  const base = (queries[0] || '').slice(0, 420);
  if (!base) return [];
  const name = clean(targets[0]?.canonical_name || base).replace(/"/g, '').slice(0, 200);
  add(`"${name}"`);
  add(`${base} official website contact registration`);
  add(`${base} reviews customer complaints`);
  add(`${base} news regulator public records`);
  add(`${base} ownership directors company registration`);
  add(`${base} warnings allegations independent reporting`);
  add(`${base} address telephone business directory`);
  return queries.slice(0, maxQueries);
}

export function canonicalSearchUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^utm_|^(gclid|fbclid|msclkid)$/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    return url.toString();
  } catch { return null; }
}

export type DiscoveredResult = SearchResult & { query_index: number };
export function diverseResults(batches: SearchResult[][], maximum: number): DiscoveredResult[] {
  // Interleave query results before selecting, so one broad query cannot fill
  // the entire budget. Retain source diversity before additional same-site pages.
  const all: DiscoveredResult[] = [], seen = new Set<string>();
  const length = Math.max(0, ...batches.map(batch => batch.length));
  for (let rank = 0; rank < length; rank++) for (let index = 0; index < batches.length; index++) {
    const entry = batches[index]![rank];
    if (!entry) continue;
    const url = canonicalSearchUrl(entry.url);
    if (!url || seen.has(url)) continue;
    seen.add(url); all.push({ ...entry, url, query_index: index });
  }
  const selected: DiscoveredResult[] = [], deferred: DiscoveredResult[] = [], hosts = new Map<string, number>();
  for (const entry of all) {
    const host = new URL(entry.url).hostname.replace(/^www\./, '');
    if ((hosts.get(host) ?? 0) >= 2) { deferred.push(entry); continue; }
    hosts.set(host, (hosts.get(host) ?? 0) + 1); selected.push(entry);
  }
  return [...selected, ...deferred].slice(0, maximum);
}

export function selectEvidence(rows: Evidence[], maximum = 20): Evidence[] {
  const quality = (row: Evidence) => row.source_type === 'uploaded_document' ? 0 : row.content_kind === 'search_snippet' ? 2 : 1;
  const ordered = [...rows].sort((a, b) => quality(a) - quality(b));
  const selected: Evidence[] = [], deferred: Evidence[] = [], hosts = new Map<string, number>();
  for (const row of ordered) {
    let host = row.source_id;
    try { if (row.url) host = new URL(row.url).hostname.replace(/^www\./, ''); } catch { /* Keep owned document evidence. */ }
    if ((hosts.get(host) ?? 0) >= 2) { deferred.push(row); continue; }
    hosts.set(host, (hosts.get(host) ?? 0) + 1); selected.push(row);
  }
  let remaining = 96000;
  return [...selected, ...deferred].slice(0, maximum).flatMap(row => {
    if (remaining <= 0) return [];
    const excerpt = row.excerpt.slice(0, Math.min(6000, remaining));
    remaining -= excerpt.length;
    return excerpt.trim() ? [{ ...row, excerpt }] : [];
  });
}
