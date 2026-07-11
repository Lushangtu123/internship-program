/**
 * Step 2: identity + sessions on top of the file-backed feed store.
 * Guests are auto-created; register/login upgrades to a real account.
 * Likes are per-user; comments carry the acting user's identity.
 */

import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import type { Comment, Video } from '@/types/video';
import { rankVideos, type VideoSignals } from '@/lib/db/ranking';

export interface PublicUser {
  id: string;
  username: string;
  avatar: string;
  isGuest: boolean;
}

interface StoredUser extends PublicUser {
  passwordHash?: string;
  createdAt: number;
}

export interface FeedStoreData {
  videos: Video[];
  comments: Record<string, Comment[]>;
  users: StoredUser[];
  sessions: Record<string, { userId: string; createdAt: number }>;
  /** userId -> videoIds liked by that user */
  likesByUser: Record<string, string[]>;
  /** videoId -> play/complete counters for ranking */
  signals: Record<string, VideoSignals>;
}

const DEFAULT_DATA_DIR = path.join(process.cwd(), 'data');
const DEFAULT_STORE_FILE = 'store.json';
const SEED_PATH = path.join(process.cwd(), 'public/mock/seed.json');

let memoryCache: FeedStoreData | null = null;
let writeChain: Promise<void> = Promise.resolve();

function storePath(dataDir = DEFAULT_DATA_DIR) {
  return path.join(dataDir, DEFAULT_STORE_FILE);
}

function hashPassword(password: string, salt?: string) {
  const usedSalt = salt ?? randomBytes(16).toString('hex');
  const hash = scryptSync(password, usedSalt, 32).toString('hex');
  return `${usedSalt}:${hash}`;
}

function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 32);
  const prev = Buffer.from(hash, 'hex');
  if (prev.length !== next.length) return false;
  return timingSafeEqual(prev, next);
}

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

function newSessionToken() {
  return createHash('sha256').update(randomBytes(32)).digest('hex');
}

function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    username: user.username,
    avatar: user.avatar,
    isGuest: user.isGuest,
  };
}

function withUserLiked(video: Video, userId: string | null, likesByUser: FeedStoreData['likesByUser']): Video {
  const liked = userId ? (likesByUser[userId] ?? []).includes(video.id) : false;
  const { liked: _ignored, ...rest } = video;
  return { ...rest, liked };
}

async function readSeed(): Promise<FeedStoreData> {
  const raw = await fs.readFile(SEED_PATH, 'utf-8');
  const seed = JSON.parse(raw) as {
    videos: Video[];
    comments: Record<string, Comment[]>;
  };
  const now = Date.now();
  return {
    videos: seed.videos.map(({ liked: _l, ...v }, index) => ({
      ...v,
      createdAt: v.createdAt ?? now - (seed.videos.length - index) * 3_600_000,
    })),
    comments: { ...seed.comments },
    users: [],
    sessions: {},
    likesByUser: {},
    signals: {},
  };
}

function migrate(data: Partial<FeedStoreData>): FeedStoreData {
  const now = Date.now();
  const videos = (data.videos ?? []).map(({ liked: _l, ...v }, index, arr) => ({
    ...(v as Video),
    createdAt:
      (v as Video).createdAt ?? now - (arr.length - index) * 3_600_000,
  }));
  return {
    videos,
    comments: data.comments ?? {},
    users: data.users ?? [],
    sessions: data.sessions ?? {},
    likesByUser: data.likesByUser ?? {},
    signals: data.signals ?? {},
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
    const parsed = migrate(JSON.parse(raw) as Partial<FeedStoreData>);
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

export function resetStoreCache() {
  memoryCache = null;
}

export async function createGuestUser(dataDir?: string): Promise<{ user: PublicUser; token: string }> {
  const store = await ensureStore(dataDir);
  const user: StoredUser = {
    id: newId('u'),
    username: `guest_${randomBytes(3).toString('hex')}`,
    avatar: '/avatars/default.png',
    isGuest: true,
    createdAt: Date.now(),
  };
  const token = newSessionToken();
  store.users.push(user);
  store.sessions[token] = { userId: user.id, createdAt: Date.now() };
  await persist(store, dataDir);
  return { user: toPublicUser(user), token };
}

export async function getUserBySession(
  token: string | null | undefined,
  dataDir?: string
): Promise<PublicUser | null> {
  if (!token) return null;
  const store = await ensureStore(dataDir);
  const session = store.sessions[token];
  if (!session) return null;
  const user = store.users.find((u) => u.id === session.userId);
  return user ? toPublicUser(user) : null;
}

export async function registerUser(
  username: string,
  password: string,
  dataDir?: string
): Promise<{ user: PublicUser; token: string } | { error: string; status: number }> {
  const name = username.trim();
  if (name.length < 3) return { error: 'Username must be at least 3 characters', status: 400 };
  if (password.length < 6) return { error: 'Password must be at least 6 characters', status: 400 };

  const store = await ensureStore(dataDir);
  if (store.users.some((u) => u.username.toLowerCase() === name.toLowerCase() && !u.isGuest)) {
    return { error: 'Username already taken', status: 409 };
  }

  const user: StoredUser = {
    id: newId('u'),
    username: name,
    passwordHash: hashPassword(password),
    avatar: '/avatars/default.png',
    isGuest: false,
    createdAt: Date.now(),
  };
  const token = newSessionToken();
  store.users.push(user);
  store.sessions[token] = { userId: user.id, createdAt: Date.now() };
  await persist(store, dataDir);
  return { user: toPublicUser(user), token };
}

export async function loginUser(
  username: string,
  password: string,
  dataDir?: string
): Promise<{ user: PublicUser; token: string } | { error: string; status: number }> {
  const store = await ensureStore(dataDir);
  const user = store.users.find(
    (u) => !u.isGuest && u.username.toLowerCase() === username.trim().toLowerCase()
  );
  if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return { error: 'Invalid username or password', status: 401 };
  }
  const token = newSessionToken();
  store.sessions[token] = { userId: user.id, createdAt: Date.now() };
  await persist(store, dataDir);
  return { user: toPublicUser(user), token };
}

export async function logoutSession(token: string | null | undefined, dataDir?: string) {
  if (!token) return;
  const store = await ensureStore(dataDir);
  if (store.sessions[token]) {
    delete store.sessions[token];
    await persist(store, dataDir);
  }
}

export async function listVideos(
  cursor: string | null,
  limit: number,
  userId?: string | null,
  dataDir?: string
): Promise<{ items: Video[]; nextCursor: string | null }> {
  const store = await ensureStore(dataDir);
  const ranked = rankVideos(store.videos, store.signals);

  let startIndex = 0;
  if (cursor) {
    const cursorIndex = ranked.findIndex((v) => v.id === cursor);
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  }

  const slice = ranked.slice(startIndex, startIndex + limit);
  const items = slice.map((v) =>
    withUserLiked(v, userId ?? null, store.likesByUser)
  );
  const nextCursor =
    startIndex + limit < ranked.length
      ? ranked[startIndex + limit - 1].id
      : null;

  return { items, nextCursor };
}

export async function recordSignal(
  videoId: string,
  type: 'play' | 'complete',
  dataDir?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const store = await ensureStore(dataDir);
  if (!store.videos.some((v) => v.id === videoId)) {
    return { ok: false, error: 'Video not found' };
  }

  const current = store.signals[videoId] ?? { plays: 0, completes: 0 };
  if (type === 'play') current.plays += 1;
  if (type === 'complete') current.completes += 1;
  store.signals[videoId] = current;
  await persist(store, dataDir);
  return { ok: true };
}

export async function toggleLike(
  videoId: string,
  userId: string,
  dataDir?: string
): Promise<{ ok: true; liked: boolean; likes: number } | { ok: false; error: string }> {
  const store = await ensureStore(dataDir);
  const video = store.videos.find((v) => v.id === videoId);
  if (!video) {
    return { ok: false, error: 'Video not found' };
  }

  const likedSet = new Set(store.likesByUser[userId] ?? []);
  const currentlyLiked = likedSet.has(videoId);
  if (currentlyLiked) {
    likedSet.delete(videoId);
    video.stats.likes = Math.max(0, video.stats.likes - 1);
  } else {
    likedSet.add(videoId);
    video.stats.likes += 1;
  }
  store.likesByUser[userId] = Array.from(likedSet);
  await persist(store, dataDir);

  return { ok: true, liked: !currentlyLiked, likes: video.stats.likes };
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
  user: PublicUser,
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
    id: newId('c'),
    userId: user.id,
    username: user.username,
    userAvatar: user.avatar,
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

export async function createVideo(
  input: {
    src: string;
    poster: string;
    duration: number;
    caption: string;
    user: PublicUser;
    musicTitle?: string;
  },
  dataDir?: string
): Promise<Video> {
  const store = await ensureStore(dataDir);
  const video: Video = {
    id: newId('v'),
    src: input.src,
    poster: input.poster,
    duration: input.duration,
    creator: {
      id: input.user.id,
      handle: `@${input.user.username}`,
      avatar: input.user.avatar,
      name: input.user.username,
    },
    caption: input.caption.trim() || 'Untitled upload',
    music: {
      title: input.musicTitle ?? 'Original Sound',
      artist: input.user.username,
    },
    stats: { likes: 0, comments: 0, shares: 0 },
    liked: false,
    createdAt: Date.now(),
  };

  store.videos = [video, ...store.videos];
  store.comments[video.id] = [];
  store.signals[video.id] = { plays: 0, completes: 0 };
  await persist(store, dataDir);
  return video;
}
