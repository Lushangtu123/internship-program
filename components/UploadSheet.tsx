'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface UploadSheetProps {
  open: boolean;
  onClose: () => void;
  /** Called with the new video id after a successful publish */
  onUploaded?: (videoId: string) => void;
}

type UploadPhase = 'idle' | 'uploading' | 'processing';

function uploadWithProgress(
  body: FormData,
  onProgress: (pct: number) => void
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/videos/upload');
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(xhr.responseText || '{}');
      } catch {
        data = {};
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data });
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(body);
  });
}

export function UploadSheet({ open, onClose, onUploaded }: UploadSheetProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      setDone(null);
      setPhase('idle');
      setProgress(0);
    }
  }, [open]);

  if (!open) return null;

  const pending = phase !== 'idle';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Choose a video file first');
      return;
    }
    setPhase('uploading');
    setProgress(0);
    setError(null);
    setDone(null);
    try {
      const body = new FormData();
      body.set('file', file);
      body.set('caption', caption);
      const response = await uploadWithProgress(body, (pct) => {
        setProgress(pct);
        if (pct >= 99) setPhase('processing');
      });
      setPhase('processing');
      setProgress(100);
      if (!response.ok) {
        throw new Error(
          typeof response.data.error === 'string'
            ? response.data.error
            : 'Upload failed'
        );
      }
      const videoId =
        typeof (response.data.video as { id?: string } | undefined)?.id ===
        'string'
          ? (response.data.video as { id: string }).id
          : undefined;
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
      setPhase('idle');
      setProgress(0);
    }
  };

  const statusLabel =
    phase === 'uploading'
      ? `Uploading ${progress}%…`
      : phase === 'processing'
        ? 'Processing video…'
        : 'Publish';

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
          disabled={pending}
        />
        <input
          className="mb-2 w-full rounded-md bg-black/40 px-2 py-1.5 text-sm outline-none"
          placeholder="Caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          disabled={pending}
        />
        {pending && (
          <div className="mb-2">
            <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white transition-[width] duration-150"
                style={{
                  width: `${phase === 'processing' ? 100 : progress}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-white/50">
              {phase === 'uploading'
                ? 'Sending file…'
                : 'Transcoding to HLS — this can take a moment'}
            </p>
          </div>
        )}
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
          {statusLabel}
        </button>
      </form>
    </>
  );
}
