import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { listMessages } from '@/lib/db/feedStore';
import { subscribeChannel } from '@/lib/realtime/conversationBus';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function encodeSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { user } = await requireUser(request);
  const { id } = await context.params;

  const access = await listMessages(id, user.id, 1);
  if (!access.ok) {
    return new Response(JSON.stringify({ error: access.error }), {
      status: 404,
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

      send('ready', { conversationId: id });

      const unsubscribe = subscribeChannel('c', id, (live) => {
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
