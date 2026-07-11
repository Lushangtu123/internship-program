'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchMe,
  fetchSuggestedCreators,
  toggleFollowCreator,
  type SuggestedCreator,
} from '@/lib/api';

interface FollowingEmptyStateProps {
  onGoForYou: () => void;
}

function SuggestionRow({
  creator,
  onFollowed,
}: {
  creator: SuggestedCreator;
  onFollowed: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [following, setFollowing] = useState(creator.isFollowing);

  const onFollow = async () => {
    if (pending || following) return;
    setPending(true);
    setFollowing(true);
    try {
      const result = await toggleFollowCreator(creator.id);
      setFollowing(result.following);
      if (result.following) onFollowed();
    } catch (err) {
      console.error(err);
      setFollowing(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <li className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5 text-left">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={creator.avatar}
        alt=""
        className="h-11 w-11 flex-shrink-0 rounded-full object-cover bg-zinc-700"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{creator.handle}</p>
        <p className="text-xs text-white/50">
          {creator.videoCount} video{creator.videoCount === 1 ? '' : 's'}
        </p>
      </div>
      <button
        type="button"
        onClick={onFollow}
        disabled={pending || following}
        className={`rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-60 ${
          following
            ? 'bg-white/15 text-white'
            : 'bg-white text-black hover:bg-white/90'
        }`}
      >
        {following ? 'Following' : 'Follow'}
      </button>
    </li>
  );
}

export function FollowingEmptyState({ onGoForYou }: FollowingEmptyStateProps) {
  const queryClient = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
  });
  const { data, isLoading } = useQuery({
    queryKey: ['creators', 'suggested'],
    queryFn: () => fetchSuggestedCreators(6),
  });

  const suggestions = data ?? [];
  const isGuest = me?.isGuest ?? true;
  const meHref = me ? `/creator/${me.id}` : '/';

  const refreshFeeds = async () => {
    await queryClient.invalidateQueries({ queryKey: ['videos'] });
    await queryClient.invalidateQueries({ queryKey: ['creators', 'suggested'] });
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-black text-white px-6 text-center gap-4">
      <div className="space-y-1">
        <p className="text-lg font-semibold">No following videos yet</p>
        <p className="text-sm text-white/60">
          {isGuest
            ? 'Sign in so follows stick across sessions, then follow creators below.'
            : 'Follow a few creators to fill this tab.'}
        </p>
      </div>

      {isGuest && (
        <Link
          href={meHref}
          className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
        >
          Sign in on Me
        </Link>
      )}

      {isLoading ? (
        <p className="text-sm text-white/40">Loading suggestions…</p>
      ) : suggestions.length > 0 ? (
        <ul className="w-full max-w-sm space-y-2">
          {suggestions.map((creator) => (
            <SuggestionRow
              key={creator.id}
              creator={creator}
              onFollowed={refreshFeeds}
            />
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={onGoForYou}
        className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium hover:bg-white/25"
      >
        Browse For You
      </button>
    </div>
  );
}
