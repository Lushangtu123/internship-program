import { NextRequest, NextResponse } from 'next/server';
import {
  deleteVideo,
  getVideoById,
  updateVideoCaption,
} from '@/lib/db/feedStore';
import { requireUser, withSession } from '@/lib/auth/session';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { token, isNewSession } = await requireUser(request);
  const video = await getVideoById(params.id);
  if (!video) {
    return withSession(
      NextResponse.json({ error: 'Video not found' }, { status: 404 }),
      token,
      isNewSession
    );
  }
  return withSession(
    NextResponse.json({
      id: video.id,
      status: video.status ?? 'ready',
      src: video.src,
      progressiveSrc: video.progressiveSrc,
    }),
    token,
    isNewSession
  );
}

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
