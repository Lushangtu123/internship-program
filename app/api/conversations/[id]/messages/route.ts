import { NextRequest, NextResponse } from 'next/server';
import { listMessages, sendMessage } from '@/lib/db/feedStore';
import { requireUser, withSession } from '@/lib/auth/session';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { user, token, isNewSession } = await requireUser(request);
  const { id } = await context.params;
  const limit = parseInt(
    request.nextUrl.searchParams.get('limit') || '50',
    10
  );
  const result = await listMessages(id, user.id, limit);
  if (!result.ok) {
    return withSession(
      NextResponse.json({ error: result.error }, { status: 404 }),
      token,
      isNewSession
    );
  }
  return withSession(NextResponse.json(result), token, isNewSession);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { user, token, isNewSession } = await requireUser(request);
  const { id } = await context.params;
  let body: { text?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const text = typeof body.text === 'string' ? body.text : '';
  const result = await sendMessage(id, user.id, text);
  if (!result.ok) {
    const status =
      result.error === 'Sign in to message'
        ? 401
        : result.error === 'Conversation not found'
          ? 404
          : 400;
    return withSession(
      NextResponse.json({ error: result.error }, { status }),
      token,
      isNewSession
    );
  }

  return withSession(
    NextResponse.json({ message: result.message }),
    token,
    isNewSession
  );
}
