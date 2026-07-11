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
import { findVideoIndex } from '@/lib/deepLink';
import { useSearchParams } from 'next/navigation';

function FeedPageContent() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [feedMode, setFeedMode] = useState<'foryou' | 'following'>('foryou');
  const [sheet, setSheet] = useState<'upload' | 'inbox' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const deepLinkHandledRef = useRef<string | null>(null);
  const commentsDeepLinkHandledRef = useRef<string | null>(null);
  const searchParams = useSearchParams();
  const deepLinkId = searchParams.get('v');
  const openCommentsFromLink = searchParams.get('c') === '1';

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

  // Inbox / share deep links land on For You and close sheets
  useEffect(() => {
    if (!deepLinkId) return;
    setFeedMode('foryou');
    setSheet(null);
  }, [deepLinkId]);

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

  // Deep link: load pages until ?v= is found, then jump
  useEffect(() => {
    if (!deepLinkId || feedMode !== 'foryou' || isLoading) return;
    if (deepLinkHandledRef.current === deepLinkId) return;

    const index = findVideoIndex(videos, deepLinkId);
    if (index >= 0) {
      deepLinkHandledRef.current = deepLinkId;
      scrollToVideo(index, 'auto');
      return;
    }

    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
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

  // Keep ?v= in sync with the active video for shareable URLs
  useEffect(() => {
    const id = videos[currentIndex]?.id;
    if (!id || typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('v') === id) return;
    url.searchParams.set('v', id);
    const next = `${url.pathname}?${url.searchParams.toString()}${url.hash}`;
    window.history.replaceState(null, '', next);
  }, [currentIndex, videos]);

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

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <>
      {/* Feed Container */}
      <div
        ref={containerRef}
        className="h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
        style={{ scrollSnapType: 'y mandatory' }}
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
      <UploadSheet open={sheet === 'upload'} onClose={() => setSheet(null)} />
      <NotificationSheet
        open={sheet === 'inbox'}
        onClose={() => setSheet(null)}
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

