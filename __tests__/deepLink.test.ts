import { describe, it, expect } from 'vitest';
import {
  applyFeedModeToSearchParams,
  buildVideoDeepLink,
  findVideoIndex,
  isDeepLinkExhausted,
  notificationTargetHref,
  parseFeedMode,
} from '@/lib/deepLink';

describe('deepLink helpers', () => {
  it('parses feed mode from query values', () => {
    expect(parseFeedMode('following')).toBe('following');
    expect(parseFeedMode('foryou')).toBe('foryou');
    expect(parseFeedMode(null)).toBe('foryou');
  });

  it('writes feed mode into search params and clears v on Following', () => {
    const params = new URLSearchParams('v=v_001&c=1&debug=1');
    applyFeedModeToSearchParams(params, 'following');
    expect(params.get('feed')).toBe('following');
    expect(params.get('v')).toBeNull();
    expect(params.get('c')).toBeNull();
    expect(params.get('debug')).toBe('1');

    applyFeedModeToSearchParams(params, 'foryou');
    expect(params.get('feed')).toBeNull();
    expect(params.get('debug')).toBe('1');
  });

  it('builds a share URL with v= and preserves other params', () => {
    expect(buildVideoDeepLink('http://localhost:3000', 'v_002')).toBe(
      'http://localhost:3000/?v=v_002'
    );
    expect(
      buildVideoDeepLink('http://localhost:3000', 'v_003', '?debug=1&v=old')
    ).toBe('http://localhost:3000/?debug=1&v=v_003');
  });

  it('strips c= when building a share link', () => {
    expect(
      buildVideoDeepLink('http://localhost:3000', 'v_003', '?c=1&v=old')
    ).toBe('http://localhost:3000/?v=v_003');
  });

  it('finds a video index or returns -1', () => {
    const videos = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(findVideoIndex(videos, 'b')).toBe(1);
    expect(findVideoIndex(videos, 'missing')).toBe(-1);
    expect(findVideoIndex(videos, null)).toBe(-1);
  });

  it('maps notifications to video, comments, or profile hrefs', () => {
    expect(
      notificationTargetHref({
        type: 'like',
        videoId: 'v_001',
        actorId: 'u_2',
      })
    ).toBe('/?v=v_001');
    expect(
      notificationTargetHref({
        type: 'comment',
        videoId: 'v_009',
        actorId: 'u_2',
      })
    ).toBe('/?v=v_009&c=1');
    expect(
      notificationTargetHref({
        type: 'follow',
        actorId: 'u_3',
      })
    ).toBe('/creator/u_3');
  });

  it('detects when a deep link search is exhausted', () => {
    expect(
      isDeepLinkExhausted({
        deepLinkId: 'v_missing',
        foundIndex: -1,
        isLoading: false,
        hasNextPage: false,
        isFetchingNextPage: false,
      })
    ).toBe(true);
    expect(
      isDeepLinkExhausted({
        deepLinkId: 'v_missing',
        foundIndex: -1,
        isLoading: false,
        hasNextPage: true,
        isFetchingNextPage: false,
      })
    ).toBe(false);
    expect(
      isDeepLinkExhausted({
        deepLinkId: 'v_001',
        foundIndex: 2,
        isLoading: false,
        hasNextPage: false,
        isFetchingNextPage: false,
      })
    ).toBe(false);
  });
});
