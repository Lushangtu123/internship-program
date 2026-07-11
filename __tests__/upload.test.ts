import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, copyFile, mkdir, readFile, access } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { saveUploadedVideo, acceptUploadedVideo } from '@/lib/upload/processVideo';

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

  it('accepts an upload without waiting for HLS', async () => {
    const buffer = await readFile(path.join(tempRoot, 'fixture.webm'));
    const file = new File([buffer], 'clip.webm', { type: 'video/webm' });
    const saved = await acceptUploadedVideo(file, tempRoot);

    expect(saved.progressiveSrc.startsWith('/uploads/videos/')).toBe(true);
    expect(saved.poster.startsWith('/uploads/posters/')).toBe(true);
    expect(saved.duration).toBeGreaterThan(0);
    await access(
      path.join(tempRoot, 'public', saved.progressiveSrc.replace(/^\//, ''))
    );
  });

  it(
    'packages an ABR ladder under public/uploads/hls',
    async () => {
      const buffer = await readFile(path.join(tempRoot, 'fixture.webm'));
      const file = new File([buffer], 'clip.webm', { type: 'video/webm' });
      const saved = await saveUploadedVideo(file, tempRoot);

      expect(saved.src.includes('/uploads/hls/')).toBe(true);
      expect(saved.src.endsWith('master.m3u8') || saved.src.endsWith('index.m3u8')).toBe(
        true
      );
      expect(saved.progressiveSrc.startsWith('/uploads/videos/')).toBe(true);
      expect(saved.poster.startsWith('/uploads/posters/')).toBe(true);
      expect(saved.duration).toBeGreaterThan(0);

      await access(path.join(tempRoot, 'public', saved.src.replace(/^\//, '')));
      await access(
        path.join(tempRoot, 'public', saved.progressiveSrc.replace(/^\//, ''))
      );
      await access(path.join(tempRoot, 'public', saved.poster.replace(/^\//, '')));

      const hlsRoot = path.join(
        tempRoot,
        'public/uploads/hls',
        saved.id
      );
      const master = await readFile(path.join(hlsRoot, 'master.m3u8'), 'utf-8');
      expect(master).toContain('360p/index.m3u8');
      expect(master).toContain('720p/index.m3u8');
      await access(path.join(hlsRoot, '360p/index.m3u8'));
      await access(path.join(hlsRoot, '480p/index.m3u8'));
      await access(path.join(hlsRoot, '720p/index.m3u8'));
    },
    180_000
  );
});
