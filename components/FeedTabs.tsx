'use client';

type FeedMode = 'foryou' | 'following' | 'saved';

interface FeedTabsProps {
  mode: FeedMode;
  onChange: (mode: FeedMode) => void;
}

export function FeedTabs({ mode, onChange }: FeedTabsProps) {
  return (
    <div className="absolute top-4 left-1/2 z-30 -translate-x-1/2 flex items-center gap-3 rounded-full bg-black/45 px-4 py-1.5 text-sm backdrop-blur-sm">
      <button
        type="button"
        onClick={() => onChange('foryou')}
        className={
          mode === 'foryou'
            ? 'font-semibold text-white'
            : 'text-white/60 hover:text-white'
        }
      >
        For You
      </button>
      <span className="text-white/30">|</span>
      <button
        type="button"
        onClick={() => onChange('following')}
        className={
          mode === 'following'
            ? 'font-semibold text-white'
            : 'text-white/60 hover:text-white'
        }
      >
        Following
      </button>
      <span className="text-white/30">|</span>
      <button
        type="button"
        onClick={() => onChange('saved')}
        className={
          mode === 'saved'
            ? 'font-semibold text-white'
            : 'text-white/60 hover:text-white'
        }
      >
        Saved
      </button>
    </div>
  );
}
