'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Search } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { UploadSheet } from '@/components/UploadSheet';
import { searchCatalog } from '@/lib/api';
import { formatNumber } from '@/lib/utils';

export default function SearchPage() {
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data, isFetching, isFetched } = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchCatalog(query),
    enabled: query.trim().length > 0,
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setQuery(draft.trim());
  };

  const creators = data?.creators ?? [];
  const videos = data?.videos ?? [];
  const empty =
    isFetched && query.trim().length > 0 && creators.length === 0 && videos.length === 0;

  return (
    <div className="relative flex h-full flex-col bg-zinc-950 text-white">
      <header className="flex-shrink-0 border-b border-white/10 px-3 py-3">
        <div className="mb-3 flex items-center gap-2">
          <Link
            href="/"
            className="rounded-full p-2 hover:bg-white/10"
            aria-label="Back to feed"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-base font-semibold">Search</h1>
        </div>
        <form onSubmit={onSubmit} className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Creators or captions"
              className="w-full rounded-md bg-white/10 py-2 pl-8 pr-3 text-sm outline-none placeholder:text-white/35"
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-white px-3 text-sm font-semibold text-black"
          >
            Go
          </button>
        </form>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-20">
        {!query && (
          <p className="px-4 py-10 text-center text-sm text-white/45">
            Search creators by username or videos by caption.
          </p>
        )}
        {query && isFetching && (
          <p className="px-4 py-10 text-center text-sm text-white/45">Searching…</p>
        )}
        {empty && (
          <p className="px-4 py-10 text-center text-sm text-white/45">
            No results for “{query}”.
          </p>
        )}

        {creators.length > 0 && (
          <section className="border-b border-white/10 px-4 py-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/45">
              Creators
            </h2>
            <ul className="space-y-3">
              {creators.map((creator) => (
                <li key={creator.id}>
                  <Link
                    href={`/creator/${creator.id}`}
                    className="flex items-center gap-3 rounded-lg hover:bg-white/5"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={creator.avatar}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover bg-zinc-800"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{creator.handle}</p>
                      {creator.name && (
                        <p className="truncate text-xs text-white/45">{creator.name}</p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {videos.length > 0 && (
          <section className="px-2 py-4">
            <h2 className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-white/45">
              Videos
            </h2>
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
                  <span className="absolute bottom-1 left-1 right-1 truncate text-[10px] font-medium text-white drop-shadow">
                    {formatNumber(video.stats.likes)} · {video.caption}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <BottomNav
        active={uploadOpen ? 'create' : 'home'}
        onHome={() => router.push('/')}
        onFollowing={() => router.push('/?feed=following')}
        onCreate={() => setUploadOpen((o) => !o)}
      />
      <UploadSheet
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={(videoId) => {
          setUploadOpen(false);
          router.push(`/?v=${encodeURIComponent(videoId)}`);
        }}
      />
    </div>
  );
}
