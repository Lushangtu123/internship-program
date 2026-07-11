import { useEffect, useRef, useState, RefObject, useCallback } from 'react';
import { qoeLogger } from './qoe';

interface UseAutoplayOptions {
  videoId: string;
  threshold?: number;
  onEnterView?: () => void;
  onLeaveView?: () => void;
  shouldAutoplay?: () => boolean;
}

export function useAutoplay(
  videoRef: RefObject<HTMLVideoElement>,
  options: UseAutoplayOptions
) {
  const { videoId, threshold = 0.7, onEnterView, onLeaveView, shouldAutoplay } = options;
  const [isInView, setIsInView] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const ttffStartRef = useRef<number | null>(null);
  
  // 使用 ref 存储 shouldAutoplay 函数，避免重新创建 observer
  const shouldAutoplayRef = useRef(shouldAutoplay);
  useEffect(() => {
    shouldAutoplayRef.current = shouldAutoplay;
  }, [shouldAutoplay]);

  // 使用 ref 存储回调函数
  const onEnterViewRef = useRef(onEnterView);
  const onLeaveViewRef = useRef(onLeaveView);
  useEffect(() => {
    onEnterViewRef.current = onEnterView;
    onLeaveViewRef.current = onLeaveView;
  }, [onEnterView, onLeaveView]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const wasInViewRef = { current: false };
    const hasInitializedRef = { current: false };
    const checkTimeoutRef = { current: null as NodeJS.Timeout | null };
    const debounceTimeoutRef = { current: null as NodeJS.Timeout | null };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const inView = entry.isIntersecting && entry.intersectionRatio >= threshold;
          
          // 只在状态真正改变时处理
          if (inView === wasInViewRef.current) {
            return;
          }
          
          // 清除之前的防抖
          if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
          }
          
          // 防抖：等待 150ms 确保状态稳定
          debounceTimeoutRef.current = setTimeout(() => {
            // 再次检查状态是否真的改变了
            if (inView === wasInViewRef.current) {
              return;
            }
            
            wasInViewRef.current = inView;
            setIsInView(inView);

            // 清除之前的检查
            if (checkTimeoutRef.current) {
              clearTimeout(checkTimeoutRef.current);
              checkTimeoutRef.current = null;
            }

          if (inView) {
            // Start TTFF tracking
            if (!hasInitializedRef.current) {
              ttffStartRef.current = Date.now();
              qoeLogger.startVideo(videoId);
              hasInitializedRef.current = true;
            }
            onEnterViewRef.current?.();
            
            // 使用 setTimeout 延迟检查，让其他事件处理器先执行
            checkTimeoutRef.current = setTimeout(() => {
              // 使用 ref 中的最新函数
              const canAutoplay = shouldAutoplayRef.current ? shouldAutoplayRef.current() : true;
              const isPaused = video.paused;
              
              if (canAutoplay && isPaused) {
                video.play().catch((err) => {
                  console.error('Autoplay failed:', err);
                });
              }
              
              checkTimeoutRef.current = null;
            }, 100);
          } else {
            // Video left view
            hasInitializedRef.current = false;
            onLeaveViewRef.current?.();
            video.pause();
            qoeLogger.endVideo(videoId, false);
          }
          }, 150); // 防抖延迟
        });
      },
      {
        threshold: [threshold],
        rootMargin: '50px', // 增加 50px 缓冲区，减少边缘抖动
      }
    );

    observer.observe(video);

    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      observer.disconnect();
    };
  }, [videoId, videoRef, threshold]); // 移除了会变化的函数依赖

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      setIsPlaying(true);
      
      // Record TTFF if we haven't yet
      if (ttffStartRef.current) {
        const ttff = Date.now() - ttffStartRef.current;
        qoeLogger.recordTTFF(videoId, ttff);
        ttffStartRef.current = null;
      }
    };

    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      qoeLogger.endVideo(videoId, true);
    };

    // Track stalls
    const handleWaiting = () => {
      ttffStartRef.current = Date.now();
    };

    const handleCanPlay = () => {
      if (ttffStartRef.current) {
        const stallDuration = Date.now() - ttffStartRef.current;
        qoeLogger.recordStall(videoId, stallDuration);
        ttffStartRef.current = null;
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [videoId, videoRef]);

  return { isInView, isPlaying };
}