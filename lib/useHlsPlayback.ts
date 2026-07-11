'use client';

import { useEffect, RefObject } from 'react';
import Hls from 'hls.js';

function isHlsUrl(src: string) {
  return /\.m3u8(\?|$)/i.test(src);
}

/**
 * Attach HLS playback when the source is an .m3u8 playlist.
 * Uses native HLS on Safari; hls.js elsewhere. Progressive URLs are left alone.
 */
export function useHlsPlayback(
  videoRef: RefObject<HTMLVideoElement>,
  src: string
) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    if (!isHlsUrl(src)) {
      if (video.getAttribute('src') !== src) {
        video.src = src;
      }
      return;
    }

    let hls: Hls | null = null;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    } else if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
    } else {
      video.src = src;
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [videoRef, src]);
}

export { isHlsUrl };
