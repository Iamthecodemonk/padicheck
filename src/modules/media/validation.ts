import { fileTypeFromBuffer } from 'file-type';
import { ApiError } from '../../errors.js';
import type { MediaType, ResourceType, UploadSpec } from './types.js';

const supported: Record<string, { mediaType: MediaType; resourceType: ResourceType; format: string }> = {
  'image/jpeg': { mediaType: 'image', resourceType: 'image', format: 'jpg' },
  'image/png': { mediaType: 'image', resourceType: 'image', format: 'png' },
  'image/webp': { mediaType: 'image', resourceType: 'image', format: 'webp' },
  'image/gif': { mediaType: 'image', resourceType: 'image', format: 'gif' },
  'video/mp4': { mediaType: 'video', resourceType: 'video', format: 'mp4' },
  'video/webm': { mediaType: 'video', resourceType: 'video', format: 'webm' },
  'audio/mpeg': { mediaType: 'audio', resourceType: 'video', format: 'mp3' },
  'audio/wav': { mediaType: 'audio', resourceType: 'video', format: 'wav' },
  'audio/x-wav': { mediaType: 'audio', resourceType: 'video', format: 'wav' },
  'audio/flac': { mediaType: 'audio', resourceType: 'video', format: 'flac' },
  'audio/ogg': { mediaType: 'audio', resourceType: 'video', format: 'ogg' },
  'application/pdf': { mediaType: 'document', resourceType: 'raw', format: 'pdf' },
};

export async function inspectUpload(data: Buffer, claimedMime: string) {
  if (!data.length) throw new ApiError(400, 'empty_upload', 'The uploaded file is empty');
  const detected = await fileTypeFromBuffer(data).catch(() => undefined);
  const type = detected && supported[detected.mime];
  if (!detected || !type) throw new ApiError(415, 'unsupported_media', 'Unsupported file content');
  if (claimedMime !== 'application/octet-stream' && claimedMime !== detected.mime &&
      !(type.format === 'wav' && ['audio/wav', 'audio/x-wav'].includes(claimedMime))) {
    throw new ApiError(415, 'mime_mismatch', 'File content does not match the declared MIME type');
  }
  return { ...type, mimeType: detected.mime };
}

export function mediaFormat(mime: string) {
  const type = supported[mime];
  if (!type) throw new ApiError(409, 'unsupported_media', 'Stored media format is unsupported');
  return type.resourceType === 'raw' ? '' : type.format;
}

export function validateUploadResult(value: unknown, spec: UploadSpec) {
  const result = value as Record<string, unknown> | null;
  if (!result || typeof result.asset_id !== 'string' || !result.asset_id.trim() ||
      result.public_id !== spec.publicId || result.resource_type !== spec.resourceType ||
      result.type !== 'authenticated' || result.bytes !== spec.bytes ||
      !Number.isSafeInteger(result.version) || Number(result.version) <= 0) {
    throw new ApiError(502, 'invalid_upload_result', 'Storage provider returned invalid upload metadata');
  }
  return { assetId: result.asset_id, publicId: spec.publicId, resourceType: spec.resourceType,
    version: Number(result.version), bytes: spec.bytes };
}
