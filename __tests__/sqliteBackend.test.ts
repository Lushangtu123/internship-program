import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, access } from 'fs/promises';
import { mkdirSync } from 'fs';
import { createRequire } from 'module';
import { tmpdir } from 'os';
import path from 'path';
import {
  closeSqliteStore,
  migrateLegacyJsonIfNeeded,
  readSqliteSnapshot,
  sqliteStorePath,
  writeSqliteSnapshot,
} from '@/lib/db/sqliteBackend';
import type { FeedStoreData } from '@/lib/db/feedStore';

const require = createRequire(__filename);
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec: (sql: string) => void;
    prepare: (sql: string) => {
      run: (...args: unknown[]) => unknown;
    };
    close: () => void;
  };
};

function emptyStore(): FeedStoreData {
  return {
    videos: [],
    comments: {},
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

describe('sqliteBackend', () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'sqlite-store-'));
  });

  afterEach(async () => {
    closeSqliteStore(dataDir);
    await rm(dataDir, { recursive: true, force: true });
  });

  it('round-trips a snapshot through relational tables', () => {
    const data = emptyStore();
    data.users.push({
      id: 'u_1',
      username: 'alice',
      avatar: '/a.png',
      isGuest: false,
      createdAt: 1,
    });
    data.videos.push({
      id: 'v_1',
      src: '/x.mp4',
      poster: '/p.jpg',
      duration: 3,
      creator: { id: 'u_1', handle: '@alice', avatar: '/a.png' },
      caption: 'hello',
      music: { title: 't', artist: 'a' },
      stats: { likes: 1, comments: 0, shares: 0 },
    });
    data.likesByUser.u_1 = ['v_1'];
    writeSqliteSnapshot(dataDir, data);
    closeSqliteStore(dataDir);

    const loaded = readSqliteSnapshot(dataDir);
    expect(loaded?.users[0]?.username).toBe('alice');
    expect(loaded?.videos[0]?.caption).toBe('hello');
    expect(loaded?.likesByUser.u_1).toEqual(['v_1']);
    expect(sqliteStorePath(dataDir).endsWith('store.sqlite')).toBe(true);
  });

  it('migrates v1 JSON blob snapshot into relational tables', () => {
    const data = emptyStore();
    data.videos.push({
      id: 'v_blob',
      src: '/x.mp4',
      poster: '/p.jpg',
      duration: 1,
      creator: { id: 'u', handle: '@u', avatar: '/a.png' },
      caption: 'from-blob',
      music: { title: 't', artist: 'a' },
      stats: { likes: 0, comments: 0, shares: 0 },
    });

    mkdirSync(dataDir, { recursive: true });
    const db = new DatabaseSync(sqliteStorePath(dataDir));
    db.exec(`
      CREATE TABLE IF NOT EXISTS store_snapshot (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        payload TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    db.prepare(
      `INSERT INTO store_snapshot (id, payload, updated_at) VALUES (1, ?, ?)`
    ).run(JSON.stringify(data), Date.now());
    db.close();

    const loaded = readSqliteSnapshot(dataDir);
    expect(loaded?.videos[0]?.caption).toBe('from-blob');
    closeSqliteStore(dataDir);
    const again = readSqliteSnapshot(dataDir);
    expect(again?.videos[0]?.id).toBe('v_blob');
  });

  it('migrates legacy store.json once', async () => {
    const legacy = emptyStore();
    legacy.videos = [
      {
        id: 'v_legacy',
        src: '/x.mp4',
        poster: '/p.jpg',
        duration: 1,
        creator: { id: 'u', handle: '@u', avatar: '/a.png' },
        caption: 'legacy',
        music: { title: 't', artist: 'a' },
        stats: { likes: 0, comments: 0, shares: 0 },
      },
    ];
    await writeFile(
      path.join(dataDir, 'store.json'),
      JSON.stringify(legacy),
      'utf-8'
    );

    const migrated = migrateLegacyJsonIfNeeded(dataDir);
    expect(migrated?.videos[0]?.id).toBe('v_legacy');
    expect(readSqliteSnapshot(dataDir)?.videos[0]?.caption).toBe('legacy');

    expect(migrateLegacyJsonIfNeeded(dataDir)).toBeNull();

    await expect(
      access(path.join(dataDir, 'store.json.migrated'))
    ).resolves.toBeUndefined();
  });

  it('round-trips conversations and messages', () => {
    const data = emptyStore();
    data.users.push(
      {
        id: 'u_1',
        username: 'alice',
        avatar: '/a.png',
        isGuest: false,
        createdAt: 1,
      },
      {
        id: 'u_2',
        username: 'bob',
        avatar: '/b.png',
        isGuest: false,
        createdAt: 2,
      }
    );
    data.conversations.push({
      id: 'c_1',
      userAId: 'u_1',
      userBId: 'u_2',
      messages: [
        {
          id: 'm_1',
          conversationId: 'c_1',
          senderId: 'u_1',
          text: 'hi',
          createdAt: 10,
        },
      ],
      lastReadAtByUser: { u_1: 10 },
      updatedAt: 10,
    });
    writeSqliteSnapshot(dataDir, data);
    closeSqliteStore(dataDir);

    const loaded = readSqliteSnapshot(dataDir);
    expect(loaded?.conversations).toHaveLength(1);
    expect(loaded?.conversations[0]?.messages[0]?.text).toBe('hi');
    expect(loaded?.conversations[0]?.lastReadAtByUser.u_1).toBe(10);
  });
});
