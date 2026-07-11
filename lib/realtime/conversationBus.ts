/**
 * Pub/sub for DM realtime (SSE).
 * - Always fans out in-process for this Node instance
 * - When REDIS_URL is set, also publishes across instances via Redis
 */
import type { DirectMessage } from '@/lib/db/feedStore';
import {
  onRedisDmMessage,
  publishRedisDm,
  redisDmEnabled,
} from '@/lib/realtime/redisBridge';

export type ConversationLiveEvent = {
  type: 'message';
  message: DirectMessage;
};

type Listener = (event: ConversationLiveEvent) => void;

const listeners = new Map<string, Set<Listener>>();
let redisHooked = false;

function channelKey(kind: 'c' | 'u', id: string) {
  return `${kind}:${id}`;
}

function ensureRedisHook() {
  if (redisHooked || !redisDmEnabled()) return;
  redisHooked = true;
  onRedisDmMessage((envelope) => {
    emitLocal('c', envelope.event.message.conversationId, envelope.event);
    for (const userId of envelope.participantIds) {
      emitLocal('u', userId, envelope.event);
    }
  });
}

export function subscribeChannel(
  kind: 'c' | 'u',
  id: string,
  listener: Listener
): () => void {
  ensureRedisHook();
  const key = channelKey(kind, id);
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) listeners.delete(key);
  };
}

function emitLocal(kind: 'c' | 'u', id: string, event: ConversationLiveEvent) {
  const set = listeners.get(channelKey(kind, id));
  if (!set) return;
  for (const listener of set) {
    try {
      listener(event);
    } catch {
      // ignore listener errors
    }
  }
}

/** Fan out a new DM to the conversation channel and both participants. */
export function publishDirectMessage(
  message: DirectMessage,
  participantIds: string[]
) {
  ensureRedisHook();
  const event: ConversationLiveEvent = { type: 'message', message };
  emitLocal('c', message.conversationId, event);
  for (const userId of participantIds) {
    emitLocal('u', userId, event);
  }
  if (redisDmEnabled()) {
    void publishRedisDm({ participantIds, event }).catch((err) => {
      console.error('[redis-dm] publish failed', err);
    });
  }
}

export function conversationBusMode(): 'memory' | 'redis' {
  return redisDmEnabled() ? 'redis' : 'memory';
}

/** Test helper */
export function resetConversationBus() {
  listeners.clear();
  redisHooked = false;
}

export function conversationBusListenerCount() {
  let n = 0;
  for (const set of listeners.values()) n += set.size;
  return n;
}
