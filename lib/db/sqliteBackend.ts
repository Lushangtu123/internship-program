/**
 * Experimental SQLite backing for FeedStoreData.
 * Normalized relational tables (v2) with one-time migration from:
 * - legacy store.json
 * - v1 store_snapshot JSON blob
 */
import { createRequire } from 'module';
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync } from 'fs';
import path from 'path';
import type { FeedStoreData } from '@/lib/db/feedStore';
import {
  ensureRelationalSchema,
  hasRelationalData,
  loadFeedStoreFromTables,
  saveFeedStoreToTables,
} from '@/lib/db/sqliteRelStore';

const require = createRequire(__filename);
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => SqliteDatabase;
};

interface SqliteStatement {
  run: (...params: unknown[]) => unknown;
  get: (...params: unknown[]) => unknown;
  all?: (...params: unknown[]) => unknown[];
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
  ensureRelationalSchema(db);
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

function readBlobSnapshot(db: SqliteDatabase): FeedStoreData | null {
  const row = db
    .prepare('SELECT payload FROM store_snapshot WHERE id = 1')
    .get() as { payload: string } | undefined;
  if (!row?.payload) return null;
  return JSON.parse(row.payload) as FeedStoreData;
}

function clearBlobSnapshot(db: SqliteDatabase) {
  try {
    db.prepare('DELETE FROM store_snapshot').run();
  } catch {
    // ignore
  }
}

/** Load store: prefer normalized tables, else migrate v1 blob → tables. */
export function readSqliteSnapshot(dataDir: string): FeedStoreData | null {
  const db = openSqliteStore(dataDir);

  if (hasRelationalData(db)) {
    return loadFeedStoreFromTables(db);
  }

  const blob = readBlobSnapshot(db);
  if (blob) {
    saveFeedStoreToTables(db, blob);
    clearBlobSnapshot(db);
    return loadFeedStoreFromTables(db);
  }

  return null;
}

/** Persist store into normalized tables (transactional). */
export function writeSqliteSnapshot(dataDir: string, data: FeedStoreData) {
  const db = openSqliteStore(dataDir);
  saveFeedStoreToTables(db, data);
  clearBlobSnapshot(db);
}

/** Import legacy store.json once, then rename it out of the way. */
export function migrateLegacyJsonIfNeeded(dataDir: string): FeedStoreData | null {
  const jsonPath = legacyJsonPath(dataDir);
  if (!existsSync(jsonPath)) return null;

  const db = openSqliteStore(dataDir);
  if (hasRelationalData(db) || readBlobSnapshot(db)) return null;

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
