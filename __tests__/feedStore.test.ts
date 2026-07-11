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

    const forA = await listVideos(null, 1, a.user.id, dataDir);
    const forB = await listVideos(null, 1, b.user.id, dataDir);
    expect(forA.items[0].liked).toBe(true);
    expect(forB.items[0].liked).toBe(false);

    resetStoreCache();
    const forAAgain = await listVideos(null, 1, a.user.id, dataDir);
    expect(forAAgain.items[0].liked).toBe(true);

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
    const page = await listVideos(null, 1, guest.user.id, dataDir);
    expect(page.items[0].id).toBe(video.id);
    expect(page.items[0].caption).toBe('my upload');
  });
});
