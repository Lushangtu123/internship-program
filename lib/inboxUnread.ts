/** Activity vs DM notification accounting (message rows clear on thread read). */

export type NotificationUnreadFields = {
  id: string;
  type: string;
  read: boolean;
};

/** Likes / comments / follows — not DM Activity rows. */
export function isActivityNotification(type: string): boolean {
  return type !== 'message';
}

export function countActivityUnread(
  items: Array<Pick<NotificationUnreadFields, 'type' | 'read'>>
): number {
  return items.filter((n) => !n.read && isActivityNotification(n.type)).length;
}

/** Ids to mark read when the Activity panel is shown (leave DM rows alone). */
export function unreadActivityNotificationIds(
  items: NotificationUnreadFields[]
): string[] {
  return items
    .filter((n) => !n.read && isActivityNotification(n.type))
    .map((n) => n.id);
}
