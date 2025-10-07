import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // In a real app, you would store this in a database or analytics service
  console.log('📊 Telemetry received:', body);

  return NextResponse.json({ ok: true });
}

