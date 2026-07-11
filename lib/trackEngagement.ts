'use client';

const played = new Set<string>();
const completed = new Set<string>();

async function post(videoId: string, type: 'play' | 'complete') {
  try {
    await fetch('/api/engagement', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, type }),
      keepalive: true,
    });
  } catch {
    // Ranking signals are best-effort
  }
}

/** Record a play once per video per page session. */
export function trackPlay(videoId: string) {
  if (!videoId || played.has(videoId)) return;
  played.add(videoId);
  void post(videoId, 'play');
}

/** Record a complete once per video per page session. */
export function trackComplete(videoId: string) {
  if (!videoId || completed.has(videoId)) return;
  completed.add(videoId);
  void post(videoId, 'complete');
}
