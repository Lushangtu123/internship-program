import { NextRequest, NextResponse } from 'next/server';
import { createVideo } from '@/lib/db/feedStore';
import { requireUser, withSession } from '@/lib/auth/session';
import { acceptUploadedVideo } from '@/lib/upload/processVideo';
import { enqueueHlsTranscode } from '@/lib/upload/transcodeQueue';

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
    // Fast path: write file + poster, return progressive playback immediately.
    // HLS packaging continues in the background.
    const saved = await acceptUploadedVideo(file);
    const video = await createVideo({
      id: saved.id,
      src: saved.progressiveSrc,
      progressiveSrc: saved.progressiveSrc,
      poster: saved.poster,
      duration: saved.duration,
      caption,
      user,
      status: 'processing',
    });

    enqueueHlsTranscode({
      videoId: video.id,
      absolutePath: saved.absolutePath,
      uploadId: saved.id,
    });

    return withSession(
      NextResponse.json({ video, status: video.status }),
      token,
      isNewSession
    );
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
