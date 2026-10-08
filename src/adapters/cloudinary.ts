import { v2 as cloudinary } from 'cloudinary';
import type { MediaStorage, UploadSpec, ResourceType } from '../modules/media/types.js';
import type { AppConfig } from '../config.js';

export function cloudinaryStorage(config: NonNullable<AppConfig['cloudinary']>): MediaStorage {
  // Pass per-call credentials rather than changing SDK-global configuration.
  const credentials = { cloud_name: config.cloudName, api_key: config.apiKey, api_secret: config.apiSecret, secure: true };
  return {
    upload(data: Buffer, spec: UploadSpec) {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ ...credentials,
          public_id: spec.publicId, resource_type: spec.resourceType, type: 'authenticated',
          overwrite: false, unique_filename: false, use_filename: false, timeout: 60_000,
        }, (error, result) => error ? reject(error) : resolve(result));
        stream.on('error', reject);
        stream.end(data);
      });
    },
    async destroy(publicId: string, resourceType: ResourceType) {
      const options = { ...credentials, resource_type: resourceType,
        type: 'authenticated' as const, invalidate: true, timeout: 30_000 };
      const result = await cloudinary.uploader.destroy(publicId, options);
      if (!['ok', 'not found'].includes(result.result)) throw new Error('Cloudinary deletion failed');
    },
    download(publicId, resourceType, format, expiresAt) {
      return cloudinary.utils.private_download_url(publicId, format, { ...credentials,
        resource_type: resourceType, type: 'authenticated', expires_at: expiresAt, attachment: true });
    },
  };
}
