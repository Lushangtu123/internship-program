/**
 * Incremental SQLite writes for hot paths (experimental).
 * Avoids full DELETE+reinsert snapshot on every DM / notification-read.
 */
import type { ConversationRecord, DirectMessage } from '@/lib/db/feedStore';
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

/** Insert a new 1:1 conversation + initial read cursor. */
export function opInsertConversation(
  dataDir: string,
  conv: ConversationRecord
) {
  const db = openSqliteStore(dataDir);
  ensureRelationalSchema(db);
  db.exec('BEGIN IMMEDIATE');
  try {
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

/** Append one message; sync conversation updated_at + sender read cursor. */
export function opAppendMessage(
  dataDir: string,
  message: DirectMessage,
  senderId: string,
  updatedAt: number,
  keptMessageIds?: string[]
) {
  const db = openSqliteStore(dataDir);
  ensureRelationalSchema(db);
  db.exec('BEGIN IMMEDIATE');
  try {
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

/** Test helper: count rows without loading the full store. */
export function countTableRows(dataDir: string, table: string): number {
  const allowed = new Set([
    'users',
    'videos',
    'likes',
    'messages',
    'notifications',
    'conversations',
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
