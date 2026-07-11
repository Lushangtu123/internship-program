'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import {
  fetchCreatorProfile,
  fetchMe,
  fetchVideos,
  toggleFollowCreator,
} from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import type { Video } from '@/types/video';
import { BottomNav } from '@/components/BottomNav';
import { ProfileAuthPanel } from '@/components/ProfileAuthPanel';
import { UploadSheet } from '@/components/UploadSheet';
import { NotificationSheet } from '@/components/NotificationSheet';

type ProfileTab = 'videos' | 'saved';

function VideoGrid({
  videos,
  emptyText,
}: {
  videos: Video[];
  emptyText: string;
}) {
  if (videos.length === 0) {
    return (
      <p className="px-2 py-8 text-center text-sm text-white/50">{emptyText}</p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1">
      {videos.map((video) => (
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
  );
}

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
  const [tab, setTab] = useState<ProfileTab>('videos');
  const [sheet, setSheet] = useState<'upload' | 'inbox' | null>(null);

  const isFollowing = following ?? data?.isFollowing ?? false;
  const isSelf = Boolean(me?.id && data?.creator.id === me.id);

  const { data: savedData, isLoading: savedLoading } = useQuery({
    queryKey: ['videos', 'saved'],
    queryFn: () => fetchVideos(null, 50, 'saved'),
    enabled: isSelf && tab === 'saved',
  });

  const onFollow = async () => {
    if (!data || followPending || isSelf) return;
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
    <div className="relative min-h-[100dvh] bg-zinc-950 text-white pb-20">
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
        {isSelf && me && <ProfileAuthPanel user={me} />}
      </section>

      {isSelf && (
        <div className="flex border-t border-white/10">
          <button
            type="button"
            onClick={() => setTab('videos')}
            className={`flex-1 py-3 text-sm font-semibold ${
              tab === 'videos'
                ? 'border-b-2 border-white text-white'
                : 'text-white/50'
            }`}
          >
            Videos
          </button>
          <button
            type="button"
            onClick={() => setTab('saved')}
            className={`flex-1 py-3 text-sm font-semibold ${
              tab === 'saved'
                ? 'border-b-2 border-white text-white'
                : 'text-white/50'
            }`}
          >
            Saved
          </button>
        </div>
      )}

      <section className={`px-2 py-3 ${isSelf ? '' : 'border-t border-white/10'}`}>
        {!isSelf || tab === 'videos' ? (
          <VideoGrid
            videos={data.videos}
            emptyText="No videos yet"
          />
        ) : savedLoading ? (
          <p className="px-2 py-8 text-center text-sm text-white/50">
            Loading…
          </p>
        ) : (
          <VideoGrid
            videos={savedData?.items ?? []}
            emptyText="No saved videos yet. Tap the bookmark on a video to save it here."
          />
        )}
      </section>

      <BottomNav
        active={sheet === 'inbox' ? 'inbox' : sheet === 'upload' ? 'create' : 'me'}
        onHome={() => router.push('/')}
        onFollowing={() => router.push('/?feed=following')}
        onCreate={() =>
          setSheet((s) => (s === 'upload' ? null : 'upload'))
        }
        onInbox={() =>
          setSheet((s) => (s === 'inbox' ? null : 'inbox'))
        }
      />
      <UploadSheet
        open={sheet === 'upload'}
        onClose={() => setSheet(null)}
        onUploaded={(videoId) => {
          setSheet(null);
          router.push(`/?v=${encodeURIComponent(videoId)}`);
        }}
      />
      <NotificationSheet
        open={sheet === 'inbox'}
        onClose={() => setSheet(null)}
      />
    </div>
  );
}
