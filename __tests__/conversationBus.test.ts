import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  conversationBusListenerCount,
  conversationBusMode,
  publishDirectMessage,
  resetConversationBus,
  subscribeChannel,
} from '@/lib/realtime/conversationBus';

describe('conversationBus', () => {
  beforeEach(() => {
    resetConversationBus();
    delete process.env.REDIS_URL;
  });

  afterEach(() => {
    resetConversationBus();
    delete process.env.REDIS_URL;
  });

  it('fans out messages to conversation and user channels', () => {
    const seen: string[] = [];
    const unsubC = subscribeChannel('c', 'conv_1', (e) => {
      seen.push(`c:${e.message.text}`);
    });
    const unsubA = subscribeChannel('u', 'u_a', (e) => {
      seen.push(`a:${e.message.text}`);
    });
    const unsubB = subscribeChannel('u', 'u_b', (e) => {
      seen.push(`b:${e.message.text}`);
    });
    const unsubOther = subscribeChannel('u', 'u_other', () => {
      seen.push('other');
    });

    publishDirectMessage(
      {
        id: 'm_1',
        conversationId: 'conv_1',
        senderId: 'u_a',
        text: 'hello',
        createdAt: 1,
      },
      ['u_a', 'u_b']
    );

    expect(seen.sort()).toEqual(['a:hello', 'b:hello', 'c:hello']);
    unsubC();
    unsubA();
    unsubB();
    unsubOther();
    expect(conversationBusListenerCount()).toBe(0);
  });

  it('reports memory mode when REDIS_URL is unset', () => {
    expect(conversationBusMode()).toBe('memory');
  });

  it('reports redis mode when REDIS_URL is set', () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    resetConversationBus();
    expect(conversationBusMode()).toBe('redis');
  });
});

describe('redisBridge without server', () => {
  afterEach(async () => {
    delete process.env.REDIS_URL;
    const bridge = await import('@/lib/realtime/redisBridge');
    await bridge.closeRedisDm();
  });

  it('publishRedisDm returns false when REDIS_URL unset', async () => {
    delete process.env.REDIS_URL;
    const bridge = await import('@/lib/realtime/redisBridge');
    await bridge.closeRedisDm();
    const published = await bridge.publishRedisDm({
      participantIds: ['u_a'],
      event: {
        type: 'message',
        message: {
          id: 'm',
          conversationId: 'c',
          senderId: 'u_a',
          text: 'x',
          createdAt: 1,
        },
      },
    });
    expect(published).toBe(false);
  });
});
