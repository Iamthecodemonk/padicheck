import { format, isSameDay } from 'date-fns';
import { anyCheck, checkTypes, type CheckTypeOption } from '../data/checkTypes';

const URL_RE =
/(https?:\/\/[^\s]+)|(www\.[^\s]+)|(\b[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|ng|net|org|io|co|app|shop|store|africa|uk|gh|ke|za)(\/[^\s]*)?)/i;

export const ACCEPTED_UPLOADS = 'image/jpeg,image/png,image/webp,application/pdf,.docx,text/plain';
export const ACCEPTED_DOCUMENTS = 'application/pdf,.docx,text/plain';
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const DATA_SAVER_WARN_BYTES = 5 * 1024 * 1024;

export function extractUrl(text: string): string | null {
  const match = text.match(URL_RE);
  if (!match) return null;
  const raw = match[0].replace(/[),.;]+$/, '');
  return raw.startsWith('http') ? raw : `https://${raw}`;
}

export function looksLikeUrl(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 3 && !/\s/.test(trimmed) && extractUrl(trimmed) !== null;
}

export function domainOf(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function getCheckType(id?: string): CheckTypeOption {
  return checkTypes.find((c) => c.id === id) ?? anyCheck;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (isSameDay(date, new Date())) return `Today, ${format(date, 'HH:mm')}`;
  return format(date, 'd MMM, HH:mm');
}

export function formatDate(iso: string): string {
  return format(new Date(iso), 'd MMM yyyy');
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount);
}

export type FileKind = 'image' | 'pdf' | 'document' | 'audio' | 'text' | 'unsupported';

export function detectFileKind(file: {type: string;name: string;}): FileKind {
  const name = file.name.toLowerCase();
  if (/^image\/(jpeg|png|webp)$/.test(file.type) || /\.(jpe?g|png|webp)$/.test(name)) return 'image';
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.docx')) return 'document';
  if (file.type === 'text/plain' || name.endsWith('.txt')) return 'text';
  return 'unsupported';
}

export function processorFor(kind: FileKind): string {
  switch (kind) {
    case 'image':
      return 'Vision & text recognition';
    case 'pdf':
    case 'document':
    case 'text':
      return 'Document reader';
    case 'audio':
      return 'Transcription';
    default:
      return 'Not supported';
  }
}

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}