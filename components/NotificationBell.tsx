'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
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

export function NotificationBell() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetchNotifications(30),
    refetchInterval: open ? 10_000 : 30_000,
  });

  const unread = data?.unreadCount ?? 0;
  const items = data?.items ?? [];

  const onOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      try {
        await markNotificationsRead();
        await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="absolute top-4 right-28 z-30">
      <button
        type="button"
        onClick={onOpen}
        className="relative inline-flex items-center justify-center rounded-full bg-black/50 p-2 text-white backdrop-blur-sm hover:bg-black/70"
        aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'
        }
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-[1rem] rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 max-h-[70vh] overflow-y-auto rounded-xl border border-white/10 bg-zinc-900/95 text-white shadow-xl">
          <div className="sticky top-0 border-b border-white/10 bg-zinc-900/95 px-3 py-2 text-sm font-semibold">
            Notifications
          </div>
          {isLoading ? (
            <p className="px-3 py-6 text-center text-sm text-white/50">
              Loading…
            </p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-white/50">
              No notifications yet
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`flex gap-2 px-3 py-2.5 text-sm ${
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
      )}
    </div>
  );
}
