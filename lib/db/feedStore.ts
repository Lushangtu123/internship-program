/**
 * Step 1 data layer: file-backed JSON store for videos, likes, and comments.
 * Seeds from public/mock/seed.json on first run; persists mutations across restarts.
 * No auth / upload / HLS yet — intentionally local-only foundation.
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { Comment, Video } from '@/types/video';

export interface FeedStoreData {
  videos: Video[];
  comments: Record<string, Comment[]>;
}

const DEFAULT_DATA_DIR = path.join(process.cwd(), 'data');
const DEFAULT_STORE_FILE = 'store.json';
const SEED_PATH = path.join(process.cwd(), 'public/mock/seed.json');

let memoryCache: FeedStoreData | null = null;
let writeChain: Promise<void> = Promise.resolve();

function storePath(dataDir = DEFAULT_DATA_DIR) {
  return path.join(dataDir, DEFAULT_STORE_FILE);
}

async function readSeed(): Promise<FeedStoreData> {
  const raw = await fs.readFile(SEED_PATH, 'utf-8');
  const seed = JSON.parse(raw) as {
    videos: Video[];
    comments: Record<string, Comment[]>;
  };
  return {
    videos: seed.videos.map((v) => ({ ...v, liked: v.liked ?? false })),
    comments: { ...seed.comments },
  };
}

async function ensureStore(dataDir = DEFAULT_DATA_DIR): Promise<FeedStoreData> {
  if (memoryCache && dataDir === DEFAULT_DATA_DIR) {
    return memoryCache;
  }

  await fs.mkdir(dataDir, { recursive: true });
  const file = storePath(dataDir);

  try {
    const raw = await fs.readFile(file, 'utf-8');
    const parsed = JSON.parse(raw) as FeedStoreData;
    if (dataDir === DEFAULT_DATA_DIR) memoryCache = parsed;
    return parsed;
  } catch {
    const seeded = await readSeed();
    await atomicWrite(file, seeded);
    if (dataDir === DEFAULT_DATA_DIR) memoryCache = seeded;
    return seeded;
  }
}

async function atomicWrite(file: string, data: FeedStoreData) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmp, file);
}

async function persist(data: FeedStoreData, dataDir = DEFAULT_DATA_DIR) {
  if (dataDir === DEFAULT_DATA_DIR) {
    memoryCache = data;
  }
  const file = storePath(dataDir);
  writeChain = writeChain.then(() => atomicWrite(file, data));
  await writeChain;
}

/** Test helper: clear in-memory cache between cases */
export function resetStoreCache() {
  memoryCache = null;
}

export async function listVideos(
  cursor: string | null,
  limit: number,
  dataDir?: string
): Promise<{ items: Video[]; nextCursor: string | null }> {
  const store = await ensureStore(dataDir);
  const videos = store.videos;

  let startIndex = 0;
  if (cursor) {
    const cursorIndex = videos.findIndex((v) => v.id === cursor);
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  }

  const items = videos.slice(startIndex, startIndex + limit);
  const nextCursor =
    startIndex + limit < videos.length
      ? videos[startIndex + limit - 1].id
      : null;

  return { items, nextCursor };
}

export async function toggleLike(
  videoId: string,
  dataDir?: string
): Promise<{ ok: true; liked: boolean; likes: number } | { ok: false; error: string }> {
  const store = await ensureStore(dataDir);
  const video = store.videos.find((v) => v.id === videoId);
  if (!video) {
    return { ok: false, error: 'Video not found' };
  }

  const nextLiked = !video.liked;
  video.liked = nextLiked;
  video.stats.likes = Math.max(0, video.stats.likes + (nextLiked ? 1 : -1));
  await persist(store, dataDir);

  return { ok: true, liked: nextLiked, likes: video.stats.likes };
}

export async function listComments(
  videoId: string,
  cursor: string | null,
  limit: number,
  dataDir?: string
): Promise<{ items: Comment[]; nextCursor: string | null } | { error: string }> {
  const store = await ensureStore(dataDir);
  if (!store.videos.some((v) => v.id === videoId)) {
    return { error: 'Video not found' };
  }

  const allComments = store.comments[videoId] ?? [];
  let startIndex = 0;
  if (cursor) {
    const cursorIndex = allComments.findIndex((c) => c.id === cursor);
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  }

  const items = allComments.slice(startIndex, startIndex + limit);
  const nextCursor =
    startIndex + limit < allComments.length
      ? allComments[startIndex + limit - 1].id
      : null;

  return { items, nextCursor };
}

export async function addComment(
  videoId: string,
  text: string,
  dataDir?: string
): Promise<Comment | { error: string; status: number }> {
  const trimmed = text?.trim() ?? '';
  if (!trimmed) {
    return { error: 'Comment text is required', status: 400 };
  }

  const store = await ensureStore(dataDir);
  const video = store.videos.find((v) => v.id === videoId);
  if (!video) {
    return { error: 'Video not found', status: 404 };
  }

  const comment: Comment = {
    id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: 'u_guest',
    username: 'you',
    userAvatar: '/avatars/default.png',
    text: trimmed,
    timestamp: Date.now(),
    likes: 0,
  };

  if (!store.comments[videoId]) {
    store.comments[videoId] = [];
  }
  store.comments[videoId] = [comment, ...store.comments[videoId]];
  video.stats.comments += 1;
  await persist(store, dataDir);

  return comment;
}
