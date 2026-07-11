import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { LocalObjectStore } from '@/lib/storage/localStore';
import { getObjectStore, resetObjectStoreCache } from '@/lib/storage';

describe('object storage', () => {
  let rootDir: string;

  beforeEach(async () => {
    resetObjectStoreCache();
    rootDir = await mkdtemp(path.join(tmpdir(), 'obj-store-'));
    await mkdir(path.join(rootDir, 'public/uploads'), { recursive: true });
  });

  afterEach(async () => {
    resetObjectStoreCache();
    await rm(rootDir, { recursive: true, force: true });
  });

  it('local store writes under public/uploads and returns /uploads URLs', async () => {
    const store = new LocalObjectStore(rootDir);
    const url = await store.put(
      'videos/demo.webm',
      Buffer.from('fake-video'),
      'video/webm'
    );
    expect(url).toBe('/uploads/videos/demo.webm');
    const disk = await readFile(
      path.join(rootDir, 'public/uploads/videos/demo.webm'),
      'utf-8'
    );
    expect(disk).toBe('fake-video');
    expect(store.publicUrl('posters/x.jpg')).toBe('/uploads/posters/x.jpg');
  });

  it('local putDirectory uploads nested files', async () => {
    const store = new LocalObjectStore(rootDir);
    const dir = path.join(rootDir, 'hls-src');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'index.m3u8'), '#EXTM3U');
    await writeFile(path.join(dir, 'seg_000.ts'), 'ts');
    const urls = await store.putDirectory('hls/up_1', dir);
    expect(urls).toContain('/uploads/hls/up_1/index.m3u8');
    expect(urls).toContain('/uploads/hls/up_1/seg_000.ts');
  });

  it('getObjectStore defaults to local', () => {
    delete process.env.STORAGE_DRIVER;
    resetObjectStoreCache();
    const store = getObjectStore(rootDir);
    expect(store.driver).toBe('local');
  });

  it('getObjectStore falls back to local when s3 env incomplete', () => {
    process.env.STORAGE_DRIVER = 's3';
    delete process.env.S3_BUCKET;
    resetObjectStoreCache();
    const store = getObjectStore(rootDir);
    expect(store.driver).toBe('local');
    delete process.env.STORAGE_DRIVER;
  });
});
