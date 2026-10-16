import { createHash } from 'node:crypto';
import type { AppConfig } from '../config.js';
import { cloudinaryStorage } from './cloudinary.js';
import { ultraSearch } from './ultrasearch.js';
import { fetchPublicPage, publicDownloader } from './public-web.js';
import { extractPdf } from './pdf-text.js';
import { geminiAnalyzer } from './gemini.js';
import { ResearchError, type ResearchAdapters } from '../modules/research/types.js';

export function researchAdapters(config: AppConfig): ResearchAdapters {
  const search = config.ultraSearchUrl ? ultraSearch(config.ultraSearchUrl) : undefined;
  const storage = config.cloudinary ? cloudinaryStorage(config.cloudinary) : undefined;
  const download = publicDownloader();
  return {
    async search(query, maxResults, secretRef) {
      if (!search) throw new ResearchError('search_unconfigured');
      return search(query, maxResults, secretRef);
    },
    fetchPage: fetchPublicPage,
    extractPdf,
    async downloadDocument(publicId) {
      if (!storage) throw new ResearchError('media_unconfigured');
      const url = storage.download(publicId, 'raw', '', Math.floor(Date.now() / 1000) + 300);
      return (await download(url, 25 * 1024 * 1024)).response.body;
    },
    analyze: geminiAnalyzer(),
  };
}

export function hashContent(value: string | Buffer) { return createHash('sha256').update(value).digest('hex'); }
