import { NextRequest, NextResponse } from 'next/server';
import { recordSignal } from '@/lib/db/feedStore';
import { requireUser, withSession } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  const { token, isNewSession } = await requireUser(request);
  const body = await request.json().catch(() => ({}));
  const videoId = String(body.videoId ?? '');
  const type = body.type as string;

  if (!videoId || (type !== 'play' && type !== 'complete')) {
    return withSession(
      NextResponse.json(
        { error: 'videoId and type (play|complete) required' },
        { status: 400 }
      ),
      token,
      isNewSession
    );
  }

  const result = await recordSignal(videoId, type);
  if (!result.ok) {
    return withSession(
      NextResponse.json({ error: result.error }, { status: 404 }),
      token,
      isNewSession
    );
  }

  return withSession(NextResponse.json({ ok: true }), token, isNewSession);
}
