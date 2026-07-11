/** Decide which Inbox tab a deep link / nav entry should open. */
export type InboxEntryTab = 'activity' | 'messages';

/**
 * Prefer Messages when there are unread DMs and zero *activity* notifications
 * (likes / comments / follows). DM Activity rows (`type=message`) are excluded
 * from the activity count by callers so Step 31 landing still works.
 */
export function preferInboxTab(
  unreadNotifications: number,
  unreadMessages: number
): InboxEntryTab {
  if (unreadMessages > 0 && unreadNotifications <= 0) return 'messages';
  return 'activity';
}

export function inboxHref(
  unreadNotifications: number,
  unreadMessages: number
): string {
  return preferInboxTab(unreadNotifications, unreadMessages) === 'messages'
    ? '/inbox?tab=messages'
    : '/inbox';
}
