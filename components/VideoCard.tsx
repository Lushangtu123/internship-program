'use client';

import { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, MoreVertical } from 'lucide-react';
import { Video } from '@/types/video';
import { ActionsBar } from './ActionsBar';
import { CaptionBadge } from './CaptionBadge';
import { useAutoplay } from '@/lib/useAutoplay';
import { useUIStore } from '@/lib/store';
import { likeVideo } from '@/lib/api';
import { cn } from '@/lib/utils';

interface VideoCardProps {
  video: Video;
  isActive: boolean;
  onCommentClick: () => void;
}

export function VideoCard({ video, isActive, onCommentClick }: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const manuallyPausedRef = useRef(false); // Use ref for immediate access
  const [localLiked, setLocalLiked] = useState(video.liked || false);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const [lastTap, setLastTap] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [showPauseIcon, setShowPauseIcon] = useState(false);
  
  const { isMuted, showCaptions, setActiveVideoId } = useUIStore();

  // Sync mute state with video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Use autoplay with ref-based manual pause control
  const { isInView, isPlaying } = useAutoplay(videoRef, {
    videoId: video.id,
    threshold: 0.7,
    onEnterView: () => {
      setActiveVideoId(video.id);
      // Reset manually paused state when entering a new video
      manuallyPausedRef.current = false;
    },
    onLeaveView: () => {
      // Reset manually paused state when leaving the video
      manuallyPausedRef.current = false;
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
      // If video is paused while in view, it's likely manual
      if (isInView) {
        manuallyPausedRef.current = true;
        console.log('🔴 Manual pause detected, ref set to true');
      }
    };

    const handleVideoPlay = () => {
      // When video plays, check if it's allowed
      if (manuallyPausedRef.current && isInView) {
        console.log('🚫 Play detected but user manually paused - will force pause');
        // Don't pause here, let the monitoring interval handle it
      } else {
        console.log('🟢 Play detected, ref is', manuallyPausedRef.current);
      }
    };

    video.addEventListener('pause', handleVideoPause);
    video.addEventListener('play', handleVideoPlay);

    return () => {
      video.removeEventListener('pause', handleVideoPause);
      video.removeEventListener('play', handleVideoPlay);
    };
  }, [isInView]);

  // Continuous monitoring to enforce pause state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Check every 100ms if video state is correct
    const intervalId = setInterval(() => {
      if (manuallyPausedRef.current && isInView && !video.paused) {
        console.log('🛑 ENFORCING PAUSE - video playing but should be paused');
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

    try {
      await likeVideo(video.id);
    } catch (error) {
      // Rollback on error
      console.error('Failed to like video:', error);
      setLocalLiked(!newLiked);
    }
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        console.log('👆 User clicked to pause');
        videoRef.current.pause();
        // manuallyPaused state will be updated by event listener
      } else {
        console.log('👆 User clicked to play - clearing manual pause flag');
        manuallyPausedRef.current = false; // Clear flag before playing
        videoRef.current.play();
      }
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: video.caption,
        text: `Check out this video by ${video.creator.handle}`,
        url: window.location.href,
      }).catch(console.error);
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const toggleMute = () => {
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
        src={video.src}
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

      {/* Top Controls */}
      <div
        className={cn(
          'absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/50 to-transparent transition-opacity',
          showControls ? 'opacity-100' : 'opacity-0'
        )}
      >
        <button
          className="ml-auto block p-2 rounded-full bg-gray-800/50 backdrop-blur-sm hover:bg-gray-700/50"
          aria-label="More options"
        >
          <MoreVertical className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Bottom Overlay: Creator Info & Actions */}
      <div className="absolute bottom-0 left-0 right-0 p-4 pb-safe bg-gradient-to-t from-black/70 via-black/30 to-transparent">
        <div className="flex items-end justify-between gap-4">
          {/* Left: Creator & Caption */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Creator Info */}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden flex-shrink-0">
                {/* Avatar placeholder */}
                <div className="w-full h-full bg-gradient-to-br from-purple-400 to-pink-400" />
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-white truncate">
                  {video.creator.handle}
                </span>
                <button className="px-4 py-1 rounded-md bg-primary hover:bg-primary/90 text-white text-sm font-semibold flex-shrink-0">
                  Follow
                </button>
              </div>
            </div>

            {/* Caption */}
            <p className="text-white text-sm line-clamp-2">{video.caption}</p>

            {/* Music Badge */}
            <CaptionBadge music={video.music} />
          </div>

          {/* Right: Actions Bar */}
          <div className="flex-shrink-0">
            <ActionsBar
              stats={video.stats}
              liked={localLiked}
              onLike={handleLike}
              onComment={onCommentClick}
              onShare={handleShare}
            />
          </div>
        </div>
      </div>

      {/* Bottom Right: Mute Control */}
      <button
        onClick={toggleMute}
        className="absolute bottom-20 right-4 p-3 rounded-full bg-gray-800/50 backdrop-blur-sm hover:bg-gray-700/50"
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? (
          <VolumeX className="w-5 h-5 text-white" />
        ) : (
          <Volume2 className="w-5 h-5 text-white" />
        )}
      </button>
    </div>
  );
}

