import { NextRequest, NextResponse } from 'next/server';
import { createVideo } from '@/lib/db/feedStore';
import { requireUser, withSession } from '@/lib/auth/session';
import { saveUploadedVideo } from '@/lib/upload/processVideo';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const { user, token, isNewSession } = await requireUser(request);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return withSession(
      NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 }),
      token,
      isNewSession
    );
  }

  const file = form.get('file');
  const caption = String(form.get('caption') ?? '');

  if (!(file instanceof File)) {
    return withSession(
      NextResponse.json({ error: 'Missing video file' }, { status: 400 }),
      token,
      isNewSession
    );
  }

  try {
    const saved = await saveUploadedVideo(file);
    const video = await createVideo({
      src: saved.src,
      poster: saved.poster,
      duration: saved.duration,
      caption,
      user,
    });

    return withSession(NextResponse.json({ video }), token, isNewSession);
  } catch (error) {
    const status =
      error && typeof error === 'object' && 'status' in error
        ? Number((error as { status: number }).status)
        : 500;
    const message =
      error instanceof Error ? error.message : 'Upload failed';
    return withSession(
      NextResponse.json({ error: message }, { status }),
      token,
      isNewSession
    );
  }
}
