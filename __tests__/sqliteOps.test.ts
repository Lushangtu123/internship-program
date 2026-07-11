import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import {
  closeSqliteStore,
  writeSqliteSnapshot,
} from '@/lib/db/sqliteBackend';
import type { FeedStoreData } from '@/lib/db/feedStore';
import {
  countTableRows,
  opAppendMessage,
  opInsertConversation,
  opMarkConversationRead,
  opMarkNotificationsRead,
} from '@/lib/db/sqliteOps';

function emptyStore(): FeedStoreData {
  return {
    videos: [],
    comments: {},
    users: [
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
      },
    ],
    sessions: {},
    likesByUser: { u_1: ['v_1'] },
    savesByUser: {},
    signals: {},
    playsByUser: {},
    follows: {},
    notificationsByUser: {
      u_2: [
        {
          id: 'n_1',
          userId: 'u_2',
          type: 'like',
          actorId: 'u_1',
          actorUsername: 'alice',
          actorAvatar: '/a.png',
          videoId: 'v_1',
          read: false,
          createdAt: 5,
        },
      ],
    },
    conversations: [],
  };
}

describe('sqliteOps incremental writes', () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'sqlite-ops-'));
    const data = emptyStore();
    data.videos.push({
      id: 'v_1',
      src: '/x.mp4',
      poster: '/p.jpg',
      duration: 1,
      creator: { id: 'u_1', handle: '@alice', avatar: '/a.png' },
      caption: 'hi',
      music: { title: 't', artist: 'a' },
      stats: { likes: 1, comments: 0, shares: 0 },
    });
    writeSqliteSnapshot(dataDir, data);
    closeSqliteStore(dataDir);
  });

  afterEach(async () => {
    closeSqliteStore(dataDir);
    await rm(dataDir, { recursive: true, force: true });
  });

  it('appends messages without wiping likes', async () => {
    const likesBefore = countTableRows(dataDir, 'likes');
    expect(likesBefore).toBe(1);

    opInsertConversation(dataDir, {
      id: 'c_1',
      userAId: 'u_1',
      userBId: 'u_2',
      messages: [],
      lastReadAtByUser: { u_1: 1 },
      updatedAt: 1,
    });
    opAppendMessage(
      dataDir,
      {
        id: 'm_1',
        conversationId: 'c_1',
        senderId: 'u_1',
        text: 'hello',
        createdAt: 2,
      },
      'u_1',
      2,
      ['m_1']
    );
    opMarkConversationRead(dataDir, 'c_1', 'u_2', 2);
    opMarkNotificationsRead(dataDir, 'u_2');

    expect(countTableRows(dataDir, 'likes')).toBe(likesBefore);
    expect(countTableRows(dataDir, 'messages')).toBe(1);
    expect(countTableRows(dataDir, 'conversations')).toBe(1);

    const { readSqliteSnapshot } = await import('@/lib/db/sqliteBackend');
    const loaded = readSqliteSnapshot(dataDir);
    expect(loaded?.conversations[0]?.messages[0]?.text).toBe('hello');
    expect(loaded?.notificationsByUser.u_2?.[0]?.read).toBe(true);
    expect(loaded?.likesByUser.u_1).toEqual(['v_1']);
  });
});
