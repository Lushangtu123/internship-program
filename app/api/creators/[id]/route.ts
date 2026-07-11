import { NextRequest, NextResponse } from 'next/server';
import { getCreatorProfile } from '@/lib/db/feedStore';
import { requireUser, withSession } from '@/lib/auth/session';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, token, isNewSession } = await requireUser(request);
  const result = await getCreatorProfile(params.id, user.id);

  if ('error' in result) {
    return withSession(
      NextResponse.json({ error: result.error }, { status: 404 }),
      token,
      isNewSession
    );
  }

  return withSession(NextResponse.json(result), token, isNewSession);
}
