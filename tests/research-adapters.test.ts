import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { publicAddress, publicUrl, publicDownloader, fetchPublicPage } from '../src/adapters/public-web.js';
import { ultraSearch } from '../src/adapters/ultrasearch.js';
import { geminiAnalyzer } from '../src/adapters/gemini.js';
import { extractPdf } from '../src/adapters/pdf-text.js';
import { validateAnalysis } from '../src/modules/research/output.js';
import type { Assignment } from '../src/modules/research/types.js';

test('public fetch rejects nonpublic addresses, credentials, ports and private redirects', async () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.0.1', '169.254.169.254', '0.0.0.0', '::1', 'fe80::1', 'fc00::1', '::ffff:127.0.0.1', '224.0.0.1']) {
    assert.equal(publicAddress(address), false, address);
  }
  assert.equal(publicAddress('93.184.216.34'), true);
  for (const url of ['file:///etc/passwd', 'http://127.0.0.1', 'http://2130706433', 'http://[::1]', 'http://user:password@example.com', 'https://example.com:8080']) {
    assert.throws(() => publicUrl(url), /unsafe_url/);
  }
  let requests = 0;
  const redirected = publicDownloader({ async resolve() { return { address: '93.184.216.34', family: 4 }; },
    async request() { requests++; return { status: 302, headers: { location: 'http://169.254.169.254/latest' }, body: Buffer.alloc(0) }; } });
  await assert.rejects(redirected('https://example.com/'), /unsafe_url/);
  assert.equal(requests, 1);
  const rebound = publicDownloader({ async resolve() { return { address: '127.0.0.1', family: 4 }; },
    async request() { requests++; throw new Error('must not run'); } });
  await assert.rejects(rebound('https://example.com/'), /unsafe_address/);
  assert.equal(requests, 1);
});

test('page extraction strips script content, pins the resolved address and enforces bounds', async () => {
  const download = publicDownloader({ async resolve() { return { address: '93.184.216.34', family: 4 }; },
    async request(url, address) {
      assert.equal(url.hostname, 'example.com'); assert.equal(address.address, '93.184.216.34');
      return { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' },
        body: Buffer.from('<html><head><title>Public title</title></head><body><script>secret script command</script><p>Public evidence text.</p></body></html>') };
    } });
  const page = await fetchPublicPage('https://example.com', download);
  assert.equal(page.title, 'Public title'); assert.equal(page.text, 'Public evidence text.');
  const tooBig = publicDownloader({ async resolve() { return { address: '93.184.216.34', family: 4 }; },
    async request() { return { status: 200, headers: {}, body: Buffer.alloc(11) }; } });
  await assert.rejects(tooBig('https://example.com', 10), /source_too_large/);
});

test('UltraSearch uses organic links without invoking its crawler or AI overview', async () => {
  const search = ultraSearch('http://127.0.0.1:8082', {}, async (input, options) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, '/search'); assert.equal(url.searchParams.get('ai_mode'), 'none');
    assert.equal(url.searchParams.get('content'), 'false'); assert.equal(url.searchParams.get('limit'), '2');
    assert.equal(options?.redirect, 'error');
    return Response.json({ results: [
      { rank: 0, title: 'AI overview', url: 'https://google.com/search', snippet: 'uncited generated output' },
      { rank: 1, title: 'Private', url: 'http://127.0.0.1/private', snippet: 'blocked' },
      { rank: 2, title: 'Public', url: 'https://example.com/', snippet: 'Public snippet' },
      { rank: 3, title: 'Duplicate', url: 'https://example.com/', snippet: 'Duplicate snippet' },
    ] });
  });
  assert.deepEqual(await search('company', 2, null), [{ url: 'https://example.com/', title: 'Public', snippet: 'Public snippet' }]);
});

test('Gemini adapter uses registry model/settings, header credentials and structured JSON', async () => {
  const assignment: Assignment = { assignment_id: randomUUID(), task_id: randomUUID(), task_code: 'investigation_analysis', agent_id: randomUUID(), model_id: randomUUID(),
    provider_code: 'gemini', provider_model_id: 'registry-selected-model', credential_secret_ref: 'env:GEMINI_API_KEY',
    instructions_template: 'Registry instructions', prompt_version: 'v4', priority: 1, model_config: {}, config_override: { max_output_tokens: 1024 } };
  const analyze = geminiAnalyzer({ GEMINI_API_KEY: 'test-only-provider-key' }, async (input, options) => {
    assert.match(String(input), /models\/registry-selected-model:generateContent$/);
    assert.ok(!String(input).includes('test-only-provider-key'));
    assert.equal((options?.headers as Record<string, string>)['x-goog-api-key'], 'test-only-provider-key');
    const body = JSON.parse(String(options?.body));
    assert.equal(body.generationConfig.maxOutputTokens, 1024);
    assert.equal(body.generationConfig.responseFormat.text.mimeType, 'application/json');
    assert.match(body.systemInstruction.parts[0].text, /Registry instructions/);
    assert.equal(body.tools, undefined);
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"summary":"fixture"}' }] } }],
      responseId: 'request-fixture', usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 7, thoughtsTokenCount: 3 } });
  });
  const result = await analyze(assignment, 'Question', []);
  assert.equal(result.inputTokens, 11); assert.equal(result.outputTokens, 10); assert.equal(result.requestId, 'request-fixture');
  await assert.rejects(geminiAnalyzer({ JWT_SECRET: 'must-not-be-read' })({ ...assignment, credential_secret_ref: 'env:JWT_SECRET' }, 'Question', []), /provider_secret_unconfigured/);
});

test('finding validation rejects fabricated quotations, unsupported statuses and certainty claims', () => {
  const source = { source_id: randomUUID(), title: 'Page', url: 'https://example.com', excerpt: 'We list an address. This does not prove legitimacy.', source_type: 'web_page' };
  const output = { summary: 'This does not prove legitimacy.', limitations: ['Only one source.'], findings: [{ finding_type: 'claim', category: 'contact',
    title: 'Address claim', explanation: 'The page lists an address.', confidence: null,
    evidence: [{ source_id: source.source_id, quote: 'We list an address.', support_type: 'supports' }] }] };
  assert.ok(validateAnalysis(output, [source]));
  const fabricated = structuredClone(output); fabricated.findings[0]!.evidence[0]!.quote = 'The business is registered.';
  assert.throws(() => validateAnalysis(fabricated, [source]), /invalid_model_output/);
  assert.throws(() => validateAnalysis({ ...output, summary: 'This investigation proves legitimacy.' }, [source]), /invalid_model_output/);
});

test('PDF text extraction runs in an isolated bounded worker', async () => {
  const text = 'Contract requires an upfront fee.';
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  for (const [index, object] of objects.entries()) { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const result = await extractPdf(Buffer.from(pdf));
  assert.match(result.text, /Contract requires an upfront fee/); assert.equal(result.pages, 1); assert.equal(result.truncated, false);
  await assert.rejects(extractPdf(Buffer.from('not a PDF')), /invalid_pdf/);
});
