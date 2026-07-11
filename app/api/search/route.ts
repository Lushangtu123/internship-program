import { NextRequest, NextResponse } from 'next/server';
import { searchCatalog } from '@/lib/db/feedStore';
import { requireUser, withSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const { token, isNewSession } = await requireUser(request);
  const q = request.nextUrl.searchParams.get('q') ?? '';
  const limit = Math.min(
    50,
    Math.max(1, Number(request.nextUrl.searchParams.get('limit') ?? 20) || 20)
  );
  const result = await searchCatalog(q, limit);
  return withSession(NextResponse.json(result), token, isNewSession);
}
