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

export type NotificationType = 'like' | 'comment' | 'follow';

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType;
  actorId: string;
  actorUsername: string;
  actorAvatar: string;
  videoId?: string;
  text?: string;
  read: boolean;
  createdAt: number;
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
  /** userId -> videoIds saved/bookmarked by that user */
  savesByUser: Record<string, string[]>;
  /** videoId -> play/complete counters for ranking */
  signals: Record<string, VideoSignals>;
  /** followerUserId -> creatorIds they follow */
  follows: Record<string, string[]>;
  /** recipientUserId -> notifications (newest first) */
  notificationsByUser: Record<string, NotificationItem[]>;
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

function pushNotification(
  store: FeedStoreData,
  recipientId: string,
  input: {
    type: NotificationType;
    actorId: string;
    actorUsername: string;
    actorAvatar: string;
    videoId?: string;
    text?: string;
  }
) {
  if (!recipientId || recipientId === input.actorId) return;
  const item: NotificationItem = {
    id: newId('n'),
    userId: recipientId,
    type: input.type,
    actorId: input.actorId,
    actorUsername: input.actorUsername,
    actorAvatar: input.actorAvatar,
    videoId: input.videoId,
    text: input.text,
    read: false,
    createdAt: Date.now(),
  };
  const existing = store.notificationsByUser[recipientId] ?? [];
  store.notificationsByUser[recipientId] = [item, ...existing].slice(0, 100);
}

function actorFromStore(store: FeedStoreData, userId: string) {
  const user = store.users.find((u) => u.id === userId);
  if (!user) return null;
  return {
    actorId: user.id,
    actorUsername: user.username,
    actorAvatar: user.avatar,
  };
}

function withUserContext(
  video: Video,
  userId: string | null,
  likesByUser: FeedStoreData['likesByUser'],
  follows: FeedStoreData['follows'],
  savesByUser: FeedStoreData['savesByUser']
): Video {
  const liked = userId ? (likesByUser[userId] ?? []).includes(video.id) : false;
  const saved = userId ? (savesByUser[userId] ?? []).includes(video.id) : false;
  const isFollowing = userId
    ? (follows[userId] ?? []).includes(video.creator.id)
    : false;
  const { liked: _ignored, saved: _s, isFollowing: _f, ...rest } = video;
  return { ...rest, liked, saved, isFollowing };
}

async function readSeed(): Promise<FeedStoreData> {
  const raw = await fs.readFile(SEED_PATH, 'utf-8');
  const seed = JSON.parse(raw) as {
    videos: Video[];
    comments: Record<string, Comment[]>;
  };
  const now = Date.now();
  return {
    videos: seed.videos.map(({ liked: _l, saved: _s, isFollowing: _f, ...v }, index) => ({
      ...v,
      createdAt: v.createdAt ?? now - (seed.videos.length - index) * 3_600_000,
    })),
    comments: { ...seed.comments },
    users: [],
    sessions: {},
    likesByUser: {},
    savesByUser: {},
    signals: {},
    follows: {},
    notificationsByUser: {},
  };
}

function migrate(data: Partial<FeedStoreData>): FeedStoreData {
  const now = Date.now();
  const videos = (data.videos ?? []).map(
    ({ liked: _l, saved: _s, isFollowing: _f, ...v }, index, arr) => ({
      ...(v as Video),
      createdAt:
        (v as Video).createdAt ?? now - (arr.length - index) * 3_600_000,
    })
  );
  return {
    videos,
    comments: data.comments ?? {},
    users: data.users ?? [],
    sessions: data.sessions ?? {},
    likesByUser: data.likesByUser ?? {},
    savesByUser: data.savesByUser ?? {},
    signals: data.signals ?? {},
    follows: data.follows ?? {},
    notificationsByUser: data.notificationsByUser ?? {},
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

/**
 * When a guest registers, keep the same user id so likes / saves / follows /
 * uploads / comments / notifications stay attached. Refresh denormalized
 * display fields that still show the old guest_* name.
 */
function syncIdentityDisplay(store: FeedStoreData, user: StoredUser) {
  const handle = `@${user.username}`;
  for (const video of store.videos) {
    if (video.creator.id !== user.id) continue;
    video.creator.handle = handle;
    video.creator.name = user.username;
    video.creator.avatar = user.avatar;
    if (video.music?.artist) video.music.artist = user.username;
  }
  for (const list of Object.values(store.comments)) {
    for (const comment of list) {
      if (comment.userId !== user.id) continue;
      comment.username = user.username;
      comment.userAvatar = user.avatar;
    }
  }
  for (const list of Object.values(store.notificationsByUser)) {
    for (const item of list) {
      if (item.actorId !== user.id) continue;
      item.actorUsername = user.username;
      item.actorAvatar = user.avatar;
    }
  }
}

export async function registerUser(
  username: string,
  password: string,
  dataDir?: string,
  /** Current guest user id — register upgrades this identity in place */
  upgradeFromUserId?: string | null
): Promise<{ user: PublicUser; token: string } | { error: string; status: number }> {
  const name = username.trim();
  if (name.length < 3) return { error: 'Username must be at least 3 characters', status: 400 };
  if (password.length < 6) return { error: 'Password must be at least 6 characters', status: 400 };

  const store = await ensureStore(dataDir);
  if (
    store.users.some(
      (u) =>
        u.username.toLowerCase() === name.toLowerCase() &&
        !u.isGuest &&
        u.id !== upgradeFromUserId
    )
  ) {
    return { error: 'Username already taken', status: 409 };
  }

  const guest =
    upgradeFromUserId != null
      ? store.users.find((u) => u.id === upgradeFromUserId && u.isGuest)
      : undefined;

  if (guest) {
    guest.username = name;
    guest.passwordHash = hashPassword(password);
    guest.isGuest = false;
    syncIdentityDisplay(store, guest);
    const token = newSessionToken();
    store.sessions[token] = { userId: guest.id, createdAt: Date.now() };
    await persist(store, dataDir);
    return { user: toPublicUser(guest), token };
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
  dataDir?: string,
  feed: 'foryou' | 'following' | 'saved' = 'foryou'
): Promise<{ items: Video[]; nextCursor: string | null }> {
  const store = await ensureStore(dataDir);
  let pool = store.videos;

  if (feed === 'following') {
    if (!userId) {
      return { items: [], nextCursor: null };
    }
    const following = new Set(store.follows[userId] ?? []);
    pool = store.videos.filter((v) => following.has(v.creator.id));
  } else if (feed === 'saved') {
    if (!userId) {
      return { items: [], nextCursor: null };
    }
    const savedIds = store.savesByUser[userId] ?? [];
    const byId = new Map(store.videos.map((v) => [v.id, v]));
    // Most recently saved first (toggleSave appends).
    pool = [...savedIds]
      .reverse()
      .map((id) => byId.get(id))
      .filter((v): v is Video => Boolean(v));
  }

  const ranked =
    feed === 'saved' ? pool : rankVideos(pool, store.signals);

  let startIndex = 0;
  if (cursor) {
    const cursorIndex = ranked.findIndex((v) => v.id === cursor);
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  }

  const slice = ranked.slice(startIndex, startIndex + limit);
  const items = slice.map((v) =>
    withUserContext(
      v,
      userId ?? null,
      store.likesByUser,
      store.follows,
      store.savesByUser
    )
  );
  const nextCursor =
    startIndex + limit < ranked.length
      ? ranked[startIndex + limit - 1].id
      : null;

  return { items, nextCursor };
}

export interface SuggestedCreator {
  id: string;
  handle: string;
  avatar: string;
  name?: string;
  videoCount: number;
  isFollowing: boolean;
}

export async function listSuggestedCreators(
  userId: string,
  limit = 6,
  dataDir?: string
): Promise<SuggestedCreator[]> {
  const store = await ensureStore(dataDir);
  const following = new Set(store.follows[userId] ?? []);
  const ranked = rankVideos(store.videos, store.signals);

  const suggestions: SuggestedCreator[] = [];
  const seen = new Set<string>();

  for (const video of ranked) {
    const creatorId = video.creator.id;
    if (
      !creatorId ||
      seen.has(creatorId) ||
      creatorId === userId ||
      following.has(creatorId)
    ) {
      continue;
    }
    seen.add(creatorId);
    const videoCount = store.videos.filter((v) => v.creator.id === creatorId)
      .length;
    suggestions.push({
      id: creatorId,
      handle: video.creator.handle,
      avatar: video.creator.avatar,
      name: video.creator.name,
      videoCount,
      isFollowing: false,
    });
    if (suggestions.length >= limit) break;
  }

  return suggestions;
}

export async function toggleFollow(
  followerId: string,
  creatorId: string,
  dataDir?: string
): Promise<
  | { ok: true; following: boolean }
  | { ok: false; error: string; status: number }
> {
  if (!creatorId) {
    return { ok: false, error: 'creatorId required', status: 400 };
  }
  if (followerId === creatorId) {
    return { ok: false, error: 'Cannot follow yourself', status: 400 };
  }

  const store = await ensureStore(dataDir);
  const set = new Set(store.follows[followerId] ?? []);
  const currentlyFollowing = set.has(creatorId);
  if (currentlyFollowing) {
    set.delete(creatorId);
  } else {
    set.add(creatorId);
  }
  store.follows[followerId] = Array.from(set);
  if (!currentlyFollowing) {
    const actor = actorFromStore(store, followerId);
    if (actor) {
      pushNotification(store, creatorId, {
        type: 'follow',
        ...actor,
      });
    }
  }
  await persist(store, dataDir);
  return { ok: true, following: !currentlyFollowing };
}

export interface CreatorProfile {
  creator: {
    id: string;
    handle: string;
    avatar: string;
    name?: string;
  };
  stats: {
    videos: number;
    followers: number;
    likes: number;
  };
  isFollowing: boolean;
  videos: Video[];
}

export async function getCreatorProfile(
  creatorId: string,
  viewerId?: string | null,
  dataDir?: string
): Promise<CreatorProfile | { error: string }> {
  const store = await ensureStore(dataDir);
  const creatorVideos = store.videos.filter((v) => v.creator.id === creatorId);

  let creator: CreatorProfile['creator'] | null = null;
  if (creatorVideos.length > 0) {
    creator = creatorVideos[0].creator;
  } else {
    const user = store.users.find((u) => u.id === creatorId);
    if (!user) return { error: 'Creator not found' };
    creator = {
      id: user.id,
      handle: `@${user.username}`,
      avatar: user.avatar,
      name: user.username,
    };
  }

  const followers = Object.values(store.follows).filter((ids) =>
    ids.includes(creatorId)
  ).length;
  const likes = creatorVideos.reduce((sum, v) => sum + v.stats.likes, 0);
  const ranked = rankVideos(creatorVideos, store.signals).map((v) =>
    withUserContext(
      v,
      viewerId ?? null,
      store.likesByUser,
      store.follows,
      store.savesByUser
    )
  );

  return {
    creator,
    stats: {
      videos: creatorVideos.length,
      followers,
      likes,
    },
    isFollowing: viewerId
      ? (store.follows[viewerId] ?? []).includes(creatorId)
      : false,
    videos: ranked,
  };
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
  if (!currentlyLiked) {
    const actor = actorFromStore(store, userId);
    if (actor) {
      pushNotification(store, video.creator.id, {
        type: 'like',
        ...actor,
        videoId,
      });
    }
  }
  await persist(store, dataDir);

  return { ok: true, liked: !currentlyLiked, likes: video.stats.likes };
}

export async function recordShare(
  videoId: string,
  dataDir?: string
): Promise<{ ok: true; shares: number } | { ok: false; error: string }> {
  const store = await ensureStore(dataDir);
  const video = store.videos.find((v) => v.id === videoId);
  if (!video) {
    return { ok: false, error: 'Video not found' };
  }
  video.stats.shares = (video.stats.shares ?? 0) + 1;
  await persist(store, dataDir);
  return { ok: true, shares: video.stats.shares };
}

export async function toggleSave(
  videoId: string,
  userId: string,
  dataDir?: string
): Promise<{ ok: true; saved: boolean } | { ok: false; error: string }> {
  const store = await ensureStore(dataDir);
  if (!store.videos.some((v) => v.id === videoId)) {
    return { ok: false, error: 'Video not found' };
  }

  const savedSet = new Set(store.savesByUser[userId] ?? []);
  const currentlySaved = savedSet.has(videoId);
  if (currentlySaved) {
    savedSet.delete(videoId);
  } else {
    savedSet.add(videoId);
  }
  store.savesByUser[userId] = Array.from(savedSet);
  await persist(store, dataDir);

  return { ok: true, saved: !currentlySaved };
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
  const roots = allComments.filter((c) => !c.parentId);
  const repliesByParent = new Map<string, Comment[]>();
  for (const comment of allComments) {
    if (!comment.parentId) continue;
    const list = repliesByParent.get(comment.parentId) ?? [];
    list.push(comment);
    repliesByParent.set(comment.parentId, list);
  }
  for (const list of repliesByParent.values()) {
    list.sort((a, b) => a.timestamp - b.timestamp);
  }

  let startIndex = 0;
  if (cursor) {
    const cursorIndex = roots.findIndex((c) => c.id === cursor);
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  }

  const slice = roots.slice(startIndex, startIndex + limit);
  const items = slice.map((root) => ({
    ...root,
    replies: repliesByParent.get(root.id) ?? [],
  }));
  const nextCursor =
    startIndex + limit < roots.length
      ? roots[startIndex + limit - 1].id
      : null;

  return { items, nextCursor };
}

export async function addComment(
  videoId: string,
  text: string,
  user: PublicUser,
  dataDir?: string,
  parentId?: string | null
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

  let resolvedParentId: string | undefined;
  if (parentId) {
    const parent = (store.comments[videoId] ?? []).find((c) => c.id === parentId);
    if (!parent) {
      return { error: 'Parent comment not found', status: 404 };
    }
    if (parent.parentId) {
      return { error: 'Cannot reply to a reply', status: 400 };
    }
    resolvedParentId = parent.id;
  }

  const comment: Comment = {
    id: newId('c'),
    userId: user.id,
    username: user.username,
    userAvatar: user.avatar,
    text: trimmed,
    timestamp: Date.now(),
    likes: 0,
    ...(resolvedParentId ? { parentId: resolvedParentId } : {}),
  };

  if (!store.comments[videoId]) {
    store.comments[videoId] = [];
  }
  store.comments[videoId] = [comment, ...store.comments[videoId]];
  video.stats.comments += 1;
  pushNotification(store, video.creator.id, {
    type: 'comment',
    actorId: user.id,
    actorUsername: user.username,
    actorAvatar: user.avatar,
    videoId,
    text: trimmed.slice(0, 80),
  });
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

export async function updateVideoCaption(
  videoId: string,
  ownerId: string,
  caption: string,
  dataDir?: string
): Promise<{ ok: true; video: Video } | { ok: false; error: string; status: number }> {
  const store = await ensureStore(dataDir);
  const video = store.videos.find((v) => v.id === videoId);
  if (!video) return { ok: false, error: 'Video not found', status: 404 };
  if (video.creator.id !== ownerId) {
    return { ok: false, error: 'Forbidden', status: 403 };
  }
  const next = caption.trim();
  if (!next) return { ok: false, error: 'Caption required', status: 400 };
  video.caption = next.slice(0, 300);
  await persist(store, dataDir);
  return { ok: true, video };
}

export async function deleteVideo(
  videoId: string,
  ownerId: string,
  dataDir?: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const store = await ensureStore(dataDir);
  const video = store.videos.find((v) => v.id === videoId);
  if (!video) return { ok: false, error: 'Video not found', status: 404 };
  if (video.creator.id !== ownerId) {
    return { ok: false, error: 'Forbidden', status: 403 };
  }

  store.videos = store.videos.filter((v) => v.id !== videoId);
  delete store.comments[videoId];
  delete store.signals[videoId];

  for (const userId of Object.keys(store.likesByUser)) {
    store.likesByUser[userId] = (store.likesByUser[userId] ?? []).filter(
      (id) => id !== videoId
    );
  }
  for (const userId of Object.keys(store.savesByUser)) {
    store.savesByUser[userId] = (store.savesByUser[userId] ?? []).filter(
      (id) => id !== videoId
    );
  }
  for (const userId of Object.keys(store.notificationsByUser)) {
    store.notificationsByUser[userId] = (
      store.notificationsByUser[userId] ?? []
    ).filter((n) => n.videoId !== videoId);
  }

  await persist(store, dataDir);
  return { ok: true };
}

/** Simple catalog search over captions + creator handles/names. */
export async function searchCatalog(
  query: string,
  limit = 20,
  dataDir?: string
): Promise<{ videos: Video[]; creators: Array<{ id: string; handle: string; avatar: string; name?: string }> }> {
  const store = await ensureStore(dataDir);
  const q = query.trim().toLowerCase();
  if (!q) return { videos: [], creators: [] };

  const videos = store.videos
    .filter((v) => {
      const hay = `${v.caption} ${v.creator.handle} ${v.creator.name ?? ''}`.toLowerCase();
      return hay.includes(q);
    })
    .slice(0, limit);

  const creators = store.users
    .filter((u) => !u.isGuest)
    .filter((u) => {
      const hay = `${u.username} @${u.username}`.toLowerCase();
      return hay.includes(q.replace(/^@/, ''));
    })
    .slice(0, 10)
    .map((u) => ({
      id: u.id,
      handle: `@${u.username}`,
      avatar: u.avatar,
      name: u.username,
    }));

  return { videos, creators };
}

export async function listNotifications(
  userId: string,
  limit = 30,
  dataDir?: string
): Promise<{ items: NotificationItem[]; unreadCount: number }> {
  const store = await ensureStore(dataDir);
  const all = store.notificationsByUser[userId] ?? [];
  const unreadCount = all.filter((n) => !n.read).length;
  return { items: all.slice(0, limit), unreadCount };
}

export async function markNotificationsRead(
  userId: string,
  ids?: string[],
  dataDir?: string
): Promise<{ ok: true; unreadCount: number }> {
  const store = await ensureStore(dataDir);
  const list = store.notificationsByUser[userId] ?? [];
  const idSet = ids && ids.length > 0 ? new Set(ids) : null;
  let changed = false;
  for (const item of list) {
    if (!item.read && (!idSet || idSet.has(item.id))) {
      item.read = true;
      changed = true;
    }
  }
  if (changed) {
    store.notificationsByUser[userId] = list;
    await persist(store, dataDir);
  }
  const unreadCount = list.filter((n) => !n.read).length;
  return { ok: true, unreadCount };
}
