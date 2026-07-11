import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import {
  addComment,
  createGuestUser,
  createVideo,
  getCreatorProfile,
  listComments,
  listNotifications,
  listSuggestedCreators,
  listVideos,
  loginUser,
  markNotificationsRead,
  recordSignal,
  registerUser,
  resetStoreCache,
  toggleFollow,
  toggleLike,
  toggleSave,
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

  it('upgrades a guest in place and keeps likes / follows / uploads', async () => {
    const guest = await createGuestUser(dataDir);
    await toggleLike('v_001', guest.user.id, dataDir);
    await toggleFollow(guest.user.id, 'u_1', dataDir);
    await toggleSave('v_001', guest.user.id, dataDir);

    const uploaded = await createVideo(
      {
        caption: 'guest upload',
        src: '/uploads/x.mp4',
        poster: '/uploads/x.jpg',
        duration: 3,
        user: guest.user,
      },
      dataDir
    );
    expect(uploaded.creator.id).toBe(guest.user.id);

    const upgraded = await registerUser(
      'carol',
      'secret12',
      dataDir,
      guest.user.id
    );
    expect('user' in upgraded).toBe(true);
    if (!('user' in upgraded)) return;

    expect(upgraded.user.id).toBe(guest.user.id);
    expect(upgraded.user.username).toBe('carol');
    expect(upgraded.user.isGuest).toBe(false);

    const page = await listVideos(null, 50, upgraded.user.id, dataDir);
    expect(page.items.find((v) => v.id === 'v_001')?.liked).toBe(true);
    expect(page.items.find((v) => v.id === 'v_001')?.saved).toBe(true);

    const following = await listVideos(
      null,
      50,
      upgraded.user.id,
      dataDir,
      'following'
    );
    expect(following.items.some((v) => v.creator.id === 'u_1')).toBe(true);

    const profile = await getCreatorProfile(
      upgraded.user.id,
      upgraded.user.id,
      dataDir
    );
    expect('error' in profile).toBe(false);
    if ('error' in profile) return;
    expect(profile.creator.handle).toBe('@carol');
    expect(profile.videos.some((v) => v.id === uploaded.id)).toBe(true);

    const loggedIn = await loginUser('carol', 'secret12', dataDir);
    expect('user' in loggedIn && loggedIn.user.id).toBe(guest.user.id);
  });

  it('rejects empty comments', async () => {
    const guest = await createGuestUser(dataDir);
    const result = await addComment('v_001', '   ', guest.user, dataDir);
    expect(result).toMatchObject({ status: 400 });
  });

  it('nests one-level replies under the parent comment', async () => {
    const author = await createGuestUser(dataDir);
    const replier = await createGuestUser(dataDir);
    const parent = await addComment(
      'v_001',
      'top level thought',
      author.user,
      dataDir
    );
    expect('id' in parent).toBe(true);
    if (!('id' in parent)) return;

    const reply = await addComment(
      'v_001',
      'agree',
      replier.user,
      dataDir,
      parent.id
    );
    expect('id' in reply && reply.parentId).toBe(parent.id);

    const nested = await addComment(
      'v_001',
      'too deep',
      author.user,
      dataDir,
      'id' in reply ? reply.id : ''
    );
    expect(nested).toMatchObject({ status: 400 });

    const listed = await listComments('v_001', null, 50, dataDir);
    expect('items' in listed).toBe(true);
    if (!('items' in listed)) return;
    const thread = listed.items.find((c) => c.id === parent.id);
    expect(thread?.replies?.some((r) => r.text === 'agree')).toBe(true);
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

  it('filters following feed to followed creators only', async () => {
    const guest = await createGuestUser(dataDir);
    const followed = await toggleFollow(guest.user.id, 'u_1', dataDir);
    expect(followed.ok && followed.following).toBe(true);

    const followingFeed = await listVideos(
      null,
      50,
      guest.user.id,
      dataDir,
      'following'
    );
    expect(followingFeed.items.length).toBeGreaterThan(0);
    expect(
      followingFeed.items.every((video) => video.creator.id === 'u_1')
    ).toBe(true);
    expect(followingFeed.items.every((video) => video.isFollowing)).toBe(true);

    const forYou = await listVideos(null, 50, guest.user.id, dataDir, 'foryou');
    const sample = forYou.items.find((video) => video.creator.id === 'u_1');
    expect(sample?.isFollowing).toBe(true);
  });

  it('returns creator profile with videos and follower stats', async () => {
    const guest = await createGuestUser(dataDir);
    await toggleFollow(guest.user.id, 'u_1', dataDir);

    const profile = await getCreatorProfile('u_1', guest.user.id, dataDir);
    expect('error' in profile).toBe(false);
    if ('error' in profile) return;

    expect(profile.creator.id).toBe('u_1');
    expect(profile.isFollowing).toBe(true);
    expect(profile.stats.followers).toBeGreaterThanOrEqual(1);
    expect(profile.videos.length).toBeGreaterThan(0);
    expect(profile.videos.every((v) => v.creator.id === 'u_1')).toBe(true);
  });

  it('returns not found for unknown creator', async () => {
    const result = await getCreatorProfile('missing', null, dataDir);
    expect(result).toEqual({ error: 'Creator not found' });
  });

  it('keeps saves per user and lists them newest-first', async () => {
    const a = await createGuestUser(dataDir);
    const b = await createGuestUser(dataDir);

    const first = await toggleSave('v_001', a.user.id, dataDir);
    expect(first.ok && first.saved).toBe(true);
    const second = await toggleSave('v_002', a.user.id, dataDir);
    expect(second.ok && second.saved).toBe(true);

    const forA = await listVideos(null, 50, a.user.id, dataDir, 'saved');
    expect(forA.items.map((v) => v.id)).toEqual(['v_002', 'v_001']);
    expect(forA.items.every((v) => v.saved)).toBe(true);

    const forB = await listVideos(null, 50, b.user.id, dataDir, 'saved');
    expect(forB.items).toHaveLength(0);

    const unsaved = await toggleSave('v_002', a.user.id, dataDir);
    expect(unsaved.ok && unsaved.saved).toBe(false);
    const after = await listVideos(null, 50, a.user.id, dataDir, 'saved');
    expect(after.items.map((v) => v.id)).toEqual(['v_001']);
  });

  it('creates notifications for like, comment, and follow', async () => {
    const creator = await createGuestUser(dataDir);
    const viewer = await createGuestUser(dataDir);
    const video = await createVideo(
      {
        src: '/uploads/videos/n.webm',
        poster: '/uploads/posters/n.jpg',
        duration: 3,
        caption: 'notify me',
        user: creator.user,
      },
      dataDir
    );

    await toggleLike(video.id, viewer.user.id, dataDir);
    await addComment(video.id, 'nice clip', viewer.user, dataDir);
    await toggleFollow(viewer.user.id, creator.user.id, dataDir);

    const notes = await listNotifications(creator.user.id, 20, dataDir);
    expect(notes.unreadCount).toBe(3);
    expect(notes.items.map((n) => n.type).sort()).toEqual([
      'comment',
      'follow',
      'like',
    ]);

    const selfLike = await listNotifications(viewer.user.id, 20, dataDir);
    expect(selfLike.items).toHaveLength(0);

    await markNotificationsRead(creator.user.id, undefined, dataDir);
    const afterRead = await listNotifications(creator.user.id, 20, dataDir);
    expect(afterRead.unreadCount).toBe(0);
    expect(afterRead.items.every((n) => n.read)).toBe(true);
  });

  it('suggests creators not yet followed and excludes self', async () => {
    const guest = await createGuestUser(dataDir);
    await createVideo(
      {
        src: '/uploads/videos/mine.webm',
        poster: '/uploads/posters/mine.jpg',
        duration: 2,
        caption: 'mine',
        user: guest.user,
      },
      dataDir
    );

    const before = await listSuggestedCreators(guest.user.id, 10, dataDir);
    expect(before.length).toBeGreaterThan(0);
    expect(before.every((c) => c.id !== guest.user.id)).toBe(true);
    expect(before.every((c) => !c.isFollowing)).toBe(true);

    await toggleFollow(guest.user.id, before[0].id, dataDir);
    const after = await listSuggestedCreators(guest.user.id, 10, dataDir);
    expect(after.every((c) => c.id !== before[0].id)).toBe(true);
  });
});
