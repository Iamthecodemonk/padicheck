export type ResourceType = 'image' | 'video' | 'raw';
export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'other';
export type UploadSpec = {
  publicId: string; resourceType: ResourceType; bytes: number;
};
export interface MediaStorage {
  upload(data: Buffer, spec: UploadSpec): Promise<unknown>;
  destroy(publicId: string, resourceType: ResourceType): Promise<void>;
  download(publicId: string, resourceType: ResourceType, format: string, expiresAt: number): string;
}
export type MediaRow = {
  media_id: string; uploaded_by_user_id: string | null; storage_provider: string;
  provider_asset_id: string | null; provider_public_id: string;
  provider_resource_type: ResourceType; provider_delivery_type: string;
  provider_version: string | number | null; original_filename: string;
  media_type: MediaType; mime_type: string; size_bytes: string | number;
  sha256: string | null; visibility: string; upload_status: string; created_at: Date;
};
