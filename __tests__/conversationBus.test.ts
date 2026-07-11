import { describe, it, expect, beforeEach } from 'vitest';
import {
  conversationBusListenerCount,
  publishDirectMessage,
  resetConversationBus,
  subscribeChannel,
} from '@/lib/realtime/conversationBus';

describe('conversationBus', () => {
  beforeEach(() => {
    resetConversationBus();
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
});
