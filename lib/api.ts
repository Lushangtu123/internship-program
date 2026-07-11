import {
  Video,
  VideosResponse,
  Comment,
  CommentsResponse,
  LikeResponse,
} from '@/types/video';

const API_BASE = '/api';

async function apiFetch(input: string, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.headers ?? {}),
    },
  });
  return response;
}

export interface AuthUser {
  id: string;
  username: string;
  avatar: string;
  isGuest: boolean;
}

export async function fetchMe(): Promise<AuthUser> {
  const response = await apiFetch(`${API_BASE}/auth`);
  if (!response.ok) throw new Error('Failed to fetch session');
  const data = await response.json();
  return data.user;
}

export async function register(username: string, password: string): Promise<AuthUser> {
  const response = await apiFetch(`${API_BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'register', username, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Register failed');
  return data.user;
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const response = await apiFetch(`${API_BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', username, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Login failed');
  return data.user;
}

export async function logout(): Promise<void> {
  const response = await apiFetch(`${API_BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'logout' }),
  });
  if (!response.ok) throw new Error('Logout failed');
}

export async function fetchVideos(
  cursor?: string | null,
  limit: number = 5,
  feed: 'foryou' | 'following' = 'foryou'
): Promise<VideosResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit.toString());
  params.set('feed', feed);

  const response = await apiFetch(`${API_BASE}/videos?${params}`);
  if (!response.ok) throw new Error('Failed to fetch videos');
  return response.json();
}

export async function toggleFollowCreator(
  creatorId: string
): Promise<{ ok: boolean; following: boolean }> {
  const response = await apiFetch(`${API_BASE}/follow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creatorId }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Follow failed');
  return data;
}

export type SuggestedCreator = {
  id: string;
  handle: string;
  avatar: string;
  name?: string;
  videoCount: number;
  isFollowing: boolean;
};

export async function fetchSuggestedCreators(
  limit = 6
): Promise<SuggestedCreator[]> {
  const response = await apiFetch(
    `${API_BASE}/creators/suggested?limit=${limit}`
  );
  if (!response.ok) throw new Error('Failed to fetch suggestions');
  const data = await response.json();
  return data.items as SuggestedCreator[];
}

export async function likeVideo(videoId: string): Promise<LikeResponse> {
  const response = await apiFetch(`${API_BASE}/videos/${videoId}/like`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to like video');
  return response.json();
}

export async function fetchComments(
  videoId: string,
  cursor?: string | null,
  limit: number = 20
): Promise<CommentsResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit.toString());

  const response = await apiFetch(
    `${API_BASE}/videos/${videoId}/comments?${params}`
  );
  if (!response.ok) throw new Error('Failed to fetch comments');
  return response.json();
}

export async function postComment(
  videoId: string,
  text: string
): Promise<Comment> {
  const response = await apiFetch(`${API_BASE}/videos/${videoId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error('Failed to post comment');
  return response.json();
}
