'use client';

import { Suspense, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { VideoCard } from '@/components/VideoCard';
import { CommentsDrawer } from '@/components/CommentsDrawer';
import { DebugPanel } from '@/components/DebugPanel';
import { BottomNav, type BottomNavTab } from '@/components/BottomNav';
import { UploadSheet } from '@/components/UploadSheet';
import { NotificationSheet } from '@/components/NotificationSheet';
import { FollowingEmptyState } from '@/components/FollowingEmptyState';
import { useKeyboardShortcuts } from '@/lib/keyboard';
import { useUIStore } from '@/lib/store';
import { fetchVideos } from '@/lib/api';
import { useVideoPrefetch } from '@/lib/usePrefetch';
import { qoeLogger } from '@/lib/qoe';
import { findVideoIndex, isDeepLinkExhausted } from '@/lib/deepLink';
import { useRouter, useSearchParams } from 'next/navigation';

function FeedPageContent() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [feedMode, setFeedMode] = useState<'foryou' | 'following'>('foryou');
  const [sheet, setSheet] = useState<'upload' | 'inbox' | null>(null);
  const [deepLinkMissing, setDeepLinkMissing] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const deepLinkHandledRef = useRef<string | null>(null);
  const commentsDeepLinkHandledRef = useRef<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkId = searchParams.get('v');
  const openCommentsFromLink = searchParams.get('c') === '1';
  /** Next patches history.replaceState — block active-video URL sync until ?v= is resolved. */
  const urlSyncEnabledRef = useRef(!deepLinkId);

  const navActive: BottomNavTab =
    sheet === 'inbox'
      ? 'inbox'
      : sheet === 'upload'
        ? 'create'
        : feedMode === 'following'
          ? 'following'
          : 'home';

  const { commentsOpen, setCommentsOpen, toggleMute, toggleCaptions, debugMode, setDebugMode } = useUIStore();

  // Optional deep-links from profile bottom nav
  useEffect(() => {
    const feed = searchParams.get('feed');
    if (feed === 'following') setFeedMode('following');
    const sheetParam = searchParams.get('sheet');
    if (sheetParam === 'upload' || sheetParam === 'inbox') {
      setSheet(sheetParam);
    }
  }, [searchParams]);

  // Intentional video deep links close sheets and force For You.
  // Do NOT run when a sheet is already open — arriving from Me as
  // /?sheet=inbox causes URL-sync to add ?v=, which must not dismiss Inbox.
  useEffect(() => {
    if (!deepLinkId) return;
    if (deepLinkHandledRef.current === deepLinkId) return;
    if (sheet) return;
    if (searchParams.get('sheet')) return;
    urlSyncEnabledRef.current = false;
    setDeepLinkMissing(null);
    setFeedMode('foryou');
  }, [deepLinkId, sheet, searchParams]);

  // Fetch videos with infinite scroll
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['videos', feedMode],
    queryFn: ({ pageParam }) => fetchVideos(pageParam, 5, feedMode),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
  });

  const videos = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data]
  );

  useEffect(() => {
    setCurrentIndex(0);
    deepLinkHandledRef.current = null;
    commentsDeepLinkHandledRef.current = null;
    containerRef.current?.scrollTo({ top: 0 });
  }, [feedMode]);

  // Prefetch adjacent videos
  useVideoPrefetch(currentIndex, videos, 2);

  // Scroll to video by index
  const scrollToVideo = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    if (index < 0 || index >= videos.length) return;
    
    const container = containerRef.current;
    if (!container) return;

    const targetScroll = index * container.clientHeight;
    container.scrollTo({
      top: targetScroll,
      behavior,
    });

    setCurrentIndex(index);
  }, [videos.length]);

  // Deep link: load pages until ?v= is found, then jump (or report missing)
  useEffect(() => {
    if (!deepLinkId || feedMode !== 'foryou' || isLoading) return;
    if (deepLinkHandledRef.current === deepLinkId) return;

    const index = findVideoIndex(videos, deepLinkId);
    if (index >= 0) {
      deepLinkHandledRef.current = deepLinkId;
      setDeepLinkMissing(null);
      scrollToVideo(index, 'auto');
      return;
    }

    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
      return;
    }

    if (
      isDeepLinkExhausted({
        deepLinkId,
        foundIndex: index,
        isLoading,
        hasNextPage: Boolean(hasNextPage),
        isFetchingNextPage,
      })
    ) {
      deepLinkHandledRef.current = deepLinkId;
      setDeepLinkMissing(deepLinkId);
      // Keep ?v= until the user dismisses the banner so Next's patched
      // history API cannot replace the target mid-resolution.
    }
  }, [
    deepLinkId,
    feedMode,
    isLoading,
    videos,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    scrollToVideo,
  ]);

  // Comment notifications: ?v=&c=1 opens the comments drawer after scroll
  useEffect(() => {
    if (!deepLinkId || !openCommentsFromLink) return;
    if (deepLinkHandledRef.current !== deepLinkId) return;
    if (commentsDeepLinkHandledRef.current === deepLinkId) return;

    commentsDeepLinkHandledRef.current = deepLinkId;
    setSelectedVideoId(deepLinkId);
    setCommentsOpen(true);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('c');
      const qs = url.searchParams.toString();
      window.history.replaceState(
        {},
        '',
        qs ? `${url.pathname}?${qs}` : url.pathname
      );
    }
  }, [deepLinkId, openCommentsFromLink, videos, setCommentsOpen]);

  // Re-enable active-video URL sync once the deep link landed (or failed).
  useEffect(() => {
    if (deepLinkMissing) {
      urlSyncEnabledRef.current = true;
      return;
    }
    if (
      deepLinkHandledRef.current &&
      videos[currentIndex]?.id === deepLinkHandledRef.current
    ) {
      urlSyncEnabledRef.current = true;
    }
  }, [currentIndex, videos, deepLinkMissing]);

  // Keep ?v= in sync with the active video for shareable URLs.
  // Disabled while a deep link is still being resolved (Next patches replaceState).
  useEffect(() => {
    if (!urlSyncEnabledRef.current) return;
    if (deepLinkMissing) return;
    if (deepLinkId && deepLinkHandledRef.current !== deepLinkId) return;
    const id = videos[currentIndex]?.id;
    if (!id || typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('v') === id) return;
    url.searchParams.set('v', id);
    const next = `${url.pathname}?${url.searchParams.toString()}${url.hash}`;
    window.history.replaceState(null, '', next);
  }, [currentIndex, videos, deepLinkId, deepLinkMissing]);

  // Handle scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const pageHeight = container.clientHeight || 1;
      const newIndex = Math.round(scrollTop / pageHeight);
      
      if (newIndex !== currentIndex) {
        if (newIndex > currentIndex) {
          qoeLogger.recordScrollNext();
        } else {
          qoeLogger.recordScrollPrev();
        }
        setCurrentIndex(newIndex);
      }

      // Load more when near the end
      if (
        hasNextPage &&
        !isFetchingNextPage &&
        newIndex >= videos.length - 2
      ) {
        fetchNextPage();
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [currentIndex, videos.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Toggle play/pause for current video
  const toggleCurrentVideoPlayPause = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const videoElements = container.querySelectorAll('video');
    const currentVideo = videoElements[currentIndex] as HTMLVideoElement;
    
    if (currentVideo) {
      if (currentVideo.paused) {
        currentVideo.play().catch(console.error);
      } else {
        currentVideo.pause();
      }
    }
  }, [currentIndex]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNextVideo: () => {
      scrollToVideo(currentIndex + 1);
    },
    onPrevVideo: () => {
      scrollToVideo(currentIndex - 1);
    },
    onToggleMute: () => {
      toggleMute();
    },
    onToggleCaptions: () => {
      qoeLogger.recordCaptionToggle();
      toggleCaptions();
    },
    onTogglePlayPause: () => {
      toggleCurrentVideoPlayPause();
    },
    onFocusComment: () => {
      if (!commentsOpen && videos[currentIndex]) {
        setSelectedVideoId(videos[currentIndex].id);
        setCommentsOpen(true);
      }
    },
  });

  const handleCommentClick = (videoId: string) => {
    setSelectedVideoId(videoId);
    setCommentsOpen(true);
  };

  const clearSheetQuery = useCallback(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has('sheet')) return;
    url.searchParams.delete('sheet');
    const qs = url.searchParams.toString();
    window.history.replaceState(
      null,
      '',
      qs ? `${url.pathname}?${qs}` : url.pathname || '/'
    );
  }, []);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <>
      {deepLinkMissing && (
        <div
          className="absolute left-3 right-3 top-3 z-40 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-900/95 px-3 py-2.5 text-white shadow-lg backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <div className="min-w-0 text-left">
            <p className="text-sm font-medium">Video not found</p>
            <p className="truncate text-xs text-white/50">
              This link may be old or the video was removed.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDeepLinkMissing(null);
              urlSyncEnabledRef.current = true;
              router.replace('/');
            }}
            className="shrink-0 rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium hover:bg-white/15"
          >
            OK
          </button>
        </div>
      )}

      {/* Feed Container */}
      <div
        ref={containerRef}
        className="h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
        style={{ scrollSnapType: 'y mandatory' }}
        data-testid="feed-scroll"
      >
        {videos.length === 0 ? (
          feedMode === 'following' ? (
            <FollowingEmptyState onGoForYou={() => setFeedMode('foryou')} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-black text-white px-6 text-center gap-2">
              <p className="text-lg font-semibold">No videos</p>
              <p className="text-sm text-white/60">
                Upload a video to get started.
              </p>
            </div>
          )
        ) : (
          videos.map((video, index) => (
            <VideoCard
              key={video.id}
              video={video}
              isActive={index === currentIndex}
              onCommentClick={() => handleCommentClick(video.id)}
            />
          ))
        )}

        {/* Loading indicator */}
        {isFetchingNextPage && (
          <div className="h-full flex items-center justify-center bg-black">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        )}
      </div>

      <BottomNav
        active={navActive}
        onHome={() => {
          setSheet(null);
          setFeedMode('foryou');
        }}
        onFollowing={() => {
          setSheet(null);
          setFeedMode('following');
        }}
        onCreate={() =>
          setSheet((s) => (s === 'upload' ? null : 'upload'))
        }
        onInbox={() =>
          setSheet((s) => (s === 'inbox' ? null : 'inbox'))
        }
      />
      <UploadSheet
        open={sheet === 'upload'}
        onClose={() => {
          setSheet(null);
          clearSheetQuery();
        }}
        onUploaded={(videoId) => {
          setSheet(null);
          clearSheetQuery();
          setFeedMode('foryou');
          deepLinkHandledRef.current = null;
          urlSyncEnabledRef.current = false;
          router.replace(`/?v=${encodeURIComponent(videoId)}`);
        }}
      />
      <NotificationSheet
        open={sheet === 'inbox'}
        onClose={() => {
          setSheet(null);
          clearSheetQuery();
        }}
      />

      {/* Comments Drawer */}
      {selectedVideoId && (
        <CommentsDrawer
          videoId={selectedVideoId}
          isOpen={commentsOpen}
          onClose={() => setCommentsOpen(false)}
        />
      )}

      {/* Debug Panel */}
      {debugMode && <DebugPanel onClose={() => setDebugMode(false)} />}

      {/* Keyboard Shortcuts Helper (hidden, for accessibility) */}
      <div className="sr-only">
        <h2>Keyboard Shortcuts</h2>
        <ul>
          <li>J or Arrow Down: Next video</li>
          <li>K or Arrow Up: Previous video</li>
          <li>Space: Play/Pause video</li>
          <li>M: Mute/Unmute</li>
          <li>C: Toggle captions</li>
          <li>/: Focus comments</li>
        </ul>
      </div>
    </>
  );
}

export default function FeedPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full w-full flex items-center justify-center bg-black text-white">
          Loading...
        </div>
      }
    >
      <FeedPageContent />
    </Suspense>
  );
}

