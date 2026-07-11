import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..');
const seedPath = join(root, 'public/mock/seed.json');

describe('mock seed assets', () => {
  const seed = JSON.parse(readFileSync(seedPath, 'utf-8'));

  it('references poster and avatar files that exist', () => {
    for (const video of seed.videos) {
      expect(existsSync(join(root, 'public', video.poster.replace(/^\//, '')))).toBe(true);
      expect(existsSync(join(root, 'public', video.creator.avatar.replace(/^\//, '')))).toBe(true);
    }
  });

  it('references caption files that exist when captionsVtt is set', () => {
    for (const video of seed.videos) {
      if (!video.captionsVtt) continue;
      expect(existsSync(join(root, 'public', video.captionsVtt.replace(/^\//, '')))).toBe(true);
    }
  });


  it('references local video files that exist when src is relative', () => {
    for (const video of seed.videos) {
      if (!video.src.startsWith('/')) continue;
      expect(existsSync(join(root, 'public', video.src.replace(/^\//, '')))).toBe(true);
    }
  });

  it('references comment avatar files that exist', () => {
    for (const comments of Object.values(seed.comments) as Array<Array<{ userAvatar: string }>>) {
      for (const comment of comments) {
        expect(existsSync(join(root, 'public', comment.userAvatar.replace(/^\//, '')))).toBe(true);
      }
    }
  });
});
