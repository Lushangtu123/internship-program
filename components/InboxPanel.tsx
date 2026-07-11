'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchMe,
  fetchNotifications,
  markNotificationsRead,
  type AppNotification,
} from '@/lib/api';
import { notificationTargetHref } from '@/lib/deepLink';

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

interface InboxPanelProps {
  /** Mark notifications read while this panel is shown */
  active?: boolean;
  onNavigate?: () => void;
  className?: string;
}

/** Shared notification list used by /inbox and legacy sheets. */
export function InboxPanel({
  active = true,
  onNavigate,
  className,
}: InboxPanelProps) {
  const queryClient = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetchNotifications(30),
    refetchInterval: active ? 10_000 : 30_000,
  });

  const unread = data?.unreadCount ?? 0;
  const items = data?.items ?? [];
  const isGuest = me?.isGuest ?? true;
  const meHref = me ? `/creator/${me.id}` : '/';

  useEffect(() => {
    if (!active || unread === 0) return;
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
  }, [active, unread, queryClient]);

  return (
    <div className={className}>
      {isLoading ? (
        <p className="px-4 py-8 text-center text-sm text-white/50">Loading…</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
          <p className="text-sm text-white/50">No notifications yet</p>
          {isGuest ? (
            <>
              <p className="text-xs text-white/40">
                Sign in so likes, comments, and follows show up here.
              </p>
              <Link
                href={meHref}
                onClick={onNavigate}
                className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-black hover:bg-white/90"
              >
                Sign in on Me
              </Link>
            </>
          ) : (
            <p className="text-xs text-white/40">
              When someone likes or comments on your videos, it lands here.
            </p>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-white/5">
          {items.map((item) => {
            const href = notificationTargetHref(item);
            const rowClass = `flex gap-2 px-4 py-3 text-sm transition-colors ${
              item.read ? 'opacity-70' : 'bg-white/5'
            } ${href ? 'hover:bg-white/10' : ''}`;

            const body = (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.actorAvatar}
                  alt=""
                  className="h-8 w-8 flex-shrink-0 rounded-full object-cover bg-zinc-700"
                />
                <div className="min-w-0 flex-1 text-left">
                  <p className="leading-snug">{notificationCopy(item)}</p>
                  <p className="mt-0.5 text-xs text-white/40">
                    {formatRelative(item.createdAt)}
                  </p>
                </div>
              </>
            );

            return (
              <li key={item.id}>
                {href ? (
                  <Link href={href} className={rowClass} onClick={onNavigate}>
                    {body}
                  </Link>
                ) : (
                  <div className={rowClass}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
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
