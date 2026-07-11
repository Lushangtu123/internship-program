import type { QueryClient, InfiniteData } from '@tanstack/react-query';
import type { Video, VideosResponse } from '@/types/video';

type VideosInfinite = InfiniteData<VideosResponse, string | null>;

/** Pure helper — bump comment count on matching videos in feed pages. */
export function withCommentCountDelta(
  pages: VideosResponse[],
  videoId: string,
  delta: number
): VideosResponse[] {
  return pages.map((page) => ({
    ...page,
    items: page.items.map((video) =>
      video.id === videoId
        ? {
            ...video,
            stats: {
              ...video.stats,
              comments: Math.max(0, video.stats.comments + delta),
            },
          }
        : video
    ),
  }));
}

/** Set absolute comment count (e.g. after loading the drawer list). */
export function withCommentCountAbsolute(
  pages: VideosResponse[],
  videoId: string,
  count: number
): VideosResponse[] {
  const next = Math.max(0, count);
  return pages.map((page) => ({
    ...page,
    items: page.items.map((video) =>
      video.id === videoId
        ? {
            ...video,
            stats: {
              ...video.stats,
              comments: next,
            },
          }
        : video
    ),
  }));
}

function patchVideosQueries(
  queryClient: QueryClient,
  patch: (pages: VideosResponse[]) => VideosResponse[]
) {
  queryClient.setQueriesData<VideosInfinite>({ queryKey: ['videos'] }, (old) => {
    if (!old?.pages) return old;
    return { ...old, pages: patch(old.pages) };
  });

  queryClient.setQueriesData<{ videos?: Video[] }>(
    { queryKey: ['creator'] },
    (old) => {
      if (!old?.videos) return old;
      const patched = patch([{ items: old.videos, nextCursor: null }])[0];
      return { ...old, videos: patched.items };
    }
  );
}

export function bumpVideoCommentCount(
  queryClient: QueryClient,
  videoId: string,
  delta: number
) {
  patchVideosQueries(queryClient, (pages) =>
    withCommentCountDelta(pages, videoId, delta)
  );
}

export function setVideoCommentCount(
  queryClient: QueryClient,
  videoId: string,
  count: number
) {
  patchVideosQueries(queryClient, (pages) =>
    withCommentCountAbsolute(pages, videoId, count)
  );
}

export type PackagingPatch = {
  status: NonNullable<Video['status']>;
  src: string;
  progressiveSrc?: string;
};

/** Pure helper — update packaging fields on matching videos. */
export function withPackagingPatch(
  pages: VideosResponse[],
  videoId: string,
  patch: PackagingPatch
): VideosResponse[] {
  return pages.map((page) => ({
    ...page,
    items: page.items.map((video) =>
      video.id === videoId
        ? {
            ...video,
            status: patch.status,
            src: patch.src,
            progressiveSrc: patch.progressiveSrc ?? video.progressiveSrc,
          }
        : video
    ),
  }));
}

export function patchVideoPackaging(
  queryClient: QueryClient,
  videoId: string,
  patch: PackagingPatch
) {
  patchVideosQueries(queryClient, (pages) =>
    withPackagingPatch(pages, videoId, patch)
  );
}
