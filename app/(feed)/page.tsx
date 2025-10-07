'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { VideoCard } from '@/components/VideoCard';
import { CommentsDrawer } from '@/components/CommentsDrawer';
import { DebugPanel } from '@/components/DebugPanel';
import { useKeyboardShortcuts } from '@/lib/keyboard';
import { useUIStore } from '@/lib/store';
import { fetchVideos } from '@/lib/api';
import { useVideoPrefetch } from '@/lib/usePrefetch';
import { qoeLogger } from '@/lib/qoe';
import { useSearchParams } from 'next/navigation';

export default function FeedPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  
  const { commentsOpen, setCommentsOpen, toggleMute, toggleCaptions, debugMode, setDebugMode } = useUIStore();

  // Check for debug mode in URL
  useEffect(() => {
    const debug = searchParams.get('debug') === '1';
    setDebugMode(debug);
  }, [searchParams, setDebugMode]);

  // Fetch videos with infinite scroll
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['videos'],
    queryFn: ({ pageParam }) => fetchVideos(pageParam, 5),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
  });

  const videos = data?.pages.flatMap((page) => page.items) ?? [];

  // Prefetch adjacent videos
  useVideoPrefetch(currentIndex, videos, 2);

  // Scroll to video by index
  const scrollToVideo = useCallback((index: number) => {
    if (index < 0 || index >= videos.length) return;
    
    const container = containerRef.current;
    if (!container) return;

    const targetScroll = index * window.innerHeight;
    container.scrollTo({
      top: targetScroll,
      behavior: 'smooth',
    });

    setCurrentIndex(index);
  }, [videos.length]);

  // Handle scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const newIndex = Math.round(scrollTop / window.innerHeight);
      
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
      <div className="h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <>
      {/* Feed Container */}
      <div
        ref={containerRef}
        className="h-screen overflow-y-scroll snap-y snap-mandatory no-scrollbar"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {videos.map((video, index) => (
          <VideoCard
            key={video.id}
            video={video}
            isActive={index === currentIndex}
            onCommentClick={() => handleCommentClick(video.id)}
          />
        ))}

        {/* Loading indicator */}
        {isFetchingNextPage && (
          <div className="h-screen flex items-center justify-center bg-black">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        )}
      </div>

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

