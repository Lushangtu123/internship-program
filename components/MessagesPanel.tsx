'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  fetchConversations,
  fetchMe,
  type ConversationSummary,
} from '@/lib/api';

function formatRelative(ts: number) {
  const delta = Math.max(0, Date.now() - ts);
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

interface MessagesPanelProps {
  active?: boolean;
  className?: string;
}

export function MessagesPanel({ active = true, className }: MessagesPanelProps) {
  const { data: me } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: fetchConversations,
    refetchInterval: active ? 10_000 : 30_000,
  });

  const items = data?.items ?? [];
  const isGuest = me?.isGuest ?? true;
  const meHref = me ? `/creator/${me.id}` : '/';

  return (
    <div className={className}>
      {isLoading ? (
        <p className="px-4 py-8 text-center text-sm text-white/50">Loading…</p>
      ) : isGuest ? (
        <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
          <p className="text-sm text-white/50">Sign in to message people</p>
          <p className="text-xs text-white/40">
            Open a creator profile and tap Message after you have an account.
          </p>
          <Link
            href={meHref}
            className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-black hover:bg-white/90"
          >
            Sign in on Me
          </Link>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
          <p className="text-sm text-white/50">No messages yet</p>
          <p className="text-xs text-white/40">
            Visit a creator profile and tap Message to start a chat.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-white/5">
          {items.map((item) => (
            <ConversationRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ConversationRow({ item }: { item: ConversationSummary }) {
  const preview = item.lastMessage?.text ?? 'Say hi';
  return (
    <li>
      <Link
        href={`/inbox/c/${encodeURIComponent(item.id)}`}
        className={`flex gap-3 px-4 py-3 text-sm transition-colors hover:bg-white/10 ${
          item.unreadCount > 0 ? 'bg-white/5' : ''
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.peer.avatar}
          alt=""
          className="h-10 w-10 flex-shrink-0 rounded-full object-cover bg-zinc-700"
        />
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate font-semibold">@{item.peer.username}</p>
            <p className="flex-shrink-0 text-[11px] text-white/40">
              {formatRelative(item.updatedAt)}
            </p>
          </div>
          <p
            className={`mt-0.5 truncate text-xs ${
              item.unreadCount > 0 ? 'text-white/90' : 'text-white/45'
            }`}
          >
            {preview}
          </p>
        </div>
        {item.unreadCount > 0 && (
          <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-rose-500" />
        )}
      </Link>
    </li>
  );
}

/** Unread DM count for the bottom-nav badge */
export function useMessageUnread() {
  const { data } = useQuery({
    queryKey: ['conversations'],
    queryFn: fetchConversations,
    refetchInterval: 30_000,
  });
  return data?.unreadCount ?? 0;
}
