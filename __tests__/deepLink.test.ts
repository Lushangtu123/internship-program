import { describe, it, expect } from 'vitest';
import { buildVideoDeepLink, findVideoIndex } from '@/lib/deepLink';

describe('deepLink helpers', () => {
  it('builds a share URL with v= and preserves other params', () => {
    expect(buildVideoDeepLink('http://localhost:3000', 'v_002')).toBe(
      'http://localhost:3000/?v=v_002'
    );
    expect(
      buildVideoDeepLink('http://localhost:3000', 'v_003', '?debug=1&v=old')
    ).toBe('http://localhost:3000/?debug=1&v=v_003');
  });

  it('finds a video index or returns -1', () => {
    const videos = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(findVideoIndex(videos, 'b')).toBe(1);
    expect(findVideoIndex(videos, 'missing')).toBe(-1);
    expect(findVideoIndex(videos, null)).toBe(-1);
  });
});
