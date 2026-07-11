import { NextRequest, NextResponse } from 'next/server';
import { listSuggestedCreators } from '@/lib/db/feedStore';
import { requireUser, withSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const { user, token, isNewSession } = await requireUser(request);
  const limit = parseInt(
    request.nextUrl.searchParams.get('limit') || '6',
    10
  );
  const items = await listSuggestedCreators(user.id, limit);
  return withSession(NextResponse.json({ items }), token, isNewSession);
}
