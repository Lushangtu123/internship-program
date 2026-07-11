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
      if (key !== 'v' && key !== 'c') url.searchParams.set(key, value);
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

/**
 * Inbox row target:
 * - follow → creator profile
 * - comment → video + open comments (`c=1`)
 * - like → video
 */
export function notificationTargetHref(item: {
  type: string;
  videoId?: string;
  actorId: string;
}): string | null {
  if (item.type === 'follow') {
    return item.actorId ? `/creator/${item.actorId}` : null;
  }
  if (item.videoId) {
    const params = new URLSearchParams({ v: item.videoId });
    if (item.type === 'comment') params.set('c', '1');
    return `/?${params.toString()}`;
  }
  return item.actorId ? `/creator/${item.actorId}` : null;
}

/** True when every feed page was loaded and ?v= still isn't in the list. */
export function isDeepLinkExhausted(input: {
  deepLinkId: string | null | undefined;
  foundIndex: number;
  isLoading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}): boolean {
  if (!input.deepLinkId) return false;
  if (input.foundIndex >= 0) return false;
  if (input.isLoading || input.isFetchingNextPage) return false;
  return !input.hasNextPage;
}
