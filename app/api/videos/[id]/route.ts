import { NextRequest, NextResponse } from 'next/server';
import { deleteVideo, updateVideoCaption } from '@/lib/db/feedStore';
import { requireUser, withSession } from '@/lib/auth/session';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, token, isNewSession } = await requireUser(request);
  const body = await request.json().catch(() => ({}));
  const caption = typeof body.caption === 'string' ? body.caption : '';

  const result = await updateVideoCaption(params.id, user.id, caption);
  if (!result.ok) {
    return withSession(
      NextResponse.json({ ok: false, error: result.error }, { status: result.status }),
      token,
      isNewSession
    );
  }

  return withSession(
    NextResponse.json({ ok: true, video: result.video }),
    token,
    isNewSession
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, token, isNewSession } = await requireUser(request);
  const result = await deleteVideo(params.id, user.id);
  if (!result.ok) {
    return withSession(
      NextResponse.json({ ok: false, error: result.error }, { status: result.status }),
      token,
      isNewSession
    );
  }

  return withSession(NextResponse.json({ ok: true }), token, isNewSession);
}
