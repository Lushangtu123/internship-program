import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const videoId = params.id;
  
  // Simulate server processing
  await new Promise(resolve => setTimeout(resolve, 100));

  // In a real app, this would update the database
  // For now, we'll just return success
  // The client will handle optimistic updates
  
  const liked = Math.random() > 0.1; // 90% success rate

  return NextResponse.json({
    ok: true,
    liked,
  });
}

