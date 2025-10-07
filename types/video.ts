export interface Creator {
  id: string;
  handle: string;
  avatar: string;
  name?: string;
}

export interface Music {
  title: string;
  artist: string;
}

export interface VideoStats {
  likes: number;
  comments: number;
  shares: number;
}

export interface Video {
  id: string;
  src: string;
  poster: string;
  duration: number;
  creator: Creator;
  caption: string;
  music: Music;
  stats: VideoStats;
  captionsVtt?: string;
  liked?: boolean;
}

export interface Comment {
  id: string;
  userId: string;
  username: string;
  userAvatar: string;
  text: string;
  timestamp: number;
  likes: number;
}

export interface VideosResponse {
  items: Video[];
  nextCursor: string | null;
}

export interface CommentsResponse {
  items: Comment[];
  nextCursor: string | null;
}

export interface LikeResponse {
  ok: boolean;
  liked: boolean;
}

