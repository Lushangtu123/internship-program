/**
 * Optional Redis pub/sub bridge for cross-instance DM fan-out.
 * Enabled when REDIS_URL is set; otherwise no-ops.
 */
import { createClient, type RedisClientType } from 'redis';
import type { ConversationLiveEvent } from '@/lib/realtime/conversationBus';

const CHANNEL = 'sv:dm';

export type RedisDmEnvelope = {
  origin: string;
  participantIds: string[];
  event: ConversationLiveEvent;
};

type RemoteHandler = (envelope: RedisDmEnvelope) => void;

const originId = `pid_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;

let publisher: RedisClientType | null = null;
let subscriber: RedisClientType | null = null;
let starting: Promise<void> | null = null;
let remoteHandler: RemoteHandler | null = null;
let redisDisabled = false;

function redisUrl() {
  return process.env.REDIS_URL?.trim() || '';
}

export function redisDmEnabled() {
  return Boolean(redisUrl()) && !redisDisabled;
}

export function redisOriginId() {
  return originId;
}

async function ensureRedis() {
  if (!redisUrl() || redisDisabled) return null;
  if (publisher && subscriber) return { publisher, subscriber };
  if (starting) {
    await starting;
    return publisher && subscriber ? { publisher, subscriber } : null;
  }

  starting = (async () => {
    try {
      const url = redisUrl();
      const pub = createClient({ url }) as RedisClientType;
      const sub = createClient({ url }) as RedisClientType;
      pub.on('error', (err) => {
        console.error('[redis-dm] publisher error', err);
      });
      sub.on('error', (err) => {
        console.error('[redis-dm] subscriber error', err);
      });
      await Promise.all([pub.connect(), sub.connect()]);
      await sub.subscribe(CHANNEL, (raw) => {
        if (!remoteHandler) return;
        try {
          const envelope = JSON.parse(raw) as RedisDmEnvelope;
          if (!envelope?.event || envelope.origin === originId) return;
          remoteHandler(envelope);
        } catch (err) {
          console.error('[redis-dm] bad payload', err);
        }
      });
      publisher = pub;
      subscriber = sub;
      console.info('[redis-dm] connected for cross-instance DM fan-out');
    } catch (err) {
      console.error('[redis-dm] connect failed; staying in-process only', err);
      redisDisabled = true;
      publisher = null;
      subscriber = null;
    } finally {
      starting = null;
    }
  })();

  await starting;
  return publisher && subscriber ? { publisher, subscriber } : null;
}

export function onRedisDmMessage(handler: RemoteHandler) {
  remoteHandler = handler;
  void ensureRedis();
}

export async function publishRedisDm(envelope: Omit<RedisDmEnvelope, 'origin'>) {
  const clients = await ensureRedis();
  if (!clients) return false;
  const payload: RedisDmEnvelope = { ...envelope, origin: originId };
  await clients.publisher.publish(CHANNEL, JSON.stringify(payload));
  return true;
}

/** Test / shutdown helper */
export async function closeRedisDm() {
  const pub = publisher;
  const sub = subscriber;
  publisher = null;
  subscriber = null;
  remoteHandler = null;
  starting = null;
  redisDisabled = false;
  await Promise.allSettled([
    sub?.unsubscribe(CHANNEL).catch(() => undefined),
    sub?.quit().catch(() => undefined),
    pub?.quit().catch(() => undefined),
  ]);
}
