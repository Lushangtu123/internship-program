import { NextRequest, NextResponse } from 'next/server';
import { addComment, listComments } from '@/lib/db/feedStore';
import { requireUser, withSession } from '@/lib/auth/session';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { token, isNewSession } = await requireUser(request);
  const searchParams = request.nextUrl.searchParams;
  const cursor = searchParams.get('cursor');
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  const result = await listComments(params.id, cursor, limit);
  if ('error' in result) {
    return withSession(
      NextResponse.json({ error: result.error }, { status: 404 }),
      token,
      isNewSession
    );
  }

  return withSession(NextResponse.json(result), token, isNewSession);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, token, isNewSession } = await requireUser(request);
  const body = await request.json();
  const result = await addComment(
    params.id,
    body.text ?? '',
    user,
    undefined,
    body.parentId ?? null
  );

  if ('error' in result) {
    return withSession(
      NextResponse.json({ error: result.error }, { status: result.status }),
      token,
      isNewSession
    );
  }

  return withSession(NextResponse.json(result), token, isNewSession);
}
