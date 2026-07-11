'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';
import type { Video } from '@/types/video';
import { deleteOwnedVideo, updateVideoCaption } from '@/lib/api';
import { formatNumber } from '@/lib/utils';

interface ManagedVideoGridProps {
  videos: Video[];
  emptyText: string;
  /** When true, owner can edit caption / delete */
  manageable?: boolean;
  creatorId?: string;
}

export function ManagedVideoGrid({
  videos,
  emptyText,
  manageable = false,
  creatorId,
}: ManagedVideoGridProps) {
  const queryClient = useQueryClient();
  const [active, setActive] = useState<Video | null>(null);
  const [caption, setCaption] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (videos.length === 0) {
    return (
      <p className="px-2 py-8 text-center text-sm text-white/50">{emptyText}</p>
    );
  }

  const openManage = (video: Video, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActive(video);
    setCaption(video.caption);
    setError(null);
  };

  const close = () => {
    if (pending) return;
    setActive(null);
    setError(null);
  };

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!active || pending) return;
    setPending(true);
    setError(null);
    try {
      await updateVideoCaption(active.id, caption);
      if (creatorId) {
        await queryClient.invalidateQueries({ queryKey: ['creator', creatorId] });
      }
      await queryClient.invalidateQueries({ queryKey: ['videos'] });
      setActive(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setPending(false);
    }
  };

  const onDelete = async () => {
    if (!active || pending) return;
    if (!window.confirm('Delete this video? This cannot be undone.')) return;
    setPending(true);
    setError(null);
    try {
      await deleteOwnedVideo(active.id);
      if (creatorId) {
        await queryClient.invalidateQueries({ queryKey: ['creator', creatorId] });
      }
      await queryClient.invalidateQueries({ queryKey: ['videos'] });
      setActive(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-1">
        {videos.map((video) => (
          <div key={video.id} className="relative aspect-[9/16] overflow-hidden bg-zinc-900">
            <Link href={`/?v=${video.id}`} className="absolute inset-0 block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={video.poster}
                alt={video.caption}
                className="h-full w-full object-cover"
              />
              <span className="absolute bottom-1 left-1 text-[10px] font-medium text-white drop-shadow">
                {formatNumber(video.stats.likes)}
              </span>
            </Link>
            {manageable && (
              <button
                type="button"
                onClick={(e) => openManage(video, e)}
                className="absolute right-1 top-1 rounded-full bg-black/55 p-1.5 text-white backdrop-blur-sm hover:bg-black/70"
                aria-label={`Manage ${video.caption}`}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {active && (
        <>
          <button
            type="button"
            className="absolute inset-0 z-40 bg-black/50"
            aria-label="Close manage video"
            onClick={close}
          />
          <form
            onSubmit={onSave}
            className="absolute bottom-20 left-1/2 z-50 w-[min(100%-2rem,22rem)] -translate-x-1/2 rounded-2xl border border-white/10 bg-zinc-900 p-4 text-white shadow-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Manage video</h2>
              <button
                type="button"
                onClick={close}
                className="text-xs text-white/60 hover:text-white"
              >
                Close
              </button>
            </div>
            <label className="mb-1 block text-xs text-white/50">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              maxLength={300}
              className="mb-3 w-full resize-none rounded-md bg-black/40 px-2 py-1.5 text-sm outline-none"
              disabled={pending}
            />
            {error && <p className="mb-2 text-xs text-red-300">{error}</p>}
            <button
              type="submit"
              disabled={pending || !caption.trim()}
              className="mb-2 w-full rounded-md bg-white py-2 text-sm font-medium text-black disabled:opacity-60"
            >
              {pending ? 'Saving…' : 'Save caption'}
            </button>
            <button
              type="button"
              onClick={() => void onDelete()}
              disabled={pending}
              className="w-full rounded-md bg-red-500/20 py-2 text-sm font-medium text-red-200 hover:bg-red-500/30 disabled:opacity-60"
            >
              Delete video
            </button>
          </form>
        </>
      )}
    </>
  );
}
