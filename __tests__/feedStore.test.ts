import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import {
  addComment,
  createGuestUser,
  createVideo,
  listComments,
  listVideos,
  loginUser,
  recordSignal,
  registerUser,
  resetStoreCache,
  toggleLike,
} from '@/lib/db/feedStore';

describe('feedStore identity + persistence', () => {
  let dataDir: string;

  beforeEach(async () => {
    resetStoreCache();
    dataDir = await mkdtemp(path.join(tmpdir(), 'feed-store-'));
  });

  afterEach(async () => {
    resetStoreCache();
    await rm(dataDir, { recursive: true, force: true });
  });

  it('lists videos with cursor pagination from seed', async () => {
    const page1 = await listVideos(null, 2, null, dataDir);
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = await listVideos(page1.nextCursor, 2, null, dataDir);
    expect(page2.items[0].id).not.toBe(page1.items[0].id);
  });

  it('keeps likes per user', async () => {
    const a = await createGuestUser(dataDir);
    const b = await createGuestUser(dataDir);

    const liked = await toggleLike('v_001', a.user.id, dataDir);
    expect(liked.ok && liked.liked).toBe(true);

    const forA = await listVideos(null, 50, a.user.id, dataDir);
    const forB = await listVideos(null, 50, b.user.id, dataDir);
    expect(forA.items.find((v) => v.id === 'v_001')?.liked).toBe(true);
    expect(forB.items.find((v) => v.id === 'v_001')?.liked).toBe(false);

    resetStoreCache();
    const forAAgain = await listVideos(null, 50, a.user.id, dataDir);
    expect(forAAgain.items.find((v) => v.id === 'v_001')?.liked).toBe(true);

    const raw = await readFile(path.join(dataDir, 'store.json'), 'utf-8');
    expect(raw).toContain(a.user.id);
  });

  it('attaches comment author from the acting user', async () => {
    const registered = await registerUser('alice', 'secret12', dataDir);
    expect('user' in registered).toBe(true);
    if (!('user' in registered)) return;

    const created = await addComment(
      'v_001',
      'hello from alice',
      registered.user,
      dataDir
    );
    expect('id' in created).toBe(true);
    if (!('id' in created)) return;
    expect(created.username).toBe('alice');
    expect(created.userId).toBe(registered.user.id);

    const listed = await listComments('v_001', null, 20, dataDir);
    expect('items' in listed && listed.items[0].username).toBe('alice');
  });

  it('registers and logs in with password', async () => {
    const created = await registerUser('bob', 'secret12', dataDir);
    expect('token' in created).toBe(true);

    const loggedIn = await loginUser('bob', 'secret12', dataDir);
    expect('user' in loggedIn && loggedIn.user.username).toBe('bob');
    expect('user' in loggedIn && loggedIn.user.isGuest).toBe(false);

    const bad = await loginUser('bob', 'wrong-password', dataDir);
    expect(bad).toMatchObject({ status: 401 });
  });

  it('rejects empty comments', async () => {
    const guest = await createGuestUser(dataDir);
    const result = await addComment('v_001', '   ', guest.user, dataDir);
    expect(result).toMatchObject({ status: 400 });
  });

  it('prepends an uploaded video for the acting user', async () => {
    const guest = await createGuestUser(dataDir);
    const video = await createVideo(
      {
        src: '/uploads/videos/demo.webm',
        poster: '/uploads/posters/demo.jpg',
        duration: 3.5,
        caption: 'my upload',
        user: guest.user,
      },
      dataDir
    );
    expect(video.creator.handle).toBe(`@${guest.user.username}`);
    const page = await listVideos(null, 50, guest.user.id, dataDir);
    const found = page.items.find((item) => item.id === video.id);
    expect(found?.caption).toBe('my upload');
  });

  it('orders the feed by engagement score not insert order', async () => {
    const guest = await createGuestUser(dataDir);
    const olderHot = await createVideo(
      {
        src: '/uploads/videos/a.webm',
        poster: '/uploads/posters/a.jpg',
        duration: 3,
        caption: 'hot older',
        user: guest.user,
      },
      dataDir
    );
    const quietNewer = await createVideo(
      {
        src: '/uploads/videos/b.webm',
        poster: '/uploads/posters/b.jpg',
        duration: 3,
        caption: 'quiet newer',
        user: guest.user,
      },
      dataDir
    );

    for (let i = 0; i < 20; i++) {
      await recordSignal(olderHot.id, 'play', dataDir);
      await recordSignal(olderHot.id, 'complete', dataDir);
    }
    await toggleLike(olderHot.id, guest.user.id, dataDir);

    const page = await listVideos(null, 50, guest.user.id, dataDir);
    const ids = page.items.map((item) => item.id);
    expect(ids.indexOf(olderHot.id)).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf(quietNewer.id)).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf(olderHot.id)).toBeLessThan(ids.indexOf(quietNewer.id));
  });
});
