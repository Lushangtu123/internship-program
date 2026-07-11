import { NextRequest, NextResponse } from 'next/server';
import {
  getOrCreateConversation,
  listConversations,
} from '@/lib/db/feedStore';
import { requireUser, withSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const { user, token, isNewSession } = await requireUser(request);
  const result = await listConversations(user.id);
  return withSession(NextResponse.json(result), token, isNewSession);
}

export async function POST(request: NextRequest) {
  const { user, token, isNewSession } = await requireUser(request);
  let body: { peerId?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const peerId = typeof body.peerId === 'string' ? body.peerId.trim() : '';
  if (!peerId) {
    return withSession(
      NextResponse.json({ error: 'peerId required' }, { status: 400 }),
      token,
      isNewSession
    );
  }

  const result = await getOrCreateConversation(user.id, peerId);
  if (!result.ok) {
    const status =
      result.error === 'Sign in to message'
        ? 401
        : result.error === 'User not found'
          ? 404
          : 400;
    return withSession(
      NextResponse.json({ error: result.error }, { status }),
      token,
      isNewSession
    );
  }

  return withSession(
    NextResponse.json({ conversation: result.conversation }),
    token,
    isNewSession
  );
}
