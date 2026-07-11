import { describe, it, expect } from 'vitest';
import { ABR_LADDER, buildMasterPlaylist } from '@/lib/upload/abrLadder';

describe('abrLadder', () => {
  it('defines three mobile-first rungs', () => {
    expect(ABR_LADDER.map((r) => r.name)).toEqual(['360p', '480p', '720p']);
    expect(ABR_LADDER[0].height).toBeLessThan(ABR_LADDER[1].height);
    expect(ABR_LADDER[1].bandwidth).toBeLessThan(ABR_LADDER[2].bandwidth);
  });

  it('builds a master playlist with STREAM-INF entries', () => {
    const master = buildMasterPlaylist(ABR_LADDER, { hasAudio: true });
    expect(master).toContain('#EXTM3U');
    expect(master).toContain('360p/index.m3u8');
    expect(master).toContain('480p/index.m3u8');
    expect(master).toContain('720p/index.m3u8');
    expect(master).toContain('BANDWIDTH=');
    expect(master).toContain('mp4a.40.2');
  });

  it('omits audio codec when hasAudio is false', () => {
    const master = buildMasterPlaylist(ABR_LADDER, { hasAudio: false });
    expect(master).not.toContain('mp4a.40.2');
    expect(master).toContain('avc1.4d401f');
  });
});
