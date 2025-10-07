import { NextRequest, NextResponse } from 'next/server';
import seedData from '@/public/mock/seed.json';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cursor = searchParams.get('cursor');
  const limit = parseInt(searchParams.get('limit') || '5', 10);

  const videos = seedData.videos;
  
  // Find starting index based on cursor
  let startIndex = 0;
  if (cursor) {
    const cursorIndex = videos.findIndex(v => v.id === cursor);
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  }

  // Get slice of videos
  const items = videos.slice(startIndex, startIndex + limit);
  
  // Determine next cursor
  const nextCursor = startIndex + limit < videos.length 
    ? videos[startIndex + limit - 1].id 
    : null;

  return NextResponse.json({
    items,
    nextCursor,
  });
}

