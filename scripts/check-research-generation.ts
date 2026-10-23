import 'dotenv/config';
import { createDatabase } from '../src/database/index.js';
import { loadConfig } from '../src/config.js';
import { researchAssignments } from '../src/modules/research/registry.js';
import { geminiAnalyzer } from '../src/adapters/gemini.js';
import { validateAnalysis } from '../src/modules/research/output.js';
import { ResearchError } from '../src/modules/research/types.js';

// Makes one real generation request with public sample text. No application
// records, user data, credentials or raw provider responses are printed.
const config = loadConfig();
const db = createDatabase(config.databaseUrl);
try {
  const route = (await researchAssignments(db))[0];
  if (!route) throw new ResearchError('analysis_not_configured');
  const evidence = [{ source_id: '11111111-1111-4111-8111-111111111111', title: 'Example Domain',
    url: 'https://example.com/', excerpt: 'This domain is for use in illustrative examples in documents.', source_type: 'web_page' }];
  const result = await geminiAnalyzer()(route, 'Describe the stated purpose of this example domain, cite exact evidence and state limitations. This is a public connectivity test.', evidence);
  const output = validateAnalysis(result.output, evidence);
  console.log(JSON.stringify({ generation: 'passed', validation: 'passed', model: route.provider_model_id,
    findings: output.findings.length, input_tokens: result.inputTokens, output_tokens: result.outputTokens }));
} catch (error) {
  console.log(JSON.stringify({ generation: 'failed', error_code: error instanceof ResearchError ? error.code : 'generation_check_failed' }));
  process.exitCode = 1;
} finally { await db.close(); }
