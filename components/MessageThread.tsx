'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import {
  fetchMe,
  fetchMessages,
  markConversationRead,
  postMessage,
} from '@/lib/api';

function formatTime(ts: number) {
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

interface MessageThreadProps {
  conversationId: string;
}

export function MessageThread({ conversationId }: MessageThreadProps) {
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: me } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => fetchMessages(conversationId, 100),
    refetchInterval: 8_000,
    enabled: !!conversationId,
  });

  const unread = data?.unreadCount ?? 0;

  useEffect(() => {
    if (!conversationId || unread === 0) return;
    let cancelled = false;
    (async () => {
      try {
        await markConversationRead(conversationId);
        if (!cancelled) {
          await queryClient.invalidateQueries({
            queryKey: ['messages', conversationId],
          });
          await queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, unread, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.items.length]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      await postMessage(conversationId, text);
      setDraft('');
      await queryClient.invalidateQueries({
        queryKey: ['messages', conversationId],
      });
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const peer = data?.peer;
  const items = data?.items ?? [];
  const isGuest = me?.isGuest ?? true;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-shrink-0 items-center gap-2 border-b border-white/10 px-3 py-3">
        <Link
          href="/inbox?tab=messages"
          className="rounded-full p-2 hover:bg-white/10"
          aria-label="Back to messages"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {peer ? (
          <Link
            href={`/creator/${peer.id}`}
            className="flex min-w-0 items-center gap-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={peer.avatar}
              alt=""
              className="h-8 w-8 rounded-full object-cover bg-zinc-700"
            />
            <span className="truncate font-semibold">@{peer.username}</span>
          </Link>
        ) : (
          <span className="text-sm text-white/50">Conversation</span>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-white/50">Loading…</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/45">
            No messages yet. Say hello.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item) => {
              const mine = item.senderId === me?.id;
              return (
                <li
                  key={item.id}
                  className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      mine
                        ? 'rounded-br-md bg-sky-600 text-white'
                        : 'rounded-bl-md bg-white/10 text-white'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{item.text}</p>
                    <p
                      className={`mt-1 text-[10px] ${
                        mine ? 'text-white/70' : 'text-white/40'
                      }`}
                    >
                      {formatTime(item.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
            <div ref={bottomRef} />
          </ul>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="flex-shrink-0 border-t border-white/10 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        {isGuest ? (
          <p className="py-2 text-center text-xs text-white/45">
            Sign in on Me to send messages.
          </p>
        ) : (
          <>
            {error && (
              <p className="mb-1 text-center text-xs text-rose-300">{error}</p>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={1}
                maxLength={1000}
                placeholder="Message…"
                className="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-white/30 focus:outline-none"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
