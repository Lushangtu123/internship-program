import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { subscribeChannel } from '@/lib/realtime/conversationBus';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function encodeSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** User-level DM inbox stream (badge / conversation list). */
export async function GET(request: NextRequest) {
  const { user } = await requireUser(request);
  if (user.isGuest) {
    return new Response(JSON.stringify({ error: 'Sign in to subscribe' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(encodeSse(event, data)));
      };

      send('ready', { userId: user.id });

      const unsubscribe = subscribeChannel('u', user.id, (live) => {
        if (live.type === 'message') {
          send('message', live.message);
        }
      });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          // stream closed
        }
      }, 15_000);

      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };

      request.signal.addEventListener('abort', () => {
        cleanup?.();
        try {
          controller.close();
        } catch {
          // ignore
        }
      });
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
