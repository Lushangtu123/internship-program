'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { InboxPanel } from '@/components/InboxPanel';
import { UploadSheet } from '@/components/UploadSheet';

export default function InboxPage() {
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <div className="relative flex h-full flex-col bg-zinc-950 text-white">
      <header className="flex-shrink-0 border-b border-white/10 px-4 py-3">
        <h1 className="text-base font-semibold">Inbox</h1>
        <p className="text-xs text-white/45">Likes, comments, and new followers</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-20">
        <InboxPanel active />
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
