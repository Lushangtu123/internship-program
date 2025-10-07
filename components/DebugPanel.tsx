'use client';

import { useEffect, useState } from 'react';
import { qoeLogger } from '@/lib/qoe';
import { QoEMetrics } from '@/types/qoe';
import { X } from 'lucide-react';

interface DebugPanelProps {
  onClose: () => void;
}

export function DebugPanel({ onClose }: DebugPanelProps) {
  const [metrics, setMetrics] = useState<QoEMetrics | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(qoeLogger.getMetrics());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!metrics) return null;

  return (
    <div className="fixed top-4 right-4 w-80 bg-black/90 backdrop-blur-sm text-white p-4 rounded-lg shadow-lg z-50 text-xs font-mono">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm">📊 QoE Debug Panel</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded"
          aria-label="Close debug panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-gray-400">TTFF</div>
            <div className="text-green-400 font-bold">{metrics.ttff}ms</div>
          </div>
          <div>
            <div className="text-gray-400">Stalls</div>
            <div className="text-yellow-400 font-bold">{metrics.stallCount}</div>
          </div>
          <div>
            <div className="text-gray-400">Stall Time</div>
            <div className="text-yellow-400 font-bold">{metrics.stallDurationMs}ms</div>
          </div>
          <div>
            <div className="text-gray-400">Frames Dropped</div>
            <div className="text-red-400 font-bold">{metrics.framesDropped}</div>
          </div>
        </div>

        <hr className="border-gray-700" />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-gray-400">Scroll Next</div>
            <div>{metrics.scrollNext}</div>
          </div>
          <div>
            <div className="text-gray-400">Scroll Prev</div>
            <div>{metrics.scrollPrev}</div>
          </div>
          <div>
            <div className="text-gray-400">Likes</div>
            <div>{metrics.likeTapped}</div>
          </div>
          <div>
            <div className="text-gray-400">Comments</div>
            <div>{metrics.commentOpened}</div>
          </div>
          <div>
            <div className="text-gray-400">Captions</div>
            <div>{metrics.captionToggled}</div>
          </div>
        </div>
      </div>

      <button
        onClick={() => qoeLogger.logToConsole()}
        className="mt-3 w-full py-2 bg-blue-600 hover:bg-blue-700 rounded text-xs font-semibold"
      >
        Log to Console
      </button>
    </div>
  );
}

