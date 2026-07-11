/** Build a shareable feed URL that opens a specific video. */
export function buildVideoDeepLink(
  origin: string,
  videoId: string,
  currentSearch?: string
): string {
  const url = new URL(origin);
  if (currentSearch) {
    const existing = new URLSearchParams(
      currentSearch.startsWith('?') ? currentSearch.slice(1) : currentSearch
    );
    existing.forEach((value, key) => {
      if (key !== 'v') url.searchParams.set(key, value);
    });
  }
  url.searchParams.set('v', videoId);
  return `${url.origin}/?${url.searchParams.toString()}`;
}

/** Find a video index; used by deep-link scroll logic. */
export function findVideoIndex(
  videos: Array<{ id: string }>,
  videoId: string | null | undefined
): number {
  if (!videoId) return -1;
  return videos.findIndex((video) => video.id === videoId);
}

/** Inbox row target: video deep link, or actor profile for follows. */
export function notificationTargetHref(item: {
  type: string;
  videoId?: string;
  actorId: string;
}): string | null {
  if (item.type === 'follow') {
    return item.actorId ? `/creator/${item.actorId}` : null;
  }
  if (item.videoId) {
    return `/?v=${encodeURIComponent(item.videoId)}`;
  }
  return item.actorId ? `/creator/${item.actorId}` : null;
}
