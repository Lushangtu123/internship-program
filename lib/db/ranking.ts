import type { Video } from '@/types/video';

export interface VideoSignals {
  plays: number;
  completes: number;
}

/** Simple “For You” score: engagement + freshness (Step 5). */
export function computeVideoScore(
  video: Video,
  signals: VideoSignals | undefined,
  now = Date.now()
): number {
  const plays = signals?.plays ?? 0;
  const completes = signals?.completes ?? 0;
  const likes = video.stats.likes ?? 0;
  const comments = video.stats.comments ?? 0;

  const engagement =
    Math.log1p(likes) * 3 +
    Math.log1p(comments) * 2 +
    Math.log1p(plays) * 1 +
    Math.log1p(completes) * 4;

  const createdAt = video.createdAt ?? now;
  const ageHours = Math.max(0, (now - createdAt) / 3_600_000);
  const freshness = 100 / (ageHours + 2);

  return engagement + freshness;
}

export function rankVideos(
  videos: Video[],
  signalsByVideo: Record<string, VideoSignals>,
  now = Date.now()
): Video[] {
  return [...videos].sort((a, b) => {
    const scoreDiff =
      computeVideoScore(b, signalsByVideo[b.id], now) -
      computeVideoScore(a, signalsByVideo[a.id], now);
    if (scoreDiff !== 0) return scoreDiff;
    return (b.createdAt ?? 0) - (a.createdAt ?? 0);
  });
}
