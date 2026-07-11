'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { fetchCreatorProfile, fetchMe, toggleFollowCreator } from '@/lib/api';
import { formatNumber } from '@/lib/utils';

export default function CreatorProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const creatorId = params.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ['creator', creatorId],
    queryFn: () => fetchCreatorProfile(creatorId),
    enabled: !!creatorId,
  });

  const { data: me } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
  });

  const [followPending, setFollowPending] = useState(false);
  const [following, setFollowing] = useState<boolean | null>(null);

  const isFollowing = following ?? data?.isFollowing ?? false;
  const isSelf = Boolean(me?.id && data?.creator.id === me.id);

  const onFollow = async () => {
    if (!data || followPending) return;
    const next = !isFollowing;
    setFollowing(next);
    setFollowPending(true);
    try {
      const result = await toggleFollowCreator(data.creator.id);
      setFollowing(result.following);
      await queryClient.invalidateQueries({ queryKey: ['creator', creatorId] });
      await queryClient.invalidateQueries({ queryKey: ['videos'] });
    } catch (err) {
      console.error(err);
      setFollowing(!next);
    } finally {
      setFollowPending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-3">
        <p>Creator not found</p>
        <button
          type="button"
          className="rounded-full bg-white px-4 py-2 text-sm text-black"
          onClick={() => router.push('/')}
        >
          Back to feed
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-zinc-950/90 px-4 py-3 backdrop-blur">
        <Link
          href="/"
          className="rounded-full p-2 hover:bg-white/10"
          aria-label="Back to feed"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <p className="truncate font-semibold">{data.creator.handle}</p>
          <p className="text-xs text-white/50">
            {formatNumber(data.stats.videos)} videos
          </p>
        </div>
      </header>

      <section className="px-4 py-6">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.creator.avatar}
            alt=""
            className="h-20 w-20 rounded-full object-cover bg-zinc-800"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold">{data.creator.handle}</h1>
            {data.creator.name && (
              <p className="text-sm text-white/60">{data.creator.name}</p>
            )}
            <div className="mt-3 flex gap-4 text-sm">
              <div>
                <span className="font-semibold">
                  {formatNumber(data.stats.followers)}
                </span>{' '}
                <span className="text-white/50">Followers</span>
              </div>
              <div>
                <span className="font-semibold">
                  {formatNumber(data.stats.likes)}
                </span>{' '}
                <span className="text-white/50">Likes</span>
              </div>
              <div>
                <span className="font-semibold">
                  {formatNumber(data.stats.videos)}
                </span>{' '}
                <span className="text-white/50">Videos</span>
              </div>
            </div>
          </div>
        </div>

        {!isSelf && (
          <button
            type="button"
            onClick={onFollow}
            disabled={followPending}
            className={`mt-5 w-full rounded-md py-2.5 text-sm font-semibold disabled:opacity-60 ${
              isFollowing
                ? 'bg-white/15 text-white hover:bg-white/25'
                : 'bg-white text-black hover:bg-white/90'
            }`}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        )}
        {isSelf && (
          <p className="mt-5 text-center text-sm text-white/50">This is you</p>
        )}
      </section>

      <section className="border-t border-white/10 px-2 py-3">
        {data.videos.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-white/50">
            No videos yet
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {data.videos.map((video) => (
              <Link
                key={video.id}
                href={`/?v=${video.id}`}
                className="relative aspect-[9/16] overflow-hidden bg-zinc-900"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={video.poster}
                  alt={video.caption}
                  className="h-full w-full object-cover"
                />
                <span className="absolute bottom-1 left-1 text-[10px] font-medium text-white drop-shadow">
                  {formatNumber(video.stats.likes)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
