/**
 * In-process pub/sub for DM realtime (SSE).
 * Single-node only — fine for the experimental demo stack.
 */
import type { DirectMessage } from '@/lib/db/feedStore';

export type ConversationLiveEvent = {
  type: 'message';
  message: DirectMessage;
};

type Listener = (event: ConversationLiveEvent) => void;

const listeners = new Map<string, Set<Listener>>();

function channelKey(kind: 'c' | 'u', id: string) {
  return `${kind}:${id}`;
}

export function subscribeChannel(
  kind: 'c' | 'u',
  id: string,
  listener: Listener
): () => void {
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

function emit(kind: 'c' | 'u', id: string, event: ConversationLiveEvent) {
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
  const event: ConversationLiveEvent = { type: 'message', message };
  emit('c', message.conversationId, event);
  for (const userId of participantIds) {
    emit('u', userId, event);
  }
}

/** Test helper */
export function resetConversationBus() {
  listeners.clear();
}

export function conversationBusListenerCount() {
  let n = 0;
  for (const set of listeners.values()) n += set.size;
  return n;
}
