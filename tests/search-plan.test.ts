import assert from 'node:assert/strict';
import { test } from 'node:test';
import { searchPlan, searchLimits, canonicalSearchUrl, diverseResults, selectEvidence } from '../src/modules/research/search-plan.js';

test('deep plans cover identity, records, reviews and news within the configured query limit', () => {
  const row = { investigation_type: 'company_research' as const, user_prompt: 'Research this business', input_data: {
    targets: [{ entity_type: 'business' as const, canonical_name: 'Example Trading', identifiers: [{ identifier_type: 'registration_number' as const, value: 'RC12345' }] }],
  } };
  const plan = searchPlan(row, 6);
  assert.equal(plan.length, 6);
  assert.match(plan[0]!, /Example Trading RC12345/);
  assert.ok(plan.some(query => query.includes('reviews customer complaints')));
  assert.ok(plan.some(query => query.includes('regulator public records')));
  assert.ok(plan.some(query => query.includes('ownership directors')));
  assert.equal(new Set(plan).size, plan.length);
  assert.ok(plan.every(query => query.length <= 500));
  assert.equal(searchPlan(row, 1).length, 1);
  assert.deepEqual(searchPlan({ ...row, investigation_type: 'contract_review', user_prompt: 'Private contract text' }, 8), []);
});

test('website search uses its hostname without leaking URL query parameters', () => {
  const plan = searchPlan({ investigation_type: 'web_analysis', user_prompt: 'Private question', input_data: { urls: ['https://example.com/private?token=secret'] } }, 6);
  assert.equal(plan[0], 'example.com');
  assert.ok(plan.every(query => !query.includes('secret') && !query.includes('Private')));
  assert.throws(() => searchLimits({ max_queries: 100 }), /invalid_tool_configuration/);
  assert.throws(() => searchLimits({ max_sources: 0 }), /invalid_tool_configuration/);
  assert.throws(() => searchLimits({ max_seconds: 0 }), /invalid_tool_configuration/);
  assert.equal(searchLimits({}).queries, 1);
});

test('results interleave query coverage, deduplicate tracking URLs and favor multiple hosts', () => {
  const result = (url: string) => ({ url, title: 'Title', snippet: 'Snippet' });
  const selected = diverseResults([
    [result('https://a.example/1?utm_source=x'), result('https://a.example/2'), result('https://a.example/3')],
    [result('https://b.example/'), result('https://a.example/1#fragment'), result('https://c.example/')],
  ], 4);
  assert.deepEqual(selected.map(row => row.url), ['https://a.example/1', 'https://b.example/', 'https://a.example/2', 'https://c.example/']);
  assert.equal(selected[1]!.query_index, 1);
  assert.equal(canonicalSearchUrl('https://user:pass@example.com/'), null);
  assert.equal(canonicalSearchUrl('javascript:alert(1)'), null);
});

test('analysis evidence favors retrieved pages and stays inside a fixed character budget', () => {
  const rows = Array.from({ length: 30 }, (_, index) => ({ source_id: String(index), source_type: 'web_page', title: 'Source',
    url: `https://source${index}.example/`, excerpt: 'x'.repeat(8000), content_kind: index < 5 ? 'search_snippet' : 'web_page' }));
  const selected = selectEvidence(rows);
  assert.equal(selected[0]!.source_id, '5');
  assert.ok(selected.length <= 20);
  assert.ok(selected.reduce((total, row) => total + row.excerpt.length, 0) <= 96000);
  assert.ok(selected.every(row => row.excerpt.length <= 6000));
});
