import { describe, it, expect, beforeEach } from 'vitest';
import {
  MUTE_TIP_STORAGE_KEY,
  hasSeenMuteTip,
  markMuteTipSeen,
} from '@/lib/muteTip';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

describe('muteTip', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = memoryStorage();
  });

  it('treats missing key as not seen', () => {
    expect(hasSeenMuteTip(storage)).toBe(false);
  });

  it('marks tip as seen', () => {
    markMuteTipSeen(storage);
    expect(storage.getItem(MUTE_TIP_STORAGE_KEY)).toBe('1');
    expect(hasSeenMuteTip(storage)).toBe(true);
  });

  it('returns true when storage is unavailable', () => {
    expect(hasSeenMuteTip(null)).toBe(true);
  });
});
