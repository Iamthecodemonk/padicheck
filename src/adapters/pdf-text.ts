import { Worker } from 'node:worker_threads';
import { ResearchError } from '../modules/research/types.js';

// Constant application code, never supplied by a document. PDF JS evaluation is
// disabled. A separate thread bounds CPU time without blocking the queue worker.
const workerCode = `
const { parentPort, workerData } = require('node:worker_threads');
(async () => {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = await getDocument({data: new Uint8Array(workerData), isEvalSupported: false, verbosity: 0,
    useSystemFonts: false, disableFontFace: true, useWorkerFetch: false}).promise;
  try {
    if (pdf.numPages > 50) throw new Error('pdf_too_many_pages');
    let text = ''; let truncated = false;
    for (let page = 1; page <= pdf.numPages; page++) {
      const content = await (await pdf.getPage(page)).getTextContent();
      const line = content.items.map(item => typeof item.str === 'string' ? item.str : '').join(' ');
      text += '\\n' + line;
      if (text.length > 16000) {truncated = true; break;}
    }
    parentPort.postMessage({text: text.trim().slice(0, 16000), pages: pdf.numPages, truncated});
  } finally {await pdf.destroy();}
})().catch(() => parentPort.postMessage({error: 'pdf_extraction_failed'}));
`;

export async function extractPdf(data: Buffer): Promise<{ text: string; pages: number; truncated: boolean }> {
  if (!data.subarray(0, 5).equals(Buffer.from('%PDF-')) || data.length > 25 * 1024 * 1024) throw new ResearchError('invalid_pdf');
  const worker = new Worker(workerCode, { eval: true, workerData: new Uint8Array(data), resourceLimits: { maxOldGenerationSizeMb: 192 } });
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new ResearchError('pdf_extraction_timeout')), 15000);
      worker.once('message', result => {
        clearTimeout(timer);
        if (result.error || typeof result.text !== 'string' || !result.text.trim()) reject(new ResearchError('pdf_text_unavailable'));
        else resolve(result);
      });
      worker.once('error', () => { clearTimeout(timer); reject(new ResearchError('pdf_extraction_failed')); });
      worker.once('exit', code => { if (code !== 0) { clearTimeout(timer); reject(new ResearchError('pdf_extraction_failed')); } });
    });
  } finally { await worker.terminate(); }
}
