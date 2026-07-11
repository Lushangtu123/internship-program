import { describe, it, expect } from 'vitest';
import {
  withCommentCountAbsolute,
  withCommentCountDelta,
} from '@/lib/videoQueryCache';
import type { VideosResponse } from '@/types/video';

function page(items: Array<{ id: string; comments: number }>): VideosResponse {
  return {
    nextCursor: null,
    items: items.map((item) => ({
      id: item.id,
      src: '',
      poster: '',
      duration: 1,
      creator: { id: 'u', handle: '@u', avatar: '' },
      caption: '',
      music: { title: '', artist: '' },
      stats: { likes: 0, comments: item.comments, shares: 0 },
    })),
  };
}

describe('videoQueryCache comment counts', () => {
  it('bumps matching video comment counts across pages', () => {
    const pages = [
      page([
        { id: 'v_1', comments: 2 },
        { id: 'v_2', comments: 5 },
      ]),
    ];
    const next = withCommentCountDelta(pages, 'v_1', 1);
    expect(next[0].items[0].stats.comments).toBe(3);
    expect(next[0].items[1].stats.comments).toBe(5);
  });

  it('does not go below zero', () => {
    const pages = [page([{ id: 'v_1', comments: 0 }])];
    expect(
      withCommentCountDelta(pages, 'v_1', -1)[0].items[0].stats.comments
    ).toBe(0);
  });

  it('sets absolute comment counts', () => {
    const pages = [page([{ id: 'v_1', comments: 9 }])];
    expect(
      withCommentCountAbsolute(pages, 'v_1', 4)[0].items[0].stats.comments
    ).toBe(4);
  });
});
