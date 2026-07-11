import { LocalObjectStore } from '@/lib/storage/localStore';
import { S3CompatibleObjectStore } from '@/lib/storage/s3Store';
import type { ObjectStore, StorageDriver } from '@/lib/storage/types';

export type { ObjectStore, StorageDriver } from '@/lib/storage/types';
export { LocalObjectStore } from '@/lib/storage/localStore';
export { S3CompatibleObjectStore } from '@/lib/storage/s3Store';

let cached: ObjectStore | null = null;

function readDriver(): StorageDriver {
  const raw = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
  return raw === 's3' ? 's3' : 'local';
}

/** Resolve the active object store (env-driven). */
export function getObjectStore(rootDir = process.cwd()): ObjectStore {
  if (cached) return cached;

  const driver = readDriver();
  if (driver === 's3') {
    const bucket = process.env.S3_BUCKET || '';
    const region = process.env.S3_REGION || 'us-east-1';
    const accessKeyId = process.env.S3_ACCESS_KEY_ID || '';
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || '';
    if (!bucket || !accessKeyId || !secretAccessKey) {
      console.warn(
        '[storage] STORAGE_DRIVER=s3 missing credentials; falling back to local'
      );
      cached = new LocalObjectStore(rootDir);
      return cached;
    }
    cached = new S3CompatibleObjectStore({
      bucket,
      region,
      accessKeyId,
      secretAccessKey,
      endpoint: process.env.S3_ENDPOINT || undefined,
      publicBaseUrl: process.env.S3_PUBLIC_BASE_URL || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    });
    return cached;
  }

  cached = new LocalObjectStore(rootDir);
  return cached;
}

/** Test helper — clear memoized store. */
export function resetObjectStoreCache() {
  cached = null;
}
