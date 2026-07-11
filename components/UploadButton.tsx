'use client';

import { FormEvent, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';

export function UploadButton() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

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
      setDone(data.video?.id ?? 'uploaded');
      setCaption('');
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      await queryClient.invalidateQueries({ queryKey: ['videos'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="absolute top-4 right-4 z-30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-black hover:bg-white/90"
        aria-label="Upload video"
      >
        <Upload className="h-3.5 w-3.5" />
        Upload
      </button>

      {open && (
        <form
          onSubmit={onSubmit}
          className="absolute right-0 top-10 w-72 rounded-xl border border-white/10 bg-zinc-900/95 p-3 text-white shadow-xl"
        >
          <p className="mb-2 text-xs text-white/70">
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
          {done && <p className="mb-2 text-xs text-emerald-300">Uploaded {done}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-white py-1.5 text-sm font-medium text-black disabled:opacity-60"
          >
            {pending ? 'Uploading…' : 'Publish'}
          </button>
        </form>
      )}
    </div>
  );
}
