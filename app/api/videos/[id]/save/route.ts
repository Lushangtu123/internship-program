import { NextRequest, NextResponse } from 'next/server';
import { toggleSave } from '@/lib/db/feedStore';
import { requireUser, withSession } from '@/lib/auth/session';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, token, isNewSession } = await requireUser(request);
  const result = await toggleSave(params.id, user.id);

  if (!result.ok) {
    return withSession(
      NextResponse.json({ ok: false, error: result.error }, { status: 404 }),
      token,
      isNewSession
    );
  }

  return withSession(
    NextResponse.json({
      ok: true,
      saved: result.saved,
    }),
    token,
    isNewSession
  );
}
