/** Mobile-first ABR ladder for short-form vertical video (experimental). */

export interface AbrRendition {
  /** Folder / playlist name under the HLS package dir */
  name: string;
  /** Target height (width auto, even). */
  height: number;
  /** ffmpeg -b:v */
  videoBitrate: string;
  /** EXT-X-STREAM-INF BANDWIDTH (bits/s), includes audio headroom */
  bandwidth: number;
  /** Optional average bandwidth hint */
  averageBandwidth: number;
}

/**
 * Three rungs keep encode time reasonable while covering weak / mid / Wi-Fi.
 * Heights suit 9:16 sources; `scale=-2:H` preserves aspect.
 */
export const ABR_LADDER: AbrRendition[] = [
  {
    name: '360p',
    height: 360,
    videoBitrate: '400k',
    bandwidth: 550_000,
    averageBandwidth: 480_000,
  },
  {
    name: '480p',
    height: 480,
    videoBitrate: '900k',
    bandwidth: 1_200_000,
    averageBandwidth: 1_000_000,
  },
  {
    name: '720p',
    height: 720,
    videoBitrate: '1800k',
    bandwidth: 2_400_000,
    averageBandwidth: 2_000_000,
  },
];

/** Build a master playlist referencing variant playlists. */
export function buildMasterPlaylist(
  renditions: AbrRendition[],
  options?: { hasAudio?: boolean }
): string {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3'];
  for (const rung of renditions) {
    // Approximate 9:16 width from height for the RESOLUTION tag.
    const width = Math.max(2, Math.round((rung.height * 9) / 16) * 2);
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${rung.bandwidth},AVERAGE-BANDWIDTH=${rung.averageBandwidth},RESOLUTION=${width}x${rung.height},CODECS="avc1.4d401f${options?.hasAudio === false ? '' : ',mp4a.40.2'}"`
    );
    lines.push(`${rung.name}/index.m3u8`);
  }
  return `${lines.join('\n')}\n`;
}
