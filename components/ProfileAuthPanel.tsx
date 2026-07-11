'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { fetchMe, login, logout, register, type AuthUser } from '@/lib/api';

interface ProfileAuthPanelProps {
  user: AuthUser;
}

/** Sign-in / log-out controls living on the Me profile, not the feed chrome. */
export function ProfileAuthPanel({ user }: ProfileAuthPanelProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const refresh = async (next?: AuthUser) => {
    if (next) queryClient.setQueryData(['auth', 'me'], next);
    else await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    await queryClient.invalidateQueries({ queryKey: ['videos'] });
    await queryClient.invalidateQueries({ queryKey: ['creator'] });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const next =
        mode === 'login'
          ? await login(username, password)
          : await register(username, password);
      await refresh(next);
      setUsername('');
      setPassword('');
      router.replace(`/creator/${next.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auth failed');
    } finally {
      setPending(false);
    }
  };

  const onLogout = async () => {
    setPending(true);
    try {
      await logout();
      await refresh();
      const guest = await fetchMe();
      router.replace(`/creator/${guest.id}`);
    } catch (err) {
      console.error(err);
      router.replace('/');
    } finally {
      setPending(false);
    }
  };

  if (!user.isGuest) {
    return (
      <div className="mt-5 space-y-2">
        <p className="text-center text-sm text-white/50">
          Signed in as @{user.username}
        </p>
        <button
          type="button"
          onClick={onLogout}
          disabled={pending}
          className="w-full rounded-md bg-white/10 py-2.5 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-60"
        >
          {pending ? 'Please wait…' : 'Log out'}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-5 space-y-2 rounded-xl border border-white/10 bg-white/5 p-3"
    >
      <p className="text-center text-xs text-white/50">
        Browsing as guest · {user.username}
      </p>
      {mode === 'register' && (
        <p className="text-center text-[11px] text-white/40">
          Create an account to keep likes, saves, follows, and uploads.
        </p>
      )}
      {mode === 'login' && (
        <p className="text-center text-[11px] text-white/40">
          Log in to an existing account (guest activity stays on this device
          session).
        </p>
      )}
      <div className="flex gap-3 text-xs">
        <button
          type="button"
          className={mode === 'login' ? 'font-semibold text-white' : 'text-white/50'}
          onClick={() => setMode('login')}
        >
          Log in
        </button>
        <button
          type="button"
          className={
            mode === 'register' ? 'font-semibold text-white' : 'text-white/50'
          }
          onClick={() => setMode('register')}
        >
          Register
        </button>
      </div>
      <input
        className="w-full rounded-md bg-black/40 px-2 py-1.5 text-sm outline-none placeholder:text-white/35"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete="username"
        required
      />
      <input
        className="w-full rounded-md bg-black/40 px-2 py-1.5 text-sm outline-none placeholder:text-white/35"
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        required
      />
      {error && <p className="text-xs text-red-300">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-white py-2 text-sm font-semibold text-black disabled:opacity-60"
      >
        {pending
          ? 'Please wait…'
          : mode === 'login'
            ? 'Log in'
            : 'Create account'}
      </button>
    </form>
  );
}
