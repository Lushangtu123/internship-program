'use client';

import { useEffect, useRef } from 'react';
import {
  fetchVideoPackagingStatus,
  type VideoPackagingStatus,
} from '@/lib/api';
import type { Video } from '@/types/video';

type PackagingFields = Pick<Video, 'id' | 'status'>;

/**
 * Poll packaging status while a video is still processing.
 * Calls onUpdate when status/src changes; stops on ready/failed.
 */
export function useVideoPackagingPoll(
  video: PackagingFields,
  enabled: boolean,
  onUpdate: (status: VideoPackagingStatus) => void,
  intervalMs = 3_000
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!enabled || video.status !== 'processing') return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const next = await fetchVideoPackagingStatus(video.id);
        if (cancelled) return;
        onUpdateRef.current(next);
        if (next.status === 'processing') {
          timer = setTimeout(() => {
            void tick();
          }, intervalMs);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          timer = setTimeout(() => {
            void tick();
          }, intervalMs * 2);
        }
      }
    };

    timer = setTimeout(() => {
      void tick();
    }, intervalMs);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, video.id, video.status, intervalMs]);
}

/** Playback URL while packaging: prefer progressive file until HLS is ready. */
export function playbackSrcForVideo(video: Pick<Video, 'src' | 'status' | 'progressiveSrc'>) {
  if (video.status === 'processing' && video.progressiveSrc) {
    return video.progressiveSrc;
  }
  return video.src;
}
