'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { InboxPanel } from '@/components/InboxPanel';
import { MessagesPanel } from '@/components/MessagesPanel';
import { UploadSheet } from '@/components/UploadSheet';

type InboxTab = 'activity' | 'messages';

function parseTab(value: string | null): InboxTab {
  return value === 'messages' ? 'messages' : 'activity';
}

function InboxContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get('tab'));
  const [uploadOpen, setUploadOpen] = useState(false);

  const setTab = (next: InboxTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'activity') params.delete('tab');
    else params.set('tab', next);
    const qs = params.toString();
    router.replace(qs ? `/inbox?${qs}` : '/inbox');
  };

  return (
    <div className="relative flex h-full flex-col bg-zinc-950 text-white">
      <header className="flex-shrink-0 border-b border-white/10 px-4 pt-3">
        <h1 className="text-base font-semibold">Inbox</h1>
        <p className="text-xs text-white/45">
          {tab === 'messages'
            ? 'Direct messages'
            : 'Likes, comments, and new followers'}
        </p>
        <div className="mt-3 flex gap-4">
          <button
            type="button"
            onClick={() => setTab('activity')}
            className={`pb-2 text-sm font-semibold ${
              tab === 'activity'
                ? 'border-b-2 border-white text-white'
                : 'text-white/45'
            }`}
          >
            Activity
          </button>
          <button
            type="button"
            onClick={() => setTab('messages')}
            className={`pb-2 text-sm font-semibold ${
              tab === 'messages'
                ? 'border-b-2 border-white text-white'
                : 'text-white/45'
            }`}
          >
            Messages
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-20">
        {tab === 'messages' ? (
          <MessagesPanel active />
        ) : (
          <InboxPanel active />
        )}
      </div>

      <BottomNav
        active={uploadOpen ? 'create' : 'inbox'}
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

export default function InboxPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center bg-zinc-950 text-sm text-white/50">
          Loading…
        </div>
      }
    >
      <InboxContent />
    </Suspense>
  );
}
