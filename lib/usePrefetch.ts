import { useEffect } from 'react';

export function usePrefetch(sources: string[]) {
  useEffect(() => {
    sources.forEach((src) => {
      if (!src) return;

      // Create a prefetch link element
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'video';
      link.href = src;
      document.head.appendChild(link);

      // Cleanup
      return () => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      };
    });
  }, [sources]);
}

export function useVideoPrefetch(
  currentIndex: number,
  videos: Array<{ src: string }>,
  prefetchCount = 2
) {
  useEffect(() => {
    // Prefetch next videos
    const nextVideos = videos
      .slice(currentIndex + 1, currentIndex + 1 + prefetchCount)
      .map(v => v.src);

    // Prefetch previous video
    const prevVideo = currentIndex > 0 ? videos[currentIndex - 1]?.src : null;

    const toPrefetch = [...nextVideos, ...(prevVideo ? [prevVideo] : [])];

    toPrefetch.forEach((src) => {
      if (!src) return;

      // Create a video element for prefetch
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = src;
    });
  }, [currentIndex, videos, prefetchCount]);
}

