import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, access } from 'fs/promises';
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

  it('round-trips a snapshot through SQLite', () => {
    const data = emptyStore();
    data.users.push({
      id: 'u_1',
      username: 'alice',
      avatar: '/a.png',
      isGuest: false,
      createdAt: 1,
    });
    writeSqliteSnapshot(dataDir, data);
    closeSqliteStore(dataDir);

    const loaded = readSqliteSnapshot(dataDir);
    expect(loaded?.users[0]?.username).toBe('alice');
    expect(sqliteStorePath(dataDir).endsWith('store.sqlite')).toBe(true);
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

    // second call should no-op (sqlite already filled)
    expect(migrateLegacyJsonIfNeeded(dataDir)).toBeNull();

    await expect(
      access(path.join(dataDir, 'store.json.migrated'))
    ).resolves.toBeUndefined();
  });
});
