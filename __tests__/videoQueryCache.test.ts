import { describe, it, expect } from 'vitest';
import {
  playbackSrcForVideo,
} from '@/hooks/useVideoPackagingPoll';
import {
  withCommentCountAbsolute,
  withCommentCountDelta,
  withPackagingPatch,
} from '@/lib/videoQueryCache';
import type { VideosResponse } from '@/types/video';

function page(items: Array<{ id: string; comments: number }>): VideosResponse {
  return {
    nextCursor: null,
    items: items.map((item) => ({
      id: item.id,
      src: `/hls/${item.id}/index.m3u8`,
      poster: '',
      duration: 1,
      creator: { id: 'u', handle: '@u', avatar: '' },
      caption: '',
      music: { title: '', artist: '' },
      stats: { likes: 0, comments: item.comments, shares: 0 },
      status: 'ready',
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

  it('patches packaging fields for a matching video', () => {
    const pages = [page([{ id: 'v_1', comments: 1 }])];
    pages[0].items[0].status = 'processing';
    pages[0].items[0].progressiveSrc = '/uploads/v_1.mp4';
    const next = withPackagingPatch(pages, 'v_1', {
      status: 'ready',
      src: '/uploads/hls/v_1/master.m3u8',
      progressiveSrc: '/uploads/v_1.mp4',
    });
    expect(next[0].items[0].status).toBe('ready');
    expect(next[0].items[0].src).toContain('master.m3u8');
  });
});

describe('playbackSrcForVideo', () => {
  it('uses progressive src while processing', () => {
    expect(
      playbackSrcForVideo({
        src: '/hls/x.m3u8',
        progressiveSrc: '/x.mp4',
        status: 'processing',
      })
    ).toBe('/x.mp4');
  });

  it('uses src when ready', () => {
    expect(
      playbackSrcForVideo({
        src: '/hls/x.m3u8',
        progressiveSrc: '/x.mp4',
        status: 'ready',
      })
    ).toBe('/hls/x.m3u8');
  });
});
