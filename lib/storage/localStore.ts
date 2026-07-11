import { promises as fs } from 'fs';
import path from 'path';
import {
  guessContentType,
  normalizeStorageKey,
  type ObjectStore,
} from '@/lib/storage/types';

/**
 * Default driver: files under public/uploads, URLs like /uploads/...
 * Same behavior as the pre-abstraction upload pipeline.
 */
export class LocalObjectStore implements ObjectStore {
  readonly driver = 'local' as const;

  constructor(private readonly rootDir = process.cwd()) {}

  private absolutePath(key: string) {
    return path.join(this.rootDir, 'public', 'uploads', normalizeStorageKey(key));
  }

  publicUrl(key: string): string {
    return `/uploads/${normalizeStorageKey(key)}`;
  }

  async put(
    key: string,
    body: Buffer,
    contentType?: string
  ): Promise<string> {
    void contentType;
    const dest = this.absolutePath(key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, body);
    return this.publicUrl(key);
  }

  async putFile(
    key: string,
    filePath: string,
    contentType?: string
  ): Promise<string> {
    void contentType;
    const dest = this.absolutePath(key);
    const normalizedKey = normalizeStorageKey(key);
    const destResolved = path.resolve(dest);
    const srcResolved = path.resolve(filePath);

    // Already in the right place (common for local ffmpeg output).
    if (destResolved === srcResolved) {
      return this.publicUrl(normalizedKey);
    }

    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(filePath, dest);
    return this.publicUrl(normalizedKey);
  }

  /** Upload every file under a local directory, preserving relative paths. */
  async putDirectory(
    keyPrefix: string,
    localDir: string
  ): Promise<string[]> {
    const urls: string[] = [];
    const entries = await fs.readdir(localDir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(localDir, entry.name);
      if (entry.isDirectory()) {
        const nested = await this.putDirectory(
          `${normalizeStorageKey(keyPrefix)}/${entry.name}`,
          full
        );
        urls.push(...nested);
        continue;
      }
      const key = `${normalizeStorageKey(keyPrefix)}/${entry.name}`;
      urls.push(await this.putFile(key, full, guessContentType(key)));
    }
    return urls;
  }
}
