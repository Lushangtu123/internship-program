import { describe, it, expect } from 'vitest';
import { computeVideoScore, rankVideos } from '@/lib/db/ranking';
import type { Video } from '@/types/video';

function makeVideo(partial: Partial<Video> & { id: string }): Video {
  return {
    src: '/x.mp4',
    poster: '/p.jpg',
    duration: 10,
    creator: { id: 'u', handle: '@u', avatar: '/a.png' },
    caption: 'c',
    music: { title: 't', artist: 'a' },
    stats: { likes: 0, comments: 0, shares: 0 },
    createdAt: Date.now(),
    ...partial,
  };
}

describe('ranking', () => {
  it('scores higher engagement above equal-age videos', () => {
    const now = Date.now();
    const quiet = makeVideo({
      id: 'quiet',
      createdAt: now,
      stats: { likes: 0, comments: 0, shares: 0 },
    });
    const hot = makeVideo({
      id: 'hot',
      createdAt: now,
      stats: { likes: 50, comments: 10, shares: 0 },
    });

    expect(computeVideoScore(hot, { plays: 20, completes: 8 }, now)).toBeGreaterThan(
      computeVideoScore(quiet, { plays: 1, completes: 0 }, now)
    );
  });

  it('ranks videos by score descending', () => {
    const now = Date.now();
    const videos = [
      makeVideo({
        id: 'old-quiet',
        createdAt: now - 72 * 3_600_000,
        stats: { likes: 1, comments: 0, shares: 0 },
      }),
      makeVideo({
        id: 'fresh-hot',
        createdAt: now - 1 * 3_600_000,
        stats: { likes: 40, comments: 5, shares: 0 },
      }),
    ];

    const ranked = rankVideos(
      videos,
      {
        'fresh-hot': { plays: 30, completes: 10 },
        'old-quiet': { plays: 2, completes: 0 },
      },
      now
    );

    expect(ranked.map((v) => v.id)).toEqual(['fresh-hot', 'old-quiet']);
  });
});
