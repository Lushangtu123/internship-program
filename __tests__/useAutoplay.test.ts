import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutoplay } from '@/lib/useAutoplay';
import { createRef } from 'react';

const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();
const mockIntersectionObserver = vi.fn(function () {
  return {
    observe: mockObserve,
    unobserve: mockUnobserve,
    disconnect: mockDisconnect,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  window.IntersectionObserver = mockIntersectionObserver as unknown as typeof IntersectionObserver;
});

describe('useAutoplay', () => {
  it('should initialize with default values', () => {
    const ref = createRef<HTMLVideoElement>();
    const { result } = renderHook(() =>
      useAutoplay(ref, { videoId: 'test-video' })
    );

    expect(result.current.isInView).toBe(false);
    expect(result.current.isPlaying).toBe(false);
  });

  it('should use custom threshold when video element is present', () => {
    const video = document.createElement('video');
    const ref = { current: video };

    renderHook(() => useAutoplay(ref, { videoId: 'test-video', threshold: 0.5 }));

    expect(mockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        threshold: [0.5],
      })
    );
    expect(mockObserve).toHaveBeenCalledWith(video);
  });
});
