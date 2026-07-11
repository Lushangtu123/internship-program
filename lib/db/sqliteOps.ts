/**
 * Incremental SQLite writes for hot paths (experimental).
 * Avoids full DELETE+reinsert snapshot on engagement / DM / notification-read.
 */
import type {
  ConversationRecord,
  DirectMessage,
  NotificationItem,
} from '@/lib/db/feedStore';
import type { Comment, Video } from '@/types/video';
import { openSqliteStore } from '@/lib/db/sqliteBackend';
import { ensureRelationalSchema } from '@/lib/db/sqliteRelStore';

type SqliteStatement = {
  run: (...params: unknown[]) => unknown;
  get: (...params: unknown[]) => unknown;
};

type SqliteDatabase = {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
};

function stampUpdatedAt(db: SqliteDatabase) {
  db.prepare(
    `INSERT INTO meta (key, value) VALUES ('updated_at', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(Date.now()));
}

function withTxn(dataDir: string, fn: (db: SqliteDatabase) => void) {
  const db = openSqliteStore(dataDir);
  ensureRelationalSchema(db);
  db.exec('BEGIN IMMEDIATE');
  try {
    fn(db);
    stampUpdatedAt(db);
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

function insertNotificationRow(db: SqliteDatabase, item: NotificationItem) {
  db.prepare(
    `UPDATE notifications SET position = position + 1 WHERE user_id = ?`
  ).run(item.userId);
  db.prepare(
    `INSERT INTO notifications (
      id, user_id, type, actor_id, actor_username, actor_avatar,
      video_id, conversation_id, text, read, created_at, position
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
  ).run(
    item.id,
    item.userId,
    item.type,
    item.actorId,
    item.actorUsername,
    item.actorAvatar,
    item.videoId ?? null,
    item.conversationId ?? null,
    item.text ?? null,
    item.read ? 1 : 0,
    item.createdAt
  );
  db.prepare(
    `DELETE FROM notifications WHERE user_id = ? AND position >= 100`
  ).run(item.userId);
}

/** Insert a new 1:1 conversation + initial read cursor. */
export function opInsertConversation(
  dataDir: string,
  conv: ConversationRecord
) {
  withTxn(dataDir, (db) => {
    db.prepare(
      `INSERT INTO conversations (id, user_a_id, user_b_id, updated_at)
       VALUES (?, ?, ?, ?)`
    ).run(conv.id, conv.userAId, conv.userBId, conv.updatedAt);

    const insertRead = db.prepare(
      `INSERT INTO conversation_reads (conversation_id, user_id, last_read_at)
       VALUES (?, ?, ?)
       ON CONFLICT(conversation_id, user_id) DO UPDATE SET
         last_read_at = excluded.last_read_at`
    );
    for (const [userId, lastReadAt] of Object.entries(
      conv.lastReadAtByUser ?? {}
    )) {
      insertRead.run(conv.id, userId, lastReadAt);
    }
  });
}

/** Append one message; sync conversation updated_at + sender read cursor. */
export function opAppendMessage(
  dataDir: string,
  message: DirectMessage,
  senderId: string,
  updatedAt: number,
  keptMessageIds?: string[]
) {
  withTxn(dataDir, (db) => {
    const countRow = db
      .prepare(
        `SELECT COUNT(*) AS c FROM messages WHERE conversation_id = ?`
      )
      .get(message.conversationId) as { c: number } | undefined;
    const position = Number(countRow?.c ?? 0);

    db.prepare(
      `INSERT INTO messages (
        id, conversation_id, sender_id, text, created_at, position
      ) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      message.id,
      message.conversationId,
      message.senderId,
      message.text,
      message.createdAt,
      position
    );

    db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(
      updatedAt,
      message.conversationId
    );

    db.prepare(
      `INSERT INTO conversation_reads (conversation_id, user_id, last_read_at)
       VALUES (?, ?, ?)
       ON CONFLICT(conversation_id, user_id) DO UPDATE SET
         last_read_at = excluded.last_read_at`
    ).run(message.conversationId, senderId, message.createdAt);

    if (keptMessageIds && keptMessageIds.length > 0) {
      const placeholders = keptMessageIds.map(() => '?').join(',');
      db.prepare(
        `DELETE FROM messages
         WHERE conversation_id = ?
           AND id NOT IN (${placeholders})`
      ).run(message.conversationId, ...keptMessageIds);
    }
  });
}

export function opMarkConversationRead(
  dataDir: string,
  conversationId: string,
  userId: string,
  lastReadAt: number
) {
  const db = openSqliteStore(dataDir);
  ensureRelationalSchema(db);
  db.prepare(
    `INSERT INTO conversation_reads (conversation_id, user_id, last_read_at)
     VALUES (?, ?, ?)
     ON CONFLICT(conversation_id, user_id) DO UPDATE SET
       last_read_at = excluded.last_read_at`
  ).run(conversationId, userId, lastReadAt);
  stampUpdatedAt(db);
}

export function opMarkNotificationsRead(
  dataDir: string,
  userId: string,
  ids?: string[]
) {
  const db = openSqliteStore(dataDir);
  ensureRelationalSchema(db);
  if (ids && ids.length > 0) {
    const stmt = db.prepare(
      `UPDATE notifications SET read = 1
       WHERE user_id = ? AND id = ? AND read = 0`
    );
    for (const id of ids) stmt.run(userId, id);
  } else {
    db.prepare(
      `UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0`
    ).run(userId);
  }
  stampUpdatedAt(db);
}

export function opInsertNotification(
  dataDir: string,
  item: NotificationItem
) {
  withTxn(dataDir, (db) => {
    insertNotificationRow(db, item);
  });
}

/** Delete + reinsert at front (coalesced unread DM preview refresh). */
export function opRefreshNotification(
  dataDir: string,
  item: NotificationItem
) {
  withTxn(dataDir, (db) => {
    db.prepare(`DELETE FROM notifications WHERE id = ?`).run(item.id);
    insertNotificationRow(db, item);
  });
}

export function opToggleLike(
  dataDir: string,
  userId: string,
  videoId: string,
  liked: boolean,
  likesCount: number,
  notification?: NotificationItem | null
) {
  withTxn(dataDir, (db) => {
    if (liked) {
      db.prepare(
        `INSERT OR IGNORE INTO likes (user_id, video_id) VALUES (?, ?)`
      ).run(userId, videoId);
    } else {
      db.prepare(`DELETE FROM likes WHERE user_id = ? AND video_id = ?`).run(
        userId,
        videoId
      );
    }
    db.prepare(`UPDATE videos SET likes = ? WHERE id = ?`).run(
      likesCount,
      videoId
    );
    if (notification) insertNotificationRow(db, notification);
  });
}

export function opToggleFollow(
  dataDir: string,
  followerId: string,
  creatorId: string,
  following: boolean,
  notification?: NotificationItem | null
) {
  withTxn(dataDir, (db) => {
    if (following) {
      db.prepare(
        `INSERT OR IGNORE INTO follows (follower_id, creator_id) VALUES (?, ?)`
      ).run(followerId, creatorId);
    } else {
      db.prepare(
        `DELETE FROM follows WHERE follower_id = ? AND creator_id = ?`
      ).run(followerId, creatorId);
    }
    if (notification) insertNotificationRow(db, notification);
  });
}

export function opToggleSave(
  dataDir: string,
  userId: string,
  savedVideoIds: string[]
) {
  withTxn(dataDir, (db) => {
    db.prepare(`DELETE FROM saves WHERE user_id = ?`).run(userId);
    const insert = db.prepare(
      `INSERT INTO saves (user_id, video_id, position) VALUES (?, ?, ?)`
    );
    savedVideoIds.forEach((id, position) => insert.run(userId, id, position));
  });
}

export function opAddComment(
  dataDir: string,
  videoId: string,
  comment: Comment,
  commentsCount: number,
  notification?: NotificationItem | null
) {
  withTxn(dataDir, (db) => {
    db.prepare(
      `UPDATE comments SET position = position + 1 WHERE video_id = ?`
    ).run(videoId);
    db.prepare(
      `INSERT INTO comments (
        id, video_id, user_id, username, user_avatar, text, timestamp, likes, parent_id, position
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
    ).run(
      comment.id,
      videoId,
      comment.userId,
      comment.username,
      comment.userAvatar,
      comment.text,
      comment.timestamp,
      comment.likes,
      comment.parentId ?? null
    );
    db.prepare(`UPDATE videos SET comments = ? WHERE id = ?`).run(
      commentsCount,
      videoId
    );
    if (notification) insertNotificationRow(db, notification);
  });
}

export function opRecordSignal(
  dataDir: string,
  videoId: string,
  plays: number,
  completes: number,
  userId?: string | null,
  playedVideoIds?: string[]
) {
  withTxn(dataDir, (db) => {
    db.prepare(
      `INSERT INTO signals (video_id, plays, completes) VALUES (?, ?, ?)
       ON CONFLICT(video_id) DO UPDATE SET
         plays = excluded.plays,
         completes = excluded.completes`
    ).run(videoId, plays, completes);

    if (userId && playedVideoIds) {
      db.prepare(`DELETE FROM plays WHERE user_id = ?`).run(userId);
      const insert = db.prepare(
        `INSERT INTO plays (user_id, video_id) VALUES (?, ?)`
      );
      for (const id of playedVideoIds) insert.run(userId, id);
    }
  });
}

export function opRecordShare(
  dataDir: string,
  videoId: string,
  shares: number
) {
  const db = openSqliteStore(dataDir);
  ensureRelationalSchema(db);
  db.prepare(`UPDATE videos SET shares = ? WHERE id = ?`).run(
    shares,
    videoId
  );
  stampUpdatedAt(db);
}

export type StoredUserRow = {
  id: string;
  username: string;
  avatar: string;
  isGuest: boolean;
  passwordHash?: string;
  createdAt: number;
};

export function opInsertUser(dataDir: string, user: StoredUserRow) {
  withTxn(dataDir, (db) => {
    db.prepare(
      `INSERT INTO users (id, username, avatar, is_guest, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      user.id,
      user.username,
      user.avatar,
      user.isGuest ? 1 : 0,
      user.passwordHash ?? null,
      user.createdAt
    );
  });
}

export function opUpdateUser(dataDir: string, user: StoredUserRow) {
  withTxn(dataDir, (db) => {
    db.prepare(
      `UPDATE users
       SET username = ?, avatar = ?, is_guest = ?, password_hash = ?
       WHERE id = ?`
    ).run(
      user.username,
      user.avatar,
      user.isGuest ? 1 : 0,
      user.passwordHash ?? null,
      user.id
    );
  });
}

export function opInsertSession(
  dataDir: string,
  token: string,
  userId: string,
  createdAt: number
) {
  const db = openSqliteStore(dataDir);
  ensureRelationalSchema(db);
  db.prepare(
    `INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)`
  ).run(token, userId, createdAt);
  stampUpdatedAt(db);
}

export function opDeleteSession(dataDir: string, token: string) {
  const db = openSqliteStore(dataDir);
  ensureRelationalSchema(db);
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
  stampUpdatedAt(db);
}

/** Register upgrade: update user row, insert session, refresh denormalized names. */
export function opRegisterUpgrade(
  dataDir: string,
  user: StoredUserRow,
  token: string,
  sessionCreatedAt: number
) {
  withTxn(dataDir, (db) => {
    db.prepare(
      `UPDATE users
       SET username = ?, avatar = ?, is_guest = ?, password_hash = ?
       WHERE id = ?`
    ).run(
      user.username,
      user.avatar,
      user.isGuest ? 1 : 0,
      user.passwordHash ?? null,
      user.id
    );
    db.prepare(
      `INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)`
    ).run(token, user.id, sessionCreatedAt);

    const handle = `@${user.username}`;
    db.prepare(
      `UPDATE videos
       SET creator_handle = ?, creator_name = ?, creator_avatar = ?, music_artist = ?
       WHERE creator_id = ?`
    ).run(handle, user.username, user.avatar, user.username, user.id);
    db.prepare(
      `UPDATE comments SET username = ?, user_avatar = ? WHERE user_id = ?`
    ).run(user.username, user.avatar, user.id);
    db.prepare(
      `UPDATE notifications
       SET actor_username = ?, actor_avatar = ?
       WHERE actor_id = ?`
    ).run(user.username, user.avatar, user.id);
  });
}

export function opInsertUserWithSession(
  dataDir: string,
  user: StoredUserRow,
  token: string,
  sessionCreatedAt: number
) {
  withTxn(dataDir, (db) => {
    db.prepare(
      `INSERT INTO users (id, username, avatar, is_guest, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      user.id,
      user.username,
      user.avatar,
      user.isGuest ? 1 : 0,
      user.passwordHash ?? null,
      user.createdAt
    );
    db.prepare(
      `INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)`
    ).run(token, user.id, sessionCreatedAt);
  });
}

export function opInsertVideo(dataDir: string, video: Video) {
  withTxn(dataDir, (db) => {
    db.prepare(`UPDATE videos SET position = position + 1`).run();
    db.prepare(
      `INSERT INTO videos (
        id, src, poster, duration, caption,
        creator_id, creator_handle, creator_avatar, creator_name,
        music_title, music_artist,
        likes, comments, shares, captions_vtt, status, progressive_src,
        created_at, position
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
    ).run(
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
      video.createdAt ?? null
    );
    db.prepare(
      `INSERT INTO signals (video_id, plays, completes) VALUES (?, 0, 0)
       ON CONFLICT(video_id) DO NOTHING`
    ).run(video.id);
  });
}

export function opUpdateVideoFields(
  dataDir: string,
  videoId: string,
  patch: {
    src?: string;
    status?: string | null;
    progressiveSrc?: string | null;
    caption?: string;
  }
) {
  withTxn(dataDir, (db) => {
    if (patch.src !== undefined) {
      db.prepare(`UPDATE videos SET src = ? WHERE id = ?`).run(
        patch.src,
        videoId
      );
    }
    if (patch.status !== undefined) {
      db.prepare(`UPDATE videos SET status = ? WHERE id = ?`).run(
        patch.status,
        videoId
      );
    }
    if (patch.progressiveSrc !== undefined) {
      db.prepare(`UPDATE videos SET progressive_src = ? WHERE id = ?`).run(
        patch.progressiveSrc,
        videoId
      );
    }
    if (patch.caption !== undefined) {
      db.prepare(`UPDATE videos SET caption = ? WHERE id = ?`).run(
        patch.caption,
        videoId
      );
    }
  });
}

export function opDeleteVideo(dataDir: string, videoId: string) {
  withTxn(dataDir, (db) => {
    db.prepare(`DELETE FROM comments WHERE video_id = ?`).run(videoId);
    db.prepare(`DELETE FROM likes WHERE video_id = ?`).run(videoId);
    db.prepare(`DELETE FROM saves WHERE video_id = ?`).run(videoId);
    db.prepare(`DELETE FROM signals WHERE video_id = ?`).run(videoId);
    db.prepare(`DELETE FROM plays WHERE video_id = ?`).run(videoId);
    db.prepare(`DELETE FROM notifications WHERE video_id = ?`).run(videoId);
    db.prepare(`DELETE FROM videos WHERE id = ?`).run(videoId);
  });
}

/** Test helper: count rows without loading the full store. */
export function countTableRows(dataDir: string, table: string): number {
  const allowed = new Set([
    'users',
    'videos',
    'likes',
    'saves',
    'follows',
    'comments',
    'messages',
    'notifications',
    'conversations',
    'signals',
    'plays',
    'sessions',
  ]);
  if (!allowed.has(table)) {
    throw new Error(`table not allowed: ${table}`);
  }
  const db = openSqliteStore(dataDir);
  ensureRelationalSchema(db);
  const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as {
    c: number;
  };
  return Number(row?.c ?? 0);
}
