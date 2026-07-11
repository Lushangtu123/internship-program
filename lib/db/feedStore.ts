/**
 * Identity + sessions on top of the feed store.
 * Guests are auto-created; register/login upgrades to a real account.
 * Likes are per-user; comments carry the acting user's identity.
 *
 * Persistence (experimental): normalized SQLite tables via lib/db/sqliteBackend.ts
 * (WAL; migrates legacy store.json / v1 JSON blob). Mutations use incremental SQL
 * ops; full snapshot rewrite only for seed / legacy migration.
 * In-memory document API unchanged.
 */

import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import type { Comment, Video } from '@/types/video';
import { rankVideos, type UserAffinity, type VideoSignals } from '@/lib/db/ranking';
import {
  closeSqliteStore,
  migrateLegacyJsonIfNeeded,
  readSqliteSnapshot,
  writeSqliteSnapshot,
} from '@/lib/db/sqliteBackend';
import {
  opAddComment,
  opAppendMessage,
  opDeleteSession,
  opDeleteVideo,
  opInsertConversation,
  opInsertSession,
  opInsertUserWithSession,
  opInsertVideo,
  opInsertNotification,
  opMarkConversationRead,
  opMarkNotificationsRead,
  opRecordShare,
  opRecordSignal,
  opRegisterUpgrade,
  opRefreshNotification,
  opToggleFollow,
  opToggleLike,
  opToggleSave,
  opUpdateVideoFields,
} from '@/lib/db/sqliteOps';
import { publishDirectMessage } from '@/lib/realtime/conversationBus';

export interface PublicUser {
  id: string;
  username: string;
  avatar: string;
  isGuest: boolean;
}

export type NotificationType = 'like' | 'comment' | 'follow' | 'message';

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType;
  actorId: string;
  actorUsername: string;
  actorAvatar: string;
  videoId?: string;
  /** Present for type=message */
  conversationId?: string;
  text?: string;
  read: boolean;
  createdAt: number;
}

/** 1:1 DM thread (experimental messaging MVP). */
export interface ConversationRecord {
  id: string;
  /** Lexicographically smaller participant id */
  userAId: string;
  /** Lexicographically larger participant id */
  userBId: string;
  messages: DirectMessage[];
  /** userId -> last-read message createdAt */
  lastReadAtByUser: Record<string, number>;
  updatedAt: number;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: number;
}

export interface ConversationSummary {
  id: string;
  peer: PublicUser;
  lastMessage: DirectMessage | null;
  unreadCount: number;
  updatedAt: number;
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
  /** userId -> videoIds the viewer has played (personalization) */
  playsByUser: Record<string, string[]>;
  /** followerUserId -> creatorIds they follow */
  follows: Record<string, string[]>;
  /** recipientUserId -> notifications (newest first) */
  notificationsByUser: Record<string, NotificationItem[]>;
  /** 1:1 direct-message threads */
  conversations: ConversationRecord[];
}

const DEFAULT_DATA_DIR = path.join(process.cwd(), 'data');
const SEED_PATH = path.join(process.cwd(), 'public/mock/seed.json');

let memoryCache: FeedStoreData | null = null;
let writeChain: Promise<void> = Promise.resolve();

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
    conversationId?: string;
    text?: string;
  }
): NotificationItem | null {
  if (!recipientId || recipientId === input.actorId) return null;
  const item: NotificationItem = {
    id: newId('n'),
    userId: recipientId,
    type: input.type,
    actorId: input.actorId,
    actorUsername: input.actorUsername,
    actorAvatar: input.actorAvatar,
    videoId: input.videoId,
    conversationId: input.conversationId,
    text: input.text,
    read: false,
    createdAt: Date.now(),
  };
  const existing = store.notificationsByUser[recipientId] ?? [];
  store.notificationsByUser[recipientId] = [item, ...existing].slice(0, 100);
  return item;
}

/**
 * For DMs: reuse one unread Activity row per conversation (update preview + bump to top).
 * Returns coalesced=true when an existing unread row was refreshed.
 */
function pushOrCoalesceMessageNotification(
  store: FeedStoreData,
  recipientId: string,
  input: {
    actorId: string;
    actorUsername: string;
    actorAvatar: string;
    conversationId: string;
    text: string;
  }
): { item: NotificationItem; coalesced: boolean } | null {
  if (!recipientId || recipientId === input.actorId) return null;
  const existing = store.notificationsByUser[recipientId] ?? [];
  const idx = existing.findIndex(
    (n) =>
      n.type === 'message' &&
      n.conversationId === input.conversationId &&
      !n.read
  );

  if (idx >= 0) {
    const updated: NotificationItem = {
      ...existing[idx],
      actorId: input.actorId,
      actorUsername: input.actorUsername,
      actorAvatar: input.actorAvatar,
      text: input.text,
      read: false,
      createdAt: Date.now(),
    };
    const next = [
      updated,
      ...existing.filter((_, i) => i !== idx),
    ].slice(0, 100);
    store.notificationsByUser[recipientId] = next;
    return { item: updated, coalesced: true };
  }

  const item = pushNotification(store, recipientId, {
    type: 'message',
    ...input,
  });
  return item ? { item, coalesced: false } : null;
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

function buildUserAffinity(
  store: FeedStoreData,
  userId: string
): UserAffinity {
  const likedIds = store.likesByUser[userId] ?? [];
  const byId = new Map(store.videos.map((v) => [v.id, v]));
  const likedCreators = new Set<string>();
  for (const id of likedIds) {
    const creatorId = byId.get(id)?.creator.id;
    if (creatorId) likedCreators.add(creatorId);
  }
  return {
    followedCreators: new Set(store.follows[userId] ?? []),
    likedCreators,
    savedVideoIds: new Set(store.savesByUser[userId] ?? []),
    likedVideoIds: new Set(likedIds),
    playedVideoIds: new Set(store.playsByUser[userId] ?? []),
  };
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
      status: v.status ?? 'ready',
      createdAt: v.createdAt ?? now - (seed.videos.length - index) * 3_600_000,
    })),
    comments: { ...seed.comments },
    users: [],
    sessions: {},
    likesByUser: {},
    savesByUser: {},
    signals: {},
    playsByUser: {},
    follows: {},
    notificationsByUser: {},
    conversations: [],
  };
}

function migrate(data: Partial<FeedStoreData>): FeedStoreData {
  const now = Date.now();
  const videos = (data.videos ?? []).map(
    ({ liked: _l, saved: _s, isFollowing: _f, ...v }, index, arr) => ({
      ...(v as Video),
      status: (v as Video).status ?? 'ready',
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
    playsByUser: data.playsByUser ?? {},
    follows: data.follows ?? {},
    notificationsByUser: data.notificationsByUser ?? {},
    conversations: (data.conversations ?? []).map((c) => ({
      ...c,
      messages: c.messages ?? [],
      lastReadAtByUser: c.lastReadAtByUser ?? {},
    })),
  };
}

async function ensureStore(dataDir = DEFAULT_DATA_DIR): Promise<FeedStoreData> {
  if (memoryCache && dataDir === DEFAULT_DATA_DIR) {
    return memoryCache;
  }

  await fs.mkdir(dataDir, { recursive: true });

  const fromSqlite = readSqliteSnapshot(dataDir);
  if (fromSqlite) {
    const parsed = migrate(fromSqlite);
    if (dataDir === DEFAULT_DATA_DIR) memoryCache = parsed;
    return parsed;
  }

  const fromLegacy = migrateLegacyJsonIfNeeded(dataDir);
  if (fromLegacy) {
    const parsed = migrate(fromLegacy);
    if (dataDir === DEFAULT_DATA_DIR) memoryCache = parsed;
    return parsed;
  }

  const seeded = await readSeed();
  writeSqliteSnapshot(dataDir, seeded);
  if (dataDir === DEFAULT_DATA_DIR) memoryCache = seeded;
  return seeded;
}

async function persistIncremental(
  data: FeedStoreData,
  dataDir: string,
  op: () => void
) {
  if (dataDir === DEFAULT_DATA_DIR) {
    memoryCache = data;
  }
  writeChain = writeChain.then(() => {
    op();
  });
  await writeChain;
}

export function resetStoreCache(dataDir?: string) {
  memoryCache = null;
  if (dataDir) closeSqliteStore(dataDir);
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
  const sessionCreatedAt = Date.now();
  store.users.push(user);
  store.sessions[token] = { userId: user.id, createdAt: sessionCreatedAt };
  const dir = dataDir ?? DEFAULT_DATA_DIR;
  await persistIncremental(store, dir, () => {
    opInsertUserWithSession(dir, user, token, sessionCreatedAt);
  });
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
    const sessionCreatedAt = Date.now();
    store.sessions[token] = { userId: guest.id, createdAt: sessionCreatedAt };
    const dir = dataDir ?? DEFAULT_DATA_DIR;
    await persistIncremental(store, dir, () => {
      opRegisterUpgrade(dir, guest, token, sessionCreatedAt);
    });
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
  const sessionCreatedAt = Date.now();
  store.users.push(user);
  store.sessions[token] = { userId: user.id, createdAt: sessionCreatedAt };
  const dir = dataDir ?? DEFAULT_DATA_DIR;
  await persistIncremental(store, dir, () => {
    opInsertUserWithSession(dir, user, token, sessionCreatedAt);
  });
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
  const sessionCreatedAt = Date.now();
  store.sessions[token] = { userId: user.id, createdAt: sessionCreatedAt };
  const dir = dataDir ?? DEFAULT_DATA_DIR;
  await persistIncremental(store, dir, () => {
    opInsertSession(dir, token, user.id, sessionCreatedAt);
  });
  return { user: toPublicUser(user), token };
}

export async function logoutSession(token: string | null | undefined, dataDir?: string) {
  if (!token) return;
  const store = await ensureStore(dataDir);
  if (store.sessions[token]) {
    delete store.sessions[token];
    const dir = dataDir ?? DEFAULT_DATA_DIR;
    await persistIncremental(store, dir, () => {
      opDeleteSession(dir, token);
    });
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
    feed === 'saved'
      ? pool
      : rankVideos(
          pool,
          store.signals,
          Date.now(),
          feed === 'foryou' && userId
            ? buildUserAffinity(store, userId)
            : undefined
        );

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
  let notification: NotificationItem | null = null;
  if (!currentlyFollowing) {
    const actor = actorFromStore(store, followerId);
    if (actor) {
      notification = pushNotification(store, creatorId, {
        type: 'follow',
        ...actor,
      });
    }
  }
  const following = !currentlyFollowing;
  const dir = dataDir ?? DEFAULT_DATA_DIR;
  await persistIncremental(store, dir, () => {
    opToggleFollow(dir, followerId, creatorId, following, notification);
  });
  return { ok: true, following };
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
  dataDir?: string,
  userId?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const store = await ensureStore(dataDir);
  if (!store.videos.some((v) => v.id === videoId)) {
    return { ok: false, error: 'Video not found' };
  }

  const current = store.signals[videoId] ?? { plays: 0, completes: 0 };
  if (type === 'play') current.plays += 1;
  if (type === 'complete') current.completes += 1;
  store.signals[videoId] = current;

  if (userId && type === 'play') {
    const played = new Set(store.playsByUser[userId] ?? []);
    played.add(videoId);
    // Cap recent history so the snapshot stays bounded
    store.playsByUser[userId] = Array.from(played).slice(-200);
  }

  const dir = dataDir ?? DEFAULT_DATA_DIR;
  const playedVideoIds =
    userId && type === 'play' ? store.playsByUser[userId] : undefined;
  await persistIncremental(store, dir, () => {
    opRecordSignal(
      dir,
      videoId,
      current.plays,
      current.completes,
      userId && type === 'play' ? userId : null,
      playedVideoIds
    );
  });
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
  let notification: NotificationItem | null = null;
  if (!currentlyLiked) {
    const actor = actorFromStore(store, userId);
    if (actor) {
      notification = pushNotification(store, video.creator.id, {
        type: 'like',
        ...actor,
        videoId,
      });
    }
  }
  const liked = !currentlyLiked;
  const dir = dataDir ?? DEFAULT_DATA_DIR;
  await persistIncremental(store, dir, () => {
    opToggleLike(dir, userId, videoId, liked, video.stats.likes, notification);
  });

  return { ok: true, liked, likes: video.stats.likes };
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
  const dir = dataDir ?? DEFAULT_DATA_DIR;
  await persistIncremental(store, dir, () => {
    opRecordShare(dir, videoId, video.stats.shares);
  });
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
  const saved = !currentlySaved;
  const dir = dataDir ?? DEFAULT_DATA_DIR;
  await persistIncremental(store, dir, () => {
    opToggleSave(dir, userId, store.savesByUser[userId] ?? []);
  });

  return { ok: true, saved };
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
  const notification = pushNotification(store, video.creator.id, {
    type: 'comment',
    actorId: user.id,
    actorUsername: user.username,
    actorAvatar: user.avatar,
    videoId,
    text: trimmed.slice(0, 80),
  });
  const dir = dataDir ?? DEFAULT_DATA_DIR;
  await persistIncremental(store, dir, () => {
    opAddComment(
      dir,
      videoId,
      comment,
      video.stats.comments,
      notification
    );
  });

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
    status?: Video['status'];
    progressiveSrc?: string;
    id?: string;
  },
  dataDir?: string
): Promise<Video> {
  const store = await ensureStore(dataDir);
  const video: Video = {
    id: input.id ?? newId('v'),
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
    status: input.status ?? 'ready',
    progressiveSrc: input.progressiveSrc,
  };

  store.videos = [video, ...store.videos];
  store.comments[video.id] = [];
  store.signals[video.id] = { plays: 0, completes: 0 };
  const dir = dataDir ?? DEFAULT_DATA_DIR;
  await persistIncremental(store, dir, () => {
    opInsertVideo(dir, video);
  });
  return video;
}

export async function updateVideoPlayback(
  videoId: string,
  patch: {
    src?: string;
    status?: Video['status'];
    progressiveSrc?: string;
  },
  dataDir?: string
): Promise<{ ok: true; video: Video } | { ok: false; error: string }> {
  const store = await ensureStore(dataDir);
  const video = store.videos.find((v) => v.id === videoId);
  if (!video) return { ok: false, error: 'Video not found' };
  if (patch.src !== undefined) video.src = patch.src;
  if (patch.status !== undefined) video.status = patch.status;
  if (patch.progressiveSrc !== undefined) {
    video.progressiveSrc = patch.progressiveSrc;
  }
  const dir = dataDir ?? DEFAULT_DATA_DIR;
  await persistIncremental(store, dir, () => {
    opUpdateVideoFields(dir, videoId, {
      src: patch.src,
      status: patch.status,
      progressiveSrc: patch.progressiveSrc,
    });
  });
  return { ok: true, video };
}

export async function getVideoById(
  videoId: string,
  dataDir?: string
): Promise<Video | null> {
  const store = await ensureStore(dataDir);
  return store.videos.find((v) => v.id === videoId) ?? null;
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
  const dir = dataDir ?? DEFAULT_DATA_DIR;
  await persistIncremental(store, dir, () => {
    opUpdateVideoFields(dir, videoId, { caption: video.caption });
  });
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

  const dir = dataDir ?? DEFAULT_DATA_DIR;
  await persistIncremental(store, dir, () => {
    opDeleteVideo(dir, videoId);
  });
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
    await persistIncremental(store, dataDir ?? DEFAULT_DATA_DIR, () => {
      opMarkNotificationsRead(dataDir ?? DEFAULT_DATA_DIR, userId, ids);
    });
  }
  const unreadCount = list.filter((n) => !n.read).length;
  return { ok: true, unreadCount };
}

const MAX_MESSAGES_PER_THREAD = 200;
const MAX_MESSAGE_LENGTH = 1000;

function sortedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function isParticipant(conv: ConversationRecord, userId: string) {
  return conv.userAId === userId || conv.userBId === userId;
}

function peerIdOf(conv: ConversationRecord, userId: string) {
  return conv.userAId === userId ? conv.userBId : conv.userAId;
}

function unreadInConversation(conv: ConversationRecord, userId: string) {
  const lastRead = conv.lastReadAtByUser[userId] ?? 0;
  return conv.messages.filter(
    (m) => m.senderId !== userId && m.createdAt > lastRead
  ).length;
}

function findConversation(
  store: FeedStoreData,
  userAId: string,
  userBId: string
) {
  const [a, b] = sortedPair(userAId, userBId);
  return store.conversations.find((c) => c.userAId === a && c.userBId === b);
}

function publicPeer(store: FeedStoreData, peerId: string): PublicUser | null {
  const user = store.users.find((u) => u.id === peerId);
  return user ? toPublicUser(user) : null;
}

export async function listConversations(
  userId: string,
  dataDir?: string
): Promise<{ items: ConversationSummary[]; unreadCount: number }> {
  const store = await ensureStore(dataDir);
  const mine = store.conversations
    .filter((c) => isParticipant(c, userId))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const items: ConversationSummary[] = [];
  let unreadCount = 0;
  for (const conv of mine) {
    const peer = publicPeer(store, peerIdOf(conv, userId));
    if (!peer) continue;
    const unread = unreadInConversation(conv, userId);
    unreadCount += unread;
    items.push({
      id: conv.id,
      peer,
      lastMessage: conv.messages[conv.messages.length - 1] ?? null,
      unreadCount: unread,
      updatedAt: conv.updatedAt,
    });
  }
  return { items, unreadCount };
}

export async function getOrCreateConversation(
  userId: string,
  peerId: string,
  dataDir?: string
): Promise<
  | { ok: true; conversation: ConversationSummary }
  | { ok: false; error: string }
> {
  if (!peerId || peerId === userId) {
    return { ok: false, error: 'Invalid peer' };
  }
  const store = await ensureStore(dataDir);
  const me = store.users.find((u) => u.id === userId);
  if (!me || me.isGuest) {
    return { ok: false, error: 'Sign in to message' };
  }
  const peer = publicPeer(store, peerId);
  if (!peer) {
    return { ok: false, error: 'User not found' };
  }

  let conv = findConversation(store, userId, peerId);
  if (!conv) {
    const [a, b] = sortedPair(userId, peerId);
    conv = {
      id: newId('c'),
      userAId: a,
      userBId: b,
      messages: [],
      lastReadAtByUser: { [userId]: Date.now() },
      updatedAt: Date.now(),
    };
    store.conversations.push(conv);
    await persistIncremental(store, dataDir ?? DEFAULT_DATA_DIR, () => {
      opInsertConversation(dataDir ?? DEFAULT_DATA_DIR, conv!);
    });
  }

  return {
    ok: true,
    conversation: {
      id: conv.id,
      peer,
      lastMessage: conv.messages[conv.messages.length - 1] ?? null,
      unreadCount: unreadInConversation(conv, userId),
      updatedAt: conv.updatedAt,
    },
  };
}

export async function listMessages(
  conversationId: string,
  userId: string,
  limit = 50,
  dataDir?: string
): Promise<
  | {
      ok: true;
      conversationId: string;
      peer: PublicUser;
      items: DirectMessage[];
      unreadCount: number;
    }
  | { ok: false; error: string }
> {
  const store = await ensureStore(dataDir);
  const conv = store.conversations.find((c) => c.id === conversationId);
  if (!conv || !isParticipant(conv, userId)) {
    return { ok: false, error: 'Conversation not found' };
  }
  const peer = publicPeer(store, peerIdOf(conv, userId));
  if (!peer) {
    return { ok: false, error: 'Peer not found' };
  }
  const items = conv.messages.slice(-Math.max(1, Math.min(limit, 200)));
  return {
    ok: true,
    conversationId: conv.id,
    peer,
    items,
    unreadCount: unreadInConversation(conv, userId),
  };
}

export async function sendMessage(
  conversationId: string,
  userId: string,
  text: string,
  dataDir?: string
): Promise<
  | { ok: true; message: DirectMessage }
  | { ok: false; error: string }
> {
  const trimmed = text.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!trimmed) {
    return { ok: false, error: 'Empty message' };
  }
  const store = await ensureStore(dataDir);
  const me = store.users.find((u) => u.id === userId);
  if (!me || me.isGuest) {
    return { ok: false, error: 'Sign in to message' };
  }
  const conv = store.conversations.find((c) => c.id === conversationId);
  if (!conv || !isParticipant(conv, userId)) {
    return { ok: false, error: 'Conversation not found' };
  }

  const now = Date.now();
  const message: DirectMessage = {
    id: newId('m'),
    conversationId: conv.id,
    senderId: userId,
    text: trimmed,
    createdAt: now,
  };
  conv.messages.push(message);
  if (conv.messages.length > MAX_MESSAGES_PER_THREAD) {
    conv.messages = conv.messages.slice(-MAX_MESSAGES_PER_THREAD);
  }
  conv.updatedAt = now;
  conv.lastReadAtByUser[userId] = now;
  const peerId = peerIdOf(conv, userId);
  const notified = pushOrCoalesceMessageNotification(store, peerId, {
    actorId: me.id,
    actorUsername: me.username,
    actorAvatar: me.avatar,
    conversationId: conv.id,
    text: trimmed.slice(0, 80),
  });
  const dir = dataDir ?? DEFAULT_DATA_DIR;
  const keptIds = conv.messages.map((m) => m.id);
  await persistIncremental(store, dir, () => {
    opAppendMessage(dir, message, userId, now, keptIds);
    if (notified) {
      if (notified.coalesced) opRefreshNotification(dir, notified.item);
      else opInsertNotification(dir, notified.item);
    }
  });
  publishDirectMessage(message, [conv.userAId, conv.userBId]);
  return { ok: true, message };
}

export async function markConversationRead(
  conversationId: string,
  userId: string,
  dataDir?: string
): Promise<{ ok: true; unreadCount: number } | { ok: false; error: string }> {
  const store = await ensureStore(dataDir);
  const conv = store.conversations.find((c) => c.id === conversationId);
  if (!conv || !isParticipant(conv, userId)) {
    return { ok: false, error: 'Conversation not found' };
  }
  const last = conv.messages[conv.messages.length - 1];
  const stamp = last?.createdAt ?? Date.now();
  const needsConvRead = (conv.lastReadAtByUser[userId] ?? 0) < stamp;
  if (needsConvRead) {
    conv.lastReadAtByUser[userId] = stamp;
  }

  const notes = store.notificationsByUser[userId] ?? [];
  const messageNoteIds: string[] = [];
  for (const item of notes) {
    if (
      item.type === 'message' &&
      item.conversationId === conversationId &&
      !item.read
    ) {
      item.read = true;
      messageNoteIds.push(item.id);
    }
  }
  if (messageNoteIds.length > 0) {
    store.notificationsByUser[userId] = notes;
  }

  if (needsConvRead || messageNoteIds.length > 0) {
    const dir = dataDir ?? DEFAULT_DATA_DIR;
    await persistIncremental(store, dir, () => {
      if (needsConvRead) {
        opMarkConversationRead(dir, conversationId, userId, stamp);
      }
      if (messageNoteIds.length > 0) {
        opMarkNotificationsRead(dir, userId, messageNoteIds);
      }
    });
  }

  return { ok: true, unreadCount: unreadInConversation(conv, userId) };
}
