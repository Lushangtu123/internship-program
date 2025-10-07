import {
  Video,
  VideosResponse,
  Comment,
  CommentsResponse,
  LikeResponse,
} from '@/types/video';

const API_BASE = '/api';

export async function fetchVideos(
  cursor?: string | null,
  limit: number = 5
): Promise<VideosResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit.toString());

  const response = await fetch(`${API_BASE}/videos?${params}`);
  if (!response.ok) throw new Error('Failed to fetch videos');
  return response.json();
}

export async function likeVideo(videoId: string): Promise<LikeResponse> {
  const response = await fetch(`${API_BASE}/videos/${videoId}/like`, {
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

  const response = await fetch(
    `${API_BASE}/videos/${videoId}/comments?${params}`
  );
  if (!response.ok) throw new Error('Failed to fetch comments');
  return response.json();
}

export async function postComment(
  videoId: string,
  text: string
): Promise<Comment> {
  const response = await fetch(`${API_BASE}/videos/${videoId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error('Failed to post comment');
  return response.json();
}

