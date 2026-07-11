'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import type { FeedMode } from '@/lib/deepLink';
import { cn } from '@/lib/utils';

interface FeedTabsProps {
  mode: FeedMode;
  onChange: (mode: FeedMode) => void;
}

export function FeedTabs({ mode, onChange }: FeedTabsProps) {
  return (
    <div className="pointer-events-none absolute left-0 right-0 top-0 z-30 flex items-start justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <Link
        href="/search"
        className="pointer-events-auto rounded-full bg-black/35 p-2 text-white backdrop-blur-sm hover:bg-black/50"
        aria-label="Search"
      >
        <Search className="h-4 w-4" />
      </Link>

      <div
        className="pointer-events-auto flex items-end gap-5"
        role="tablist"
        aria-label="Feed"
      >
        {(
          [
            { id: 'following' as const, label: 'Following' },
            { id: 'foryou' as const, label: 'For You' },
          ] as const
        ).map((tab) => {
          const active = mode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={cn(
                'relative pb-1 text-[15px] font-semibold tracking-wide transition-colors',
                active ? 'text-white' : 'text-white/55 hover:text-white/80'
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-white transition-opacity',
                  active ? 'opacity-100' : 'opacity-0'
                )}
              />
            </button>
          );
        })}
      </div>

      {/* Balance the search button so tabs stay centered */}
      <span className="inline-block w-8" aria-hidden />
    </div>
  );
}
