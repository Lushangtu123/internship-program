'use client';

import { useEffect, useState } from 'react';
import { VolumeX } from 'lucide-react';
import { hasSeenMuteTip, markMuteTipSeen } from '@/lib/muteTip';
import { useUIStore } from '@/lib/store';

interface MuteGestureTipProps {
  /** Only show on the active (in-view) video card */
  visible: boolean;
}

/**
 * One-shot coach for default-muted autoplay: tap to unmute.
 * Dismisses permanently after unmute or explicit dismiss.
 */
export function MuteGestureTip({ visible }: MuteGestureTipProps) {
  const isMuted = useUIStore((s) => s.isMuted);
  const setMuted = useUIStore((s) => s.setMuted);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(hasSeenMuteTip());
  }, []);

  useEffect(() => {
    if (dismissed || isMuted) return;
    markMuteTipSeen();
    setDismissed(true);
  }, [isMuted, dismissed]);

  if (!visible || dismissed || !isMuted) return null;

  const dismissAndUnmute = () => {
    markMuteTipSeen();
    setDismissed(true);
    setMuted(false);
  };

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        dismissAndUnmute();
      }}
      className="pointer-events-auto absolute inset-x-0 top-[38%] z-30 flex justify-center px-6"
      aria-label="Tap for sound"
    >
      <span className="flex items-center gap-2 rounded-full bg-black/55 px-4 py-2.5 text-sm font-medium text-white/95 backdrop-blur-sm ring-1 ring-white/15 motion-safe:animate-pulse">
        <VolumeX className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        Tap for sound
      </span>
    </button>
  );
}
