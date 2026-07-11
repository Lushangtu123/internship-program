'use client';

import { useEffect, useState } from 'react';
import type { DirectMessage } from '@/lib/api';

/**
 * Subscribe to conversation SSE. Falls back silently when EventSource fails.
 * Returns whether the live stream is currently connected.
 */
export function useConversationLive(
  conversationId: string | null | undefined,
  onMessage: (message: DirectMessage) => void
) {
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!conversationId || typeof EventSource === 'undefined') {
      setLive(false);
      return;
    }

    let closed = false;
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      es = new EventSource(
        `/api/conversations/${encodeURIComponent(conversationId)}/events`
      );

      es.addEventListener('ready', () => {
        if (!closed) setLive(true);
      });

      es.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data) as DirectMessage;
          if (data?.id && data.conversationId === conversationId) {
            onMessage(data);
          }
        } catch {
          // ignore malformed payloads
        }
      });

      es.onerror = () => {
        setLive(false);
        es?.close();
        es = null;
        if (!closed) {
          retryTimer = setTimeout(connect, 4_000);
        }
      };
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
      setLive(false);
    };
  }, [conversationId, onMessage]);

  return live;
}

/** User-level inbox SSE for conversation list / badge refresh. */
export function useInboxLive(
  enabled: boolean,
  onMessage: (message: DirectMessage) => void
) {
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') {
      setLive(false);
      return;
    }

    let closed = false;
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      es = new EventSource(`/api/conversations/events`);

      es.addEventListener('ready', () => {
        if (!closed) setLive(true);
      });

      es.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data) as DirectMessage;
          if (data?.id) onMessage(data);
        } catch {
          // ignore
        }
      });

      es.onerror = () => {
        setLive(false);
        es?.close();
        es = null;
        if (!closed) {
          retryTimer = setTimeout(connect, 4_000);
        }
      };
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
      setLive(false);
    };
  }, [enabled, onMessage]);

  return live;
}
