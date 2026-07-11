import { NextRequest, NextResponse } from 'next/server';
import {
  createGuestUser,
  getUserBySession,
  type PublicUser,
} from '@/lib/db/feedStore';

export const SESSION_COOKIE = 'sv_session';

export function readSessionToken(request: NextRequest): string | null {
  return request.cookies.get(SESSION_COOKIE)?.value ?? null;
}

export function attachSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}

/** Resolve current user; create a guest session when missing. */
export async function requireUser(request: NextRequest): Promise<{
  user: PublicUser;
  token: string;
  isNewSession: boolean;
}> {
  const existing = readSessionToken(request);
  const user = await getUserBySession(existing);
  if (user && existing) {
    return { user, token: existing, isNewSession: false };
  }

  const guest = await createGuestUser();
  return { user: guest.user, token: guest.token, isNewSession: true };
}

export function withSession(
  response: NextResponse,
  token: string,
  isNewSession: boolean
) {
  if (isNewSession) attachSessionCookie(response, token);
  return response;
}
