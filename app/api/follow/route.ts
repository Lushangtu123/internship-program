import { NextRequest, NextResponse } from 'next/server';
import { toggleFollow } from '@/lib/db/feedStore';
import { requireUser, withSession } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  const { user, token, isNewSession } = await requireUser(request);
  const body = await request.json().catch(() => ({}));
  const creatorId = String(body.creatorId ?? '');

  const result = await toggleFollow(user.id, creatorId);
  if (!result.ok) {
    return withSession(
      NextResponse.json({ error: result.error }, { status: result.status }),
      token,
      isNewSession
    );
  }

  return withSession(
    NextResponse.json({ ok: true, following: result.following }),
    token,
    isNewSession
  );
}
