import { NextRequest, NextResponse } from 'next/server';
import { listVideos } from '@/lib/db/feedStore';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cursor = searchParams.get('cursor');
  const limit = parseInt(searchParams.get('limit') || '5', 10);

  const result = await listVideos(cursor, limit);
  return NextResponse.json(result);
}
