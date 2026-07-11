import { NextRequest, NextResponse } from 'next/server';
import { markConversationRead } from '@/lib/db/feedStore';
import { requireUser, withSession } from '@/lib/auth/session';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { user, token, isNewSession } = await requireUser(request);
  const { id } = await context.params;
  let body: { action?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (body.action !== 'read') {
    return withSession(
      NextResponse.json({ error: 'Unsupported action' }, { status: 400 }),
      token,
      isNewSession
    );
  }

  const result = await markConversationRead(id, user.id);
  if (!result.ok) {
    return withSession(
      NextResponse.json({ error: result.error }, { status: 404 }),
      token,
      isNewSession
    );
  }

  return withSession(NextResponse.json(result), token, isNewSession);
}
