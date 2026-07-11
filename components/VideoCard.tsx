'use client';

import Link from 'next/link';
import { useRef, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { Video } from '@/types/video';
import { ActionsBar } from './ActionsBar';
import { CaptionBadge } from './CaptionBadge';
import { useAutoplay } from '@/lib/useAutoplay';
import { useHlsPlayback } from '@/lib/useHlsPlayback';
import { useUIStore } from '@/lib/store';
import { fetchMe, likeVideo, saveVideo, toggleFollowCreator } from '@/lib/api';import { trackComplete, trackPlay } from '@/lib/trackEngagement';
import { buildVideoDeepLink } from '@/lib/deepLink';
import { shareOutcomeMessage, shareVideoLink } from '@/lib/shareVideo';
import { cn } from '@/lib/utils';

interface VideoCardProps {
  video: Video;
  isActive: boolean;
  onCommentClick: () => void;
}

export function VideoCard({ video, isActive, onCommentClick }: VideoCardProps) {
  const queryClient = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
  });
  const isOwnVideo = Boolean(me?.id && me.id === video.creator.id);
  const videoRef = useRef<HTMLVideoElement>(null);
  const manuallyPausedRef = useRef(false); // Use ref for immediate access
  const [localLiked, setLocalLiked] = useState(video.liked || false);
  const [localLikes, setLocalLikes] = useState(video.stats.likes);
  const [localSaved, setLocalSaved] = useState(video.saved || false);
  const [localFollowing, setLocalFollowing] = useState(video.isFollowing || false);
  const [followPending, setFollowPending] = useState(false);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const [lastTap, setLastTap] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [showPauseIcon, setShowPauseIcon] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const shareToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { isMuted, showCaptions, setActiveVideoId } = useUIStore();

  useHlsPlayback(videoRef, video.src);

  useEffect(() => {
    return () => {
      if (shareToastTimer.current) clearTimeout(shareToastTimer.current);
    };
  }, []);

  useEffect(() => {
    setLocalLiked(video.liked || false);
    setLocalLikes(video.stats.likes);
    setLocalSaved(video.saved || false);
    setLocalFollowing(video.isFollowing || false);
  }, [video.id, video.liked, video.stats.likes, video.saved, video.isFollowing]);

  // Looping videos rarely fire `ended`; treat 80% watch as a complete.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onTimeUpdate = () => {
      if (el.duration > 0 && el.currentTime / el.duration >= 0.8) {
        trackComplete(video.id);
      }
    };
    el.addEventListener('timeupdate', onTimeUpdate);
    return () => el.removeEventListener('timeupdate', onTimeUpdate);
  }, [video.id]);

  // Sync mute state with video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      if (!isMuted) {
        videoRef.current.volume = 1;
      }
    }
  }, [isMuted]);

  // Use autoplay with ref-based manual pause control
  const { isInView, isPlaying } = useAutoplay(videoRef, {
    videoId: video.id,
    threshold: 0.7,
    onEnterView: () => {
      setActiveVideoId(video.id);
      manuallyPausedRef.current = false;
      trackPlay(video.id);
    },
    onLeaveView: () => {
      manuallyPausedRef.current = false;
      const el = videoRef.current;
      if (el && el.duration > 0 && el.currentTime / el.duration >= 0.8) {
        trackComplete(video.id);
      }
    },
    shouldAutoplay: () => {
      // Return false if user manually paused
      return !manuallyPausedRef.current;
    },
  });

  // Monitor video pause/play events to detect manual control
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleVideoPause = () => {
      // If video is paused while in view, treat as manual pause
      if (isInView) {
        manuallyPausedRef.current = true;
      }
    };

    video.addEventListener('pause', handleVideoPause);

    return () => {
      video.removeEventListener('pause', handleVideoPause);
    };
  }, [isInView]);

  // Continuous monitoring to enforce pause state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Enforce manual pause against autoplay races
    const intervalId = setInterval(() => {
      if (manuallyPausedRef.current && isInView && !video.paused) {
        video.pause();
      }
    }, 100);

    return () => {
      clearInterval(intervalId);
    };
  }, [isInView]);

  // Handle single tap (pause/play) and double-tap (like)
  const handleVideoTap = () => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTap;
    setLastTap(now);

    if (timeSinceLastTap < 300) {
      // Double tap detected - like
      if (!localLiked) {
        handleLike();
        setShowLikeAnimation(true);
        setTimeout(() => setShowLikeAnimation(false), 600);
      }
    } else {
      // Single tap - toggle play/pause
      setTimeout(() => {
        const timeSinceThisTap = Date.now() - now;
        if (timeSinceThisTap >= 300) {
          // No second tap came, it's a single tap
          handlePlayPause();
          // Show pause/play icon briefly
          setShowPauseIcon(true);
          setTimeout(() => setShowPauseIcon(false), 800);
        }
      }, 300);
    }
  };

  const handleLike = async () => {
    const newLiked = !localLiked;
    setLocalLiked(newLiked);
    setLocalLikes((n) => Math.max(0, n + (newLiked ? 1 : -1)));

    try {
      const result = await likeVideo(video.id);
      if (typeof result.likes === 'number') {
        setLocalLikes(result.likes);
      }
      setLocalLiked(result.liked);
    } catch (error) {
      console.error('Failed to like video:', error);
      setLocalLiked(!newLiked);
      setLocalLikes((n) => Math.max(0, n + (newLiked ? -1 : 1)));
    }
  };

  const handleSave = async () => {
    const next = !localSaved;
    setLocalSaved(next);
    try {
      const result = await saveVideo(video.id);
      setLocalSaved(result.saved);
      await queryClient.invalidateQueries({ queryKey: ['videos'] });
    } catch (error) {
      console.error('Failed to save video:', error);
      setLocalSaved(!next);
    }
  };

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (followPending || isOwnVideo) return;
    const next = !localFollowing;
    setLocalFollowing(next);
    setFollowPending(true);
    try {
      const result = await toggleFollowCreator(video.creator.id);
      setLocalFollowing(result.following);
      await queryClient.invalidateQueries({ queryKey: ['videos'] });
      await queryClient.invalidateQueries({ queryKey: ['creators', 'suggested'] });
    } catch (error) {
      console.error('Failed to toggle follow:', error);
      setLocalFollowing(!next);
    } finally {
      setFollowPending(false);
    }
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        // manuallyPausedRef is updated by the pause event listener
      } else {
        manuallyPausedRef.current = false;
        videoRef.current.play();
      }
    }
  };

  const handleShare = async () => {
    const url = buildVideoDeepLink(
      window.location.origin,
      video.id,
      window.location.search
    );
    const outcome = await shareVideoLink({
      url,
      title: video.caption,
      text: `Check out this video by ${video.creator.handle}`,
    });
    const message = shareOutcomeMessage(outcome);
    if (!message) return;
    if (shareToastTimer.current) clearTimeout(shareToastTimer.current);
    setShareMessage(message);
    shareToastTimer.current = setTimeout(() => setShareMessage(null), 1800);
  };

  const toggleMute = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    useUIStore.getState().toggleMute();
  };

  return (
    <div
      className="video-container relative bg-black"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        poster={video.poster}
        className="w-full h-full object-cover cursor-pointer"
        loop
        playsInline
        muted={isMuted}
        onClick={handleVideoTap}
      >
        {video.captionsVtt && showCaptions && (
          <track
            kind="captions"
            src={video.captionsVtt}
            srcLang="en"
            label="English"
            default
          />
        )}
      </video>

      {/* Like Animation Overlay */}
      {showLikeAnimation && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="like-animation">
            <div className="w-24 h-24 text-white opacity-80">
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-full h-full"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Pause/Play Icon Feedback */}
      {showPauseIcon && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="animate-fade-scale">
            <div className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              {isPlaying ? (
                <Pause className="w-10 h-10 text-white" fill="white" />
              ) : (
                <Play className="w-10 h-10 text-white ml-1" fill="white" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Play/Pause Control (center) */}
      {showControls && !isPlaying && (
        <button
          onClick={handlePlayPause}
          className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity"
          aria-label="Play"
        >
          <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Play className="w-10 h-10 text-white ml-1" />
          </div>
        </button>
      )}

      {/* Top Controls — reserved; more menu removed until actions exist */}
      <div
        className={cn(
          'absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/40 to-transparent transition-opacity pointer-events-none',
          showControls ? 'opacity-100' : 'opacity-0'
        )}
      />

      {/* Bottom Overlay: Creator Info & Actions */}
      <div className="absolute bottom-14 left-0 right-0 p-4 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
        <div className="flex items-end justify-between gap-4">
          {/* Left: Creator & Caption */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Creator Info */}
            <div className="flex items-center gap-2">
              <Link
                href={`/creator/${video.creator.id}`}
                onClick={(e) => e.stopPropagation()}
                className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden flex-shrink-0"
                aria-label={`Open ${video.creator.handle} profile`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={video.creator.avatar}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </Link>
              <div className="flex items-center gap-2 min-w-0">
                <Link
                  href={`/creator/${video.creator.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-semibold text-white truncate hover:underline"
                >
                  {video.creator.handle}
                </Link>
                {!isOwnVideo && (
                  <button
                    type="button"
                    onClick={handleFollow}
                    disabled={followPending}
                    className={cn(
                      'px-4 py-1 rounded-md text-sm font-semibold flex-shrink-0 disabled:opacity-60',
                      localFollowing
                        ? 'bg-white/20 text-white hover:bg-white/30'
                        : 'bg-primary hover:bg-primary/90 text-white'
                    )}
                  >
                    {localFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            </div>

            {/* Caption */}
            <p className="text-white text-sm line-clamp-2">{video.caption}</p>

            {/* Music Badge */}
            <CaptionBadge music={video.music} />
          </div>

          {/* Right: Actions Bar */}
          <div className="flex-shrink-0 mb-2">
            <ActionsBar
              stats={{ ...video.stats, likes: localLikes }}
              liked={localLiked}
              saved={localSaved}
              onLike={handleLike}
              onSave={handleSave}
              onComment={onCommentClick}
              onShare={handleShare}
            />
          </div>
        </div>
      </div>

      {/* Mute — kept subtle, above the action column */}
      <button
        onClick={(e) => toggleMute(e)}
        className="absolute bottom-32 right-4 p-2.5 rounded-full bg-black/35 backdrop-blur-sm hover:bg-black/50 z-20"
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? (
          <VolumeX className="w-4 h-4 text-white/90" />
        ) : (
          <Volume2 className="w-4 h-4 text-white/90" />
        )}
      </button>

      {shareMessage && (
        <div
          className="pointer-events-none absolute bottom-36 left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          {shareMessage}
        </div>
      )}
    </div>
  );
}

