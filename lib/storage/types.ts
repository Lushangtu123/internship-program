/** Object storage abstraction for upload artifacts (experimental). */

export type StorageDriver = 'local' | 's3';

export interface ObjectStore {
  readonly driver: StorageDriver;
  /** Write bytes; returns a publicly reachable URL. */
  put(
    key: string,
    body: Buffer,
    contentType?: string
  ): Promise<string>;
  /** Upload an existing local file; returns a publicly reachable URL. */
  putFile(
    key: string,
    filePath: string,
    contentType?: string
  ): Promise<string>;
  /** Upload all files under a local directory. */
  putDirectory(keyPrefix: string, localDir: string): Promise<string[]>;
  /** Public URL for a key (no network I/O). */
  publicUrl(key: string): string;
}

export function normalizeStorageKey(key: string): string {
  return key.replace(/^\/+/, '').replace(/\\/g, '/');
}

export function guessContentType(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
  if (lower.endsWith('.ts')) return 'video/mp2t';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}
