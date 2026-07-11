'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Home, Users, Plus, Bell, User } from 'lucide-react';
import { fetchMe } from '@/lib/api';
import { useNotificationUnread } from '@/components/InboxPanel';
import { cn } from '@/lib/utils';

export type BottomNavTab = 'home' | 'following' | 'create' | 'inbox' | 'me';

interface BottomNavProps {
  active: BottomNavTab;
  onHome: () => void;
  onFollowing: () => void;
  onCreate: () => void;
}

export function BottomNav({
  active,
  onHome,
  onFollowing,
  onCreate,
}: BottomNavProps) {
  const { data: me } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
  });
  const unread = useNotificationUnread();
  const profileHref = me ? `/creator/${me.id}` : '/';

  const itemClass = (tab: BottomNavTab) =>
    cn(
      'flex flex-1 flex-col items-center gap-0.5 py-1 text-[10px] font-medium',
      active === tab ? 'text-white' : 'text-white/55 hover:text-white/80'
    );

  return (
    <nav
      className="absolute bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
      aria-label="Main"
    >
      <div className="flex h-14 items-stretch px-1">
        <button type="button" onClick={onHome} className={itemClass('home')}>
          <Home className="h-5 w-5" strokeWidth={active === 'home' ? 2.5 : 2} />
          Home
        </button>
        <button
          type="button"
          onClick={onFollowing}
          className={itemClass('following')}
        >
          <Users
            className="h-5 w-5"
            strokeWidth={active === 'following' ? 2.5 : 2}
          />
          Following
        </button>
        <button
          type="button"
          onClick={onCreate}
          className="flex flex-1 flex-col items-center justify-center"
          aria-label="Create"
        >
          <span className="flex h-9 w-12 items-center justify-center rounded-lg bg-white text-black">
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </span>
        </button>
        <Link
          href="/inbox"
          className={itemClass('inbox')}
          aria-label="Inbox"
          aria-current={active === 'inbox' ? 'page' : undefined}
        >
          <span className="relative">
            <Bell
              className="h-5 w-5"
              strokeWidth={active === 'inbox' ? 2.5 : 2}
            />
            {unread > 0 && (
              <span className="absolute -right-2 -top-1 min-w-[0.9rem] rounded-full bg-red-500 px-1 text-[9px] font-bold leading-3 text-white">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </span>
          Inbox
        </Link>
        <Link
          href={profileHref}
          className={itemClass('me')}
          aria-label="Profile"
        >
          <User className="h-5 w-5" strokeWidth={active === 'me' ? 2.5 : 2} />
          Me
        </Link>
      </div>
    </nav>
  );
}
