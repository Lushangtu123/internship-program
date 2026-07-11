import { NextRequest, NextResponse } from 'next/server';
import { listVideos } from '@/lib/db/feedStore';
import { requireUser, withSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const { user, token, isNewSession } = await requireUser(request);
  const searchParams = request.nextUrl.searchParams;
  const cursor = searchParams.get('cursor');
  const limit = parseInt(searchParams.get('limit') || '5', 10);
  const feedParam = searchParams.get('feed');
  const feed = feedParam === 'following' ? 'following' : 'foryou';

  const result = await listVideos(cursor, limit, user.id, undefined, feed);
  return withSession(NextResponse.json(result), token, isNewSession);
}
