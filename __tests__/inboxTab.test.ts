import { describe, it, expect } from 'vitest';
import { inboxHref, preferInboxTab } from '@/lib/inboxTab';

describe('preferInboxTab', () => {
  it('opens messages when only DMs are unread', () => {
    expect(preferInboxTab(0, 3)).toBe('messages');
    expect(inboxHref(0, 1)).toBe('/inbox?tab=messages');
  });

  it('opens activity when notifications are unread', () => {
    expect(preferInboxTab(2, 0)).toBe('activity');
    expect(preferInboxTab(1, 5)).toBe('activity');
    expect(inboxHref(1, 0)).toBe('/inbox');
  });

  it('opens activity when both are zero', () => {
    expect(preferInboxTab(0, 0)).toBe('activity');
    expect(inboxHref(0, 0)).toBe('/inbox');
  });
});
