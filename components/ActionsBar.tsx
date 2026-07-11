'use client';

import { Heart, MessageCircle, Share2, Bookmark } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import { VideoStats } from '@/types/video';
import { qoeLogger } from '@/lib/qoe';

interface ActionsBarProps {
  stats: VideoStats;
  liked?: boolean;
  saved?: boolean;
  onLike: () => void;
  onSave: () => void;
  onComment: () => void;
  onShare: () => void;
}

export function ActionsBar({
  stats,
  liked = false,
  saved = false,
  onLike,
  onSave,
  onComment,
  onShare,
}: ActionsBarProps) {
  const handleLike = () => {
    qoeLogger.recordLikeTap();
    onLike();
  };

  const handleComment = () => {
    qoeLogger.recordCommentOpen();
    onComment();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Like Button */}
      <button
        onClick={handleLike}
        className="flex flex-col items-center gap-1 group"
        aria-label={liked ? 'Unlike' : 'Like'}
      >
        <div className="w-12 h-12 rounded-full bg-gray-800/50 backdrop-blur-sm flex items-center justify-center group-hover:bg-gray-700/50 transition-colors">
          <Heart
            className={`w-6 h-6 transition-all ${
              liked
                ? 'fill-red-500 text-red-500 scale-110'
                : 'text-white group-hover:scale-110'
            }`}
          />
        </div>
        <span className="text-xs text-white font-semibold">
          {formatNumber(stats.likes)}
        </span>
      </button>

      {/* Comment Button */}
      <button
        onClick={handleComment}
        className="flex flex-col items-center gap-1 group"
        aria-label="Comment"
      >
        <div className="w-12 h-12 rounded-full bg-gray-800/50 backdrop-blur-sm flex items-center justify-center group-hover:bg-gray-700/50 transition-colors">
          <MessageCircle className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
        </div>
        <span className="text-xs text-white font-semibold">
          {formatNumber(stats.comments)}
        </span>
      </button>

      {/* Share Button */}
      <button
        onClick={onShare}
        className="flex flex-col items-center gap-1 group"
        aria-label="Share"
      >
        <div className="w-12 h-12 rounded-full bg-gray-800/50 backdrop-blur-sm flex items-center justify-center group-hover:bg-gray-700/50 transition-colors">
          <Share2 className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
        </div>
        <span className="text-xs text-white font-semibold">
          {formatNumber(stats.shares)}
        </span>
      </button>

      {/* Save Button */}
      <button
        onClick={onSave}
        className="flex flex-col items-center gap-1 group"
        aria-label={saved ? 'Unsave' : 'Save'}
      >
        <div className="w-12 h-12 rounded-full bg-gray-800/50 backdrop-blur-sm flex items-center justify-center group-hover:bg-gray-700/50 transition-colors">
          <Bookmark
            className={`w-6 h-6 transition-all ${
              saved
                ? 'fill-yellow-400 text-yellow-400 scale-110'
                : 'text-white group-hover:scale-110'
            }`}
          />
        </div>
      </button>
    </div>
  );
}
