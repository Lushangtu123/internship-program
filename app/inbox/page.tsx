'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { InboxPanel, useNotificationUnread } from '@/components/InboxPanel';
import { MessagesPanel, useMessageUnread } from '@/components/MessagesPanel';
import { UploadSheet } from '@/components/UploadSheet';
import { preferInboxTab } from '@/lib/inboxTab';

type InboxTab = 'activity' | 'messages';

function parseTab(value: string | null): InboxTab | null {
  if (value === 'messages') return 'messages';
  if (value === 'activity') return 'activity';
  return null;
}

function InboxContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const explicitTab = parseTab(searchParams.get('tab'));
  const unreadNotifications = useNotificationUnread();
  const unreadMessages = useMessageUnread();
  const preferred = preferInboxTab(unreadNotifications, unreadMessages);
  const tab: InboxTab = explicitTab ?? preferred;
  const [uploadOpen, setUploadOpen] = useState(false);

  // When visiting bare /inbox with only DM unread, land on Messages once.
  useEffect(() => {
    if (explicitTab) return;
    if (preferred !== 'messages') return;
    router.replace('/inbox?tab=messages');
  }, [explicitTab, preferred, router]);

  const setTab = (next: InboxTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'activity') params.set('tab', 'activity');
    else params.set('tab', 'messages');
    const qs = params.toString();
    router.replace(`/inbox?${qs}`);
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
            className={`relative pb-2 text-sm font-semibold ${
              tab === 'activity'
                ? 'border-b-2 border-white text-white'
                : 'text-white/45'
            }`}
          >
            Activity
            {unreadNotifications > 0 && (
              <span className="absolute -right-3 top-0 h-1.5 w-1.5 rounded-full bg-rose-500" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab('messages')}
            className={`relative pb-2 text-sm font-semibold ${
              tab === 'messages'
                ? 'border-b-2 border-white text-white'
                : 'text-white/45'
            }`}
          >
            Messages
            {unreadMessages > 0 && (
              <span className="absolute -right-3 top-0 h-1.5 w-1.5 rounded-full bg-rose-500" />
            )}
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
