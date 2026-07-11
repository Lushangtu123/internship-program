/**
 * Normalized SQLite schema + FeedStoreData ↔ rows mapping (experimental).
 * Replaces the single JSON blob snapshot with queryable tables.
 */
import type { Comment, Video } from '@/types/video';
import type { FeedStoreData, NotificationItem } from '@/lib/db/feedStore';

type SqliteStatement = {
  run: (...params: unknown[]) => unknown;
  get: (...params: unknown[]) => unknown;
  all?: (...params: unknown[]) => unknown[];
};

type SqliteDatabase = {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
  close: () => void;
};

/** Ensure relational tables exist (idempotent). */
export function ensureRelationalSchema(db: SqliteDatabase) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      avatar TEXT NOT NULL,
      is_guest INTEGER NOT NULL DEFAULT 1,
      password_hash TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      src TEXT NOT NULL,
      poster TEXT NOT NULL,
      duration REAL NOT NULL,
      caption TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      creator_handle TEXT NOT NULL,
      creator_avatar TEXT NOT NULL,
      creator_name TEXT,
      music_title TEXT NOT NULL,
      music_artist TEXT NOT NULL,
      likes INTEGER NOT NULL DEFAULT 0,
      comments INTEGER NOT NULL DEFAULT 0,
      shares INTEGER NOT NULL DEFAULT 0,
      captions_vtt TEXT,
      status TEXT,
      progressive_src TEXT,
      created_at INTEGER,
      position INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      user_avatar TEXT NOT NULL,
      text TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      likes INTEGER NOT NULL DEFAULT 0,
      parent_id TEXT,
      position INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS likes (
      user_id TEXT NOT NULL,
      video_id TEXT NOT NULL,
      PRIMARY KEY (user_id, video_id)
    );

    CREATE TABLE IF NOT EXISTS saves (
      user_id TEXT NOT NULL,
      video_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY (user_id, video_id)
    );

    CREATE TABLE IF NOT EXISTS follows (
      follower_id TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      PRIMARY KEY (follower_id, creator_id)
    );

    CREATE TABLE IF NOT EXISTS signals (
      video_id TEXT PRIMARY KEY,
      plays INTEGER NOT NULL DEFAULT 0,
      completes INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS plays (
      user_id TEXT NOT NULL,
      video_id TEXT NOT NULL,
      PRIMARY KEY (user_id, video_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_username TEXT NOT NULL,
      actor_avatar TEXT NOT NULL,
      video_id TEXT,
      text TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      position INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_videos_creator ON videos(creator_id);
    CREATE INDEX IF NOT EXISTS idx_comments_video ON comments(video_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  `);
}

function allRows<T>(db: SqliteDatabase, sql: string, ...params: unknown[]): T[] {
  const stmt = db.prepare(sql);
  if (typeof stmt.all === 'function') {
    return stmt.all(...params) as T[];
  }
  // Fallback if StatementSync.all is unavailable — should not happen on Node 22.
  throw new Error('sqlite statement.all is required');
}

export function hasRelationalData(db: SqliteDatabase): boolean {
  try {
    const meta = db
      .prepare(`SELECT value FROM meta WHERE key = 'schema_version'`)
      .get() as { value?: string } | undefined;
    if (meta?.value) return true;
    const videos = db.prepare(`SELECT COUNT(*) AS c FROM videos`).get() as {
      c: number;
    };
    return Number(videos?.c ?? 0) > 0;
  } catch {
    return false;
  }
}

export function loadFeedStoreFromTables(db: SqliteDatabase): FeedStoreData {
  ensureRelationalSchema(db);

  const usersRows = allRows<{
    id: string;
    username: string;
    avatar: string;
    is_guest: number;
    password_hash: string | null;
    created_at: number;
  }>(db, `SELECT * FROM users`);

  const users = usersRows.map((row) => ({
    id: row.id,
    username: row.username,
    avatar: row.avatar,
    isGuest: Boolean(row.is_guest),
    passwordHash: row.password_hash ?? undefined,
    createdAt: row.created_at,
  }));

  const sessionRows = allRows<{
    token: string;
    user_id: string;
    created_at: number;
  }>(db, `SELECT * FROM sessions`);
  const sessions: FeedStoreData['sessions'] = {};
  for (const row of sessionRows) {
    sessions[row.token] = { userId: row.user_id, createdAt: row.created_at };
  }

  const videoRows = allRows<{
    id: string;
    src: string;
    poster: string;
    duration: number;
    caption: string;
    creator_id: string;
    creator_handle: string;
    creator_avatar: string;
    creator_name: string | null;
    music_title: string;
    music_artist: string;
    likes: number;
    comments: number;
    shares: number;
    captions_vtt: string | null;
    status: string | null;
    progressive_src: string | null;
    created_at: number | null;
    position: number;
  }>(db, `SELECT * FROM videos ORDER BY position ASC`);

  const videos: Video[] = videoRows.map((row) => ({
    id: row.id,
    src: row.src,
    poster: row.poster,
    duration: row.duration,
    caption: row.caption,
    creator: {
      id: row.creator_id,
      handle: row.creator_handle,
      avatar: row.creator_avatar,
      name: row.creator_name ?? undefined,
    },
    music: { title: row.music_title, artist: row.music_artist },
    stats: {
      likes: row.likes,
      comments: row.comments,
      shares: row.shares,
    },
    captionsVtt: row.captions_vtt ?? undefined,
    status: (row.status as Video['status']) ?? undefined,
    progressiveSrc: row.progressive_src ?? undefined,
    createdAt: row.created_at ?? undefined,
  }));

  const commentRows = allRows<{
    id: string;
    video_id: string;
    user_id: string;
    username: string;
    user_avatar: string;
    text: string;
    timestamp: number;
    likes: number;
    parent_id: string | null;
    position: number;
  }>(db, `SELECT * FROM comments ORDER BY video_id ASC, position ASC`);

  const comments: FeedStoreData['comments'] = {};
  for (const row of commentRows) {
    const list = comments[row.video_id] ?? [];
    const comment: Comment = {
      id: row.id,
      userId: row.user_id,
      username: row.username,
      userAvatar: row.user_avatar,
      text: row.text,
      timestamp: row.timestamp,
      likes: row.likes,
      parentId: row.parent_id ?? undefined,
    };
    list.push(comment);
    comments[row.video_id] = list;
  }

  const likesByUser: FeedStoreData['likesByUser'] = {};
  for (const row of allRows<{ user_id: string; video_id: string }>(
    db,
    `SELECT * FROM likes`
  )) {
    const list = likesByUser[row.user_id] ?? [];
    list.push(row.video_id);
    likesByUser[row.user_id] = list;
  }

  const savesByUser: FeedStoreData['savesByUser'] = {};
  for (const row of allRows<{
    user_id: string;
    video_id: string;
    position: number;
  }>(db, `SELECT * FROM saves ORDER BY user_id ASC, position ASC`)) {
    const list = savesByUser[row.user_id] ?? [];
    list.push(row.video_id);
    savesByUser[row.user_id] = list;
  }

  const follows: FeedStoreData['follows'] = {};
  for (const row of allRows<{ follower_id: string; creator_id: string }>(
    db,
    `SELECT * FROM follows`
  )) {
    const list = follows[row.follower_id] ?? [];
    list.push(row.creator_id);
    follows[row.follower_id] = list;
  }

  const signals: FeedStoreData['signals'] = {};
  for (const row of allRows<{
    video_id: string;
    plays: number;
    completes: number;
  }>(db, `SELECT * FROM signals`)) {
    signals[row.video_id] = { plays: row.plays, completes: row.completes };
  }

  const playsByUser: FeedStoreData['playsByUser'] = {};
  for (const row of allRows<{ user_id: string; video_id: string }>(
    db,
    `SELECT * FROM plays`
  )) {
    const list = playsByUser[row.user_id] ?? [];
    list.push(row.video_id);
    playsByUser[row.user_id] = list;
  }

  const notificationsByUser: FeedStoreData['notificationsByUser'] = {};
  for (const row of allRows<{
    id: string;
    user_id: string;
    type: string;
    actor_id: string;
    actor_username: string;
    actor_avatar: string;
    video_id: string | null;
    text: string | null;
    read: number;
    created_at: number;
    position: number;
  }>(
    db,
    `SELECT * FROM notifications ORDER BY user_id ASC, position ASC`
  )) {
    const list = notificationsByUser[row.user_id] ?? [];
    const item: NotificationItem = {
      id: row.id,
      userId: row.user_id,
      type: row.type as NotificationItem['type'],
      actorId: row.actor_id,
      actorUsername: row.actor_username,
      actorAvatar: row.actor_avatar,
      videoId: row.video_id ?? undefined,
      text: row.text ?? undefined,
      read: Boolean(row.read),
      createdAt: row.created_at,
    };
    list.push(item);
    notificationsByUser[row.user_id] = list;
  }

  return {
    videos,
    comments,
    users,
    sessions,
    likesByUser,
    savesByUser,
    signals,
    playsByUser,
    follows,
    notificationsByUser,
  };
}

export function saveFeedStoreToTables(db: SqliteDatabase, data: FeedStoreData) {
  ensureRelationalSchema(db);
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      DELETE FROM notifications;
      DELETE FROM plays;
      DELETE FROM signals;
      DELETE FROM follows;
      DELETE FROM saves;
      DELETE FROM likes;
      DELETE FROM comments;
      DELETE FROM videos;
      DELETE FROM sessions;
      DELETE FROM users;
    `);

    const insertUser = db.prepare(
      `INSERT INTO users (id, username, avatar, is_guest, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const user of data.users) {
      insertUser.run(
        user.id,
        user.username,
        user.avatar,
        user.isGuest ? 1 : 0,
        user.passwordHash ?? null,
        user.createdAt
      );
    }

    const insertSession = db.prepare(
      `INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)`
    );
    for (const [token, session] of Object.entries(data.sessions)) {
      insertSession.run(token, session.userId, session.createdAt);
    }

    const insertVideo = db.prepare(
      `INSERT INTO videos (
        id, src, poster, duration, caption,
        creator_id, creator_handle, creator_avatar, creator_name,
        music_title, music_artist,
        likes, comments, shares, captions_vtt, status, progressive_src,
        created_at, position
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    data.videos.forEach((video, position) => {
      insertVideo.run(
        video.id,
        video.src,
        video.poster,
        video.duration,
        video.caption,
        video.creator.id,
        video.creator.handle,
        video.creator.avatar,
        video.creator.name ?? null,
        video.music.title,
        video.music.artist,
        video.stats.likes,
        video.stats.comments,
        video.stats.shares,
        video.captionsVtt ?? null,
        video.status ?? null,
        video.progressiveSrc ?? null,
        video.createdAt ?? null,
        position
      );
    });

    const insertComment = db.prepare(
      `INSERT INTO comments (
        id, video_id, user_id, username, user_avatar, text, timestamp, likes, parent_id, position
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const [videoId, list] of Object.entries(data.comments)) {
      list.forEach((comment, position) => {
        insertComment.run(
          comment.id,
          videoId,
          comment.userId,
          comment.username,
          comment.userAvatar,
          comment.text,
          comment.timestamp,
          comment.likes,
          comment.parentId ?? null,
          position
        );
      });
    }

    const insertLike = db.prepare(
      `INSERT INTO likes (user_id, video_id) VALUES (?, ?)`
    );
    for (const [userId, videoIds] of Object.entries(data.likesByUser)) {
      for (const videoId of videoIds) insertLike.run(userId, videoId);
    }

    const insertSave = db.prepare(
      `INSERT INTO saves (user_id, video_id, position) VALUES (?, ?, ?)`
    );
    for (const [userId, videoIds] of Object.entries(data.savesByUser)) {
      videoIds.forEach((videoId, position) =>
        insertSave.run(userId, videoId, position)
      );
    }

    const insertFollow = db.prepare(
      `INSERT INTO follows (follower_id, creator_id) VALUES (?, ?)`
    );
    for (const [followerId, creatorIds] of Object.entries(data.follows)) {
      for (const creatorId of creatorIds) {
        insertFollow.run(followerId, creatorId);
      }
    }

    const insertSignal = db.prepare(
      `INSERT INTO signals (video_id, plays, completes) VALUES (?, ?, ?)`
    );
    for (const [videoId, signal] of Object.entries(data.signals)) {
      insertSignal.run(videoId, signal.plays, signal.completes);
    }

    const insertPlay = db.prepare(
      `INSERT INTO plays (user_id, video_id) VALUES (?, ?)`
    );
    for (const [userId, videoIds] of Object.entries(data.playsByUser)) {
      for (const videoId of videoIds) insertPlay.run(userId, videoId);
    }

    const insertNotification = db.prepare(
      `INSERT INTO notifications (
        id, user_id, type, actor_id, actor_username, actor_avatar,
        video_id, text, read, created_at, position
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const [userId, list] of Object.entries(data.notificationsByUser)) {
      list.forEach((item, position) => {
        insertNotification.run(
          item.id,
          userId,
          item.type,
          item.actorId,
          item.actorUsername,
          item.actorAvatar,
          item.videoId ?? null,
          item.text ?? null,
          item.read ? 1 : 0,
          item.createdAt,
          position
        );
      });
    }

    db.prepare(
      `INSERT INTO meta (key, value) VALUES ('schema_version', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run('2');
    db.prepare(
      `INSERT INTO meta (key, value) VALUES ('updated_at', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(String(Date.now()));

    db.exec('COMMIT');
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore
    }
    throw error;
  }
}
