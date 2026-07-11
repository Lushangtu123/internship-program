import { NextRequest, NextResponse } from 'next/server';
import {
  getUserBySession,
  loginUser,
  logoutSession,
  registerUser,
} from '@/lib/db/feedStore';
import {
  attachSessionCookie,
  clearSessionCookie,
  readSessionToken,
  requireUser,
  withSession,
} from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const { user, token, isNewSession } = await requireUser(request);
  return withSession(NextResponse.json({ user }), token, isNewSession);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const action = body.action as string;

  if (action === 'register') {
    // Upgrade the current guest in place so likes/saves/follows/uploads survive.
    const sessionToken = readSessionToken(request);
    const current = await getUserBySession(sessionToken);
    const result = await registerUser(
      body.username ?? '',
      body.password ?? '',
      undefined,
      current?.isGuest ? current.id : null
    );
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const response = NextResponse.json({ user: result.user });
    return attachSessionCookie(response, result.token);
  }

  if (action === 'login') {
    const result = await loginUser(body.username ?? '', body.password ?? '');
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const response = NextResponse.json({ user: result.user });
    return attachSessionCookie(response, result.token);
  }

  if (action === 'logout') {
    const token = readSessionToken(request);
    await logoutSession(token);
    return clearSessionCookie(NextResponse.json({ ok: true }));
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
