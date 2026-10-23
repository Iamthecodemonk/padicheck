// Holds files handed over from the Share Target screen to the check flow for this session only.
// Files never leave the device until the user confirms a check.
let pendingFiles: File[] = [];

export function putSharedFiles(files: File[]): void {
  pendingFiles = files;
}

export function takeSharedFiles(): File[] {
  const files = pendingFiles;
  pendingFiles = [];
  return files;
}

export const SHARE_INBOX_CACHE = 'pc-share-inbox';

// Reads files the service worker stored from a POST share. The inbox is private to this
// origin, scoped to the signed-in device, and cleared as soon as it is read.
export async function readShareInbox(count: number): Promise<File[]> {
  if (!('caches' in window) || count <= 0) return [];
  try {
    const cache = await caches.open(SHARE_INBOX_CACHE);
    const files: File[] = [];
    for (let i = 0; i < count; i += 1) {
      const key = `/share-inbox/${i}`;
      const response = await cache.match(key);
      if (!response) continue;
      const blob = await response.blob();
      const name = decodeURIComponent(response.headers.get('X-File-Name') ?? `shared-${i + 1}`);
      files.push(new File([blob], name, { type: blob.type }));
      await cache.delete(key);
    }
    return files;
  } catch {
    return [];
  }
}