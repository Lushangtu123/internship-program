import { NextRequest, NextResponse } from 'next/server';
import seedData from '@/public/mock/seed.json';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const videoId = params.id;
  const searchParams = request.nextUrl.searchParams;
  const cursor = searchParams.get('cursor');
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  // Get comments for this video
  const allComments = (seedData.comments as any)[videoId] || [];
  
  // Find starting index based on cursor
  let startIndex = 0;
  if (cursor) {
    const cursorIndex = allComments.findIndex((c: any) => c.id === cursor);
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  }

  // Get slice of comments
  const items = allComments.slice(startIndex, startIndex + limit);
  
  // Determine next cursor
  const nextCursor = startIndex + limit < allComments.length 
    ? allComments[startIndex + limit - 1].id 
    : null;

  return NextResponse.json({
    items,
    nextCursor,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const videoId = params.id;
  const body = await request.json();
  const { text } = body;

  if (!text || text.trim().length === 0) {
    return NextResponse.json(
      { error: 'Comment text is required' },
      { status: 400 }
    );
  }

  // Simulate server processing
  await new Promise(resolve => setTimeout(resolve, 300));

  // Create new comment
  const newComment = {
    id: `c_${Date.now()}`,
    userId: 'u_current',
    username: 'you',
    userAvatar: '/avatars/default.png',
    text: text.trim(),
    timestamp: Date.now(),
    likes: 0,
  };

  return NextResponse.json(newComment);
}

