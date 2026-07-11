'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchNotifications,
  markNotificationsRead,
  type AppNotification,
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

function notificationCopy(item: AppNotification) {
  const who = `@${item.actorUsername}`;
  if (item.type === 'like') return `${who} liked your video`;
  if (item.type === 'follow') return `${who} started following you`;
  if (item.text) return `${who} commented: ${item.text}`;
  return `${who} commented on your video`;
}

interface NotificationSheetProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationSheet({ open, onClose }: NotificationSheetProps) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetchNotifications(30),
    refetchInterval: open ? 10_000 : 30_000,
  });

  const unread = data?.unreadCount ?? 0;
  const items = data?.items ?? [];

  useEffect(() => {
    if (!open || unread === 0) return;
    let cancelled = false;
    (async () => {
      try {
        await markNotificationsRead();
        if (!cancelled) {
          await queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, unread, queryClient]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/50"
        aria-label="Close notifications"
        onClick={onClose}
      />
      <div className="fixed bottom-20 left-1/2 z-50 flex max-h-[70vh] w-[min(100%-2rem,24rem)] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 text-white shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-semibold">Inbox</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-white/60 hover:text-white"
          >
            Close
          </button>
        </div>
        <div className="overflow-y-auto">
          {isLoading ? (
            <p className="px-4 py-8 text-center text-sm text-white/50">
              Loading…
            </p>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-white/50">
              No notifications yet
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`flex gap-2 px-4 py-3 text-sm ${
                    item.read ? 'opacity-70' : 'bg-white/5'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.actorAvatar}
                    alt=""
                    className="h-8 w-8 flex-shrink-0 rounded-full object-cover bg-zinc-700"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="leading-snug">{notificationCopy(item)}</p>
                    <p className="mt-0.5 text-xs text-white/40">
                      {formatRelative(item.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

/** Unread count for the bottom-nav badge */
export function useNotificationUnread() {
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetchNotifications(30),
    refetchInterval: 30_000,
  });
  return data?.unreadCount ?? 0;
}
