import { NextRequest, NextResponse } from 'next/server';
import { toggleLike } from '@/lib/db/feedStore';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = await toggleLike(params.id);

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    liked: result.liked,
    likes: result.likes,
  });
}
