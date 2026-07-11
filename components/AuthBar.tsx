'use client';

import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMe, login, logout, register, type AuthUser } from '@/lib/api';

export function AuthBar() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
  });

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const refresh = async (next?: AuthUser) => {
    if (next) queryClient.setQueryData(['auth', 'me'], next);
    else await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    await queryClient.invalidateQueries({ queryKey: ['videos'] });
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
      setOpen(false);
      setUsername('');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auth failed');
    } finally {
      setPending(false);
    }
  };

  const onLogout = async () => {
    await logout();
    await refresh();
  };

  return (
    <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
      <div className="rounded-full bg-black/50 backdrop-blur-sm px-3 py-1.5 text-xs text-white">
        {isLoading
          ? '…'
          : user
            ? user.isGuest
              ? `Guest · ${user.username}`
              : `@${user.username}`
            : 'Signed out'}
      </div>

      {user && !user.isGuest ? (
        <button
          type="button"
          onClick={onLogout}
          className="rounded-full bg-white/15 px-3 py-1.5 text-xs text-white hover:bg-white/25"
        >
          Log out
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-black hover:bg-white/90"
        >
          {open ? 'Close' : 'Sign in'}
        </button>
      )}

      {open && (
        <form
          onSubmit={onSubmit}
          className="absolute top-10 left-0 w-64 rounded-xl bg-zinc-900/95 p-3 text-white shadow-xl border border-white/10"
        >
          <div className="mb-2 flex gap-2 text-xs">
            <button
              type="button"
              className={mode === 'login' ? 'underline' : 'opacity-60'}
              onClick={() => setMode('login')}
            >
              Log in
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'underline' : 'opacity-60'}
              onClick={() => setMode('register')}
            >
              Register
            </button>
          </div>
          <input
            className="mb-2 w-full rounded-md bg-black/40 px-2 py-1.5 text-sm outline-none"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
          <input
            className="mb-2 w-full rounded-md bg-black/40 px-2 py-1.5 text-sm outline-none"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
          />
          {error && <p className="mb-2 text-xs text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-white py-1.5 text-sm font-medium text-black disabled:opacity-60"
          >
            {pending ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
      )}
    </div>
  );
}
