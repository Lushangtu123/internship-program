'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface UploadSheetProps {
  open: boolean;
  onClose: () => void;
  /** Called with the new video id after a successful publish */
  onUploaded?: (videoId: string) => void;
}

export function UploadSheet({ open, onClose, onUploaded }: UploadSheetProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      setDone(null);
    }
  }, [open]);

  if (!open) return null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Choose a video file first');
      return;
    }
    setPending(true);
    setError(null);
    setDone(null);
    try {
      const body = new FormData();
      body.set('file', file);
      body.set('caption', caption);
      const response = await fetch('/api/videos/upload', {
        method: 'POST',
        body,
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed');
      const videoId = data.video?.id as string | undefined;
      setCaption('');
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      await queryClient.invalidateQueries({ queryKey: ['videos'] });
      if (videoId) {
        setDone(videoId);
        onUploaded?.(videoId);
      } else {
        setDone('uploaded');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="absolute inset-0 z-40 bg-black/50"
        aria-label="Close upload"
        onClick={onClose}
      />
      <form
        onSubmit={onSubmit}
        className="absolute bottom-20 left-1/2 z-50 w-[min(100%-2rem,22rem)] -translate-x-1/2 rounded-2xl border border-white/10 bg-zinc-900 p-4 text-white shadow-xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Upload</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-white/60 hover:text-white"
          >
            Close
          </button>
        </div>
        <p className="mb-3 text-xs text-white/60">
          Local upload (webm/mp4/mov, max 40MB). Packaged to HLS + poster.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="video/webm,video/mp4,video/quicktime"
          className="mb-2 block w-full text-xs"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <input
          className="mb-2 w-full rounded-md bg-black/40 px-2 py-1.5 text-sm outline-none"
          placeholder="Caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        {error && <p className="mb-2 text-xs text-red-300">{error}</p>}
        {done && (
          <p className="mb-2 text-xs text-emerald-300">
            Published — opening your video…
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-white py-2 text-sm font-medium text-black disabled:opacity-60"
        >
          {pending ? 'Uploading…' : 'Publish'}
        </button>
      </form>
    </>
  );
}
