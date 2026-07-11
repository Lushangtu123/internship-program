import { NextRequest, NextResponse } from 'next/server';
import {
  listNotifications,
  markNotificationsRead,
} from '@/lib/db/feedStore';
import { requireUser, withSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const { user, token, isNewSession } = await requireUser(request);
  const limit = parseInt(
    request.nextUrl.searchParams.get('limit') || '30',
    10
  );
  const result = await listNotifications(user.id, limit);
  return withSession(NextResponse.json(result), token, isNewSession);
}

export async function POST(request: NextRequest) {
  const { user, token, isNewSession } = await requireUser(request);
  let body: { action?: string; ids?: string[] } = {};
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

  const result = await markNotificationsRead(user.id, body.ids);
  return withSession(NextResponse.json(result), token, isNewSession);
}
