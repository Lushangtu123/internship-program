/** First-visit mute tip — persist dismissal so we only coach once. */

export const MUTE_TIP_STORAGE_KEY = 'sv_mute_tip_seen';

export function hasSeenMuteTip(
  storage: Pick<Storage, 'getItem'> | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null
): boolean {
  if (!storage) return true;
  try {
    return storage.getItem(MUTE_TIP_STORAGE_KEY) === '1';
  } catch {
    return true;
  }
}

export function markMuteTipSeen(
  storage: Pick<Storage, 'setItem'> | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null
): void {
  if (!storage) return;
  try {
    storage.setItem(MUTE_TIP_STORAGE_KEY, '1');
  } catch {
    // ignore quota / private mode
  }
}
