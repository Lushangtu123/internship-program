/**
 * Experimental SQLite backing for FeedStoreData.
 * Keeps the in-memory document model, but persists atomically via WAL SQLite
 * instead of rewriting store.json (safer under concurrent API writes).
 */
import { createRequire } from 'module';
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync } from 'fs';
import path from 'path';
import type { FeedStoreData } from '@/lib/db/feedStore';

const require = createRequire(__filename);
// Node 22+ built-in; createRequire keeps Vitest/Webpack from rewriting the id.
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => SqliteDatabase;
};

interface SqliteStatement {
  run: (...params: unknown[]) => unknown;
  get: (...params: unknown[]) => unknown;
}

interface SqliteDatabase {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
  close: () => void;
}

const STORE_FILE = 'store.sqlite';
const LEGACY_JSON = 'store.json';

const connections = new Map<string, SqliteDatabase>();

function dbPath(dataDir: string) {
  return path.join(dataDir, STORE_FILE);
}

function legacyJsonPath(dataDir: string) {
  return path.join(dataDir, LEGACY_JSON);
}

export function openSqliteStore(dataDir: string): SqliteDatabase {
  const key = path.resolve(dataDir);
  const existing = connections.get(key);
  if (existing) return existing;

  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(dbPath(dataDir));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS store_snapshot (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  connections.set(key, db);
  return db;
}

export function closeSqliteStore(dataDir?: string) {
  if (!dataDir) {
    for (const [key, db] of connections) {
      try {
        db.close();
      } catch {
        // already closed
      }
      connections.delete(key);
    }
    return;
  }
  const key = path.resolve(dataDir);
  const db = connections.get(key);
  if (!db) return;
  try {
    db.close();
  } catch {
    // ignore
  }
  connections.delete(key);
}

export function readSqliteSnapshot(dataDir: string): FeedStoreData | null {
  const db = openSqliteStore(dataDir);
  const row = db
    .prepare('SELECT payload FROM store_snapshot WHERE id = 1')
    .get() as { payload: string } | undefined;
  if (!row?.payload) return null;
  return JSON.parse(row.payload) as FeedStoreData;
}

export function writeSqliteSnapshot(dataDir: string, data: FeedStoreData) {
  const db = openSqliteStore(dataDir);
  const payload = JSON.stringify(data);
  const now = Date.now();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(
      `INSERT INTO store_snapshot (id, payload, updated_at)
       VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         payload = excluded.payload,
         updated_at = excluded.updated_at`
    ).run(payload, now);
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

/** Import legacy store.json once, then rename it out of the way. */
export function migrateLegacyJsonIfNeeded(dataDir: string): FeedStoreData | null {
  const jsonPath = legacyJsonPath(dataDir);
  if (!existsSync(jsonPath)) return null;
  if (readSqliteSnapshot(dataDir)) return null;

  const raw = readFileSync(jsonPath, 'utf-8');
  const parsed = JSON.parse(raw) as FeedStoreData;
  writeSqliteSnapshot(dataDir, parsed);
  try {
    renameSync(jsonPath, `${jsonPath}.migrated`);
  } catch {
    try {
      unlinkSync(jsonPath);
    } catch {
      // keep both if rename/unlink fails
    }
  }
  return parsed;
}

export function sqliteStorePath(dataDir: string) {
  return dbPath(dataDir);
}
