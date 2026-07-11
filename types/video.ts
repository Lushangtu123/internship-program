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
  /** Whether the current viewer saved/bookmarked this video */
  saved?: boolean;
  /** Whether the current viewer follows this creator */
  isFollowing?: boolean;
  /** Epoch ms — used for freshness ranking */
  createdAt?: number;
}

export interface Comment {
  id: string;
  userId: string;
  username: string;
  userAvatar: string;
  text: string;
  timestamp: number;
  likes: number;
  /** Present when this comment replies to another top-level comment */
  parentId?: string;
  /** Nested replies (list responses only; one level deep) */
  replies?: Comment[];
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
  likes?: number;
}

export interface SaveResponse {
  ok: boolean;
  saved: boolean;
}

