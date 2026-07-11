import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, copyFile, mkdir, readFile, access } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { saveUploadedVideo } from '@/lib/upload/processVideo';

describe('saveUploadedVideo', () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'upload-root-'));
    await mkdir(path.join(tempRoot, 'public/posters'), { recursive: true });
    await copyFile(
      path.join(process.cwd(), 'public/posters/1.png'),
      path.join(tempRoot, 'public/posters/1.png')
    );
    await copyFile(
      path.join(process.cwd(), 'public/videos/flower.webm'),
      path.join(tempRoot, 'fixture.webm')
    );
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('stores video under public/uploads and extracts a poster', async () => {
    const buffer = await readFile(path.join(tempRoot, 'fixture.webm'));
    const file = new File([buffer], 'clip.webm', { type: 'video/webm' });
    const saved = await saveUploadedVideo(file, tempRoot);

    expect(saved.src.startsWith('/uploads/videos/')).toBe(true);
    expect(saved.poster.startsWith('/uploads/posters/')).toBe(true);
    expect(saved.duration).toBeGreaterThan(0);

    await access(path.join(tempRoot, 'public', saved.src.replace(/^\//, '')));
    await access(path.join(tempRoot, 'public', saved.poster.replace(/^\//, '')));
  });
});
