import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutoplay } from '@/lib/useAutoplay';
import { useRef } from 'react';

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.IntersectionObserver = mockIntersectionObserver as any;

describe('useAutoplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLVideoElement>(null);
      return useAutoplay(ref, { videoId: 'test-video' });
    });

    expect(result.current.isInView).toBe(false);
    expect(result.current.isPlaying).toBe(false);
  });

  it('should use custom threshold', () => {
    renderHook(() => {
      const ref = useRef<HTMLVideoElement>(null);
      return useAutoplay(ref, { videoId: 'test-video', threshold: 0.5 });
    });

    expect(mockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        threshold: [0.5],
      })
    );
  });
});

