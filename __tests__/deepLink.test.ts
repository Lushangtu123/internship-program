import { describe, it, expect } from 'vitest';
import {
  buildVideoDeepLink,
  findVideoIndex,
  notificationTargetHref,
} from '@/lib/deepLink';

describe('deepLink helpers', () => {
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
});
