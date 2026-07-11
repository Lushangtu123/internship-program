'use client';

import { useParams, useRouter } from 'next/navigation';
import { MessageThread } from '@/components/MessageThread';

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const conversationId = params.id;

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
      <MessageThread conversationId={conversationId} />
    </div>
  );
}
