import { NextRequest, NextResponse } from 'next/server';
import { recordShare } from '@/lib/db/feedStore';
import { requireUser, withSession } from '@/lib/auth/session';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { token, isNewSession } = await requireUser(request);
  const result = await recordShare(params.id);

  if (!result.ok) {
    return withSession(
      NextResponse.json({ ok: false, error: result.error }, { status: 404 }),
      token,
      isNewSession
    );
  }

  return withSession(
    NextResponse.json({ ok: true, shares: result.shares }),
    token,
    isNewSession
  );
}
