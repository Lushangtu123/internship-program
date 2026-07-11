'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { MessageThread } from '@/components/MessageThread';
import { UploadSheet } from '@/components/UploadSheet';

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const conversationId = params.id;
  const [uploadOpen, setUploadOpen] = useState(false);

  if (!conversationId) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950 text-white">
        <button
          type="button"
          className="text-sm text-white/70 underline"
          onClick={() => router.push('/inbox?tab=messages')}
        >
          Back to messages
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-zinc-950 text-white">
      <div className="min-h-0 flex-1 pb-14">
        <MessageThread conversationId={conversationId} />
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
