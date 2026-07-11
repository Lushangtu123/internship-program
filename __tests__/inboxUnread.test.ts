import { describe, it, expect } from 'vitest';
import {
  countActivityUnread,
  unreadActivityNotificationIds,
} from '@/lib/inboxUnread';

describe('inboxUnread', () => {
  it('counts only non-message unread notifications', () => {
    expect(
      countActivityUnread([
        { type: 'like', read: false },
        { type: 'message', read: false },
        { type: 'comment', read: true },
        { type: 'follow', read: false },
      ])
    ).toBe(2);
  });

  it('returns activity ids to mark read, skipping DM rows', () => {
    expect(
      unreadActivityNotificationIds([
        { id: 'n1', type: 'like', read: false },
        { id: 'n2', type: 'message', read: false },
        { id: 'n3', type: 'follow', read: false },
        { id: 'n4', type: 'comment', read: true },
      ])
    ).toEqual(['n1', 'n3']);
  });
});
