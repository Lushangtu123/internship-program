import type { Video } from '@/types/video';

export interface VideoSignals {
  plays: number;
  completes: number;
}

/** Per-viewer affinity built from likes / saves / follows (experimental). */
export interface UserAffinity {
  followedCreators: Set<string>;
  likedCreators: Set<string>;
  savedVideoIds: Set<string>;
  likedVideoIds: Set<string>;
  playedVideoIds: Set<string>;
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
  const shares = video.stats.shares ?? 0;

  const engagement =
    Math.log1p(likes) * 3 +
    Math.log1p(comments) * 2 +
    Math.log1p(shares) * 1.5 +
    Math.log1p(plays) * 1 +
    Math.log1p(completes) * 4;

  const createdAt = video.createdAt ?? now;
  const ageHours = Math.max(0, (now - createdAt) / 3_600_000);
  const freshness = 100 / (ageHours + 2);

  return engagement + freshness;
}

/**
 * Personal boost on top of the global score.
 * Followed / liked creators rise; already-liked videos sink slightly.
 */
export function computePersonalBoost(
  video: Video,
  affinity: UserAffinity
): number {
  let boost = 0;
  if (affinity.followedCreators.has(video.creator.id)) boost += 12;
  if (affinity.likedCreators.has(video.creator.id)) boost += 8;
  if (affinity.savedVideoIds.has(video.id)) boost += 4;
  if (affinity.playedVideoIds.has(video.id)) boost += 2;
  if (affinity.likedVideoIds.has(video.id)) boost -= 6;
  return boost;
}

export function rankVideos(
  videos: Video[],
  signalsByVideo: Record<string, VideoSignals>,
  now = Date.now(),
  affinity?: UserAffinity
): Video[] {
  return [...videos].sort((a, b) => {
    const scoreA =
      computeVideoScore(a, signalsByVideo[a.id], now) +
      (affinity ? computePersonalBoost(a, affinity) : 0);
    const scoreB =
      computeVideoScore(b, signalsByVideo[b.id], now) +
      (affinity ? computePersonalBoost(b, affinity) : 0);
    const scoreDiff = scoreB - scoreA;
    if (scoreDiff !== 0) return scoreDiff;
    return (b.createdAt ?? 0) - (a.createdAt ?? 0);
  });
}
