'use client';

import { Music2 } from 'lucide-react';
import { Music } from '@/types/video';

interface CaptionBadgeProps {
  music: Music;
}

export function CaptionBadge({ music }: CaptionBadgeProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-gray-900/50 backdrop-blur-sm max-w-xs">
      <Music2 className="w-4 h-4 text-white flex-shrink-0 animate-spin" style={{ animationDuration: '3s' }} />
      <div className="flex-1 overflow-hidden">
        <div className="text-xs text-white truncate font-medium">
          {music.title}
        </div>
        {music.artist && (
          <div className="text-[10px] text-gray-300 truncate">
            {music.artist}
          </div>
        )}
      </div>
    </div>
  );
}

