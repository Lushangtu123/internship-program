import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import {
  addComment,
  listComments,
  listVideos,
  resetStoreCache,
  toggleLike,
} from '@/lib/db/feedStore';

describe('feedStore (persistent local data layer)', () => {
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
    const page1 = await listVideos(null, 2, dataDir);
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = await listVideos(page1.nextCursor, 2, dataDir);
    expect(page2.items[0].id).not.toBe(page1.items[0].id);
  });

  it('persists like toggles across cache resets', async () => {
    const first = await toggleLike('v_001', dataDir);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    expect(first.liked).toBe(true);

    resetStoreCache();
    const page = await listVideos(null, 1, dataDir);
    expect(page.items[0].id).toBe('v_001');
    expect(page.items[0].liked).toBe(true);

    const raw = await readFile(path.join(dataDir, 'store.json'), 'utf-8');
    expect(raw).toContain('"liked": true');
  });

  it('persists new comments and increments comment count', async () => {
    const created = await addComment('v_001', 'hello persistent world', dataDir);
    expect('id' in created).toBe(true);
    if (!('id' in created)) return;

    resetStoreCache();
    const listed = await listComments('v_001', null, 20, dataDir);
    expect('items' in listed).toBe(true);
    if (!('items' in listed)) return;

    expect(listed.items[0].text).toBe('hello persistent world');

    const page = await listVideos(null, 1, dataDir);
    expect(page.items[0].stats.comments).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty comments', async () => {
    const result = await addComment('v_001', '   ', dataDir);
    expect(result).toMatchObject({ status: 400 });
  });
});
