import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateAnalysis } from '../src/modules/research/output.js';

test('evidence gaps may produce no findings, while unsupported citations remain rejected', () => {
  const gap = { summary: 'The excerpts do not establish facts about this entity.', limitations: ['Only unrelated excerpts were available.'], findings: [] };
  assert.deepEqual(validateAnalysis(gap, []), gap);
  assert.throws(() => validateAnalysis({ ...gap, limitations: [] }, []), /invalid_model_output/);
  const source = { source_id: '11111111-1111-4111-8111-111111111111', title: 'Source', url: 'https://example.com/', excerpt: 'A short source excerpt.', source_type: 'web_page' };
  const finding = { finding_type: 'missing_information', category: 'coverage', title: 'Missing information', explanation: 'The available excerpt is limited.', confidence: null, evidence: [] };
  assert.throws(() => validateAnalysis({ ...gap, findings: [finding] }, [source]), /invalid_model_output/);
  assert.throws(() => validateAnalysis({ ...gap, findings: [{ ...finding, evidence: [{ source_id: source.source_id, quote: 'A fabricated quotation.', support_type: 'context' }] }] }, [source]), /invalid_model_output/);
});
