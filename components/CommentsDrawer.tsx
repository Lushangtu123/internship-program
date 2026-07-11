'use client';

import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, Send } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Comment } from '@/types/video';
import { fetchComments, postComment } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import {
  bumpVideoCommentCount,
  setVideoCommentCount,
} from '@/lib/videoQueryCache';

interface CommentsDrawerProps {
  videoId: string;
  isOpen: boolean;
  onClose: () => void;
}

function commentCount(comments: Comment[]) {
  return comments.reduce(
    (sum, comment) => sum + 1 + (comment.replies?.length ?? 0),
    0
  );
}

export function CommentsDrawer({
  videoId,
  isOpen,
  onClose,
}: CommentsDrawerProps) {
  const queryClient = useQueryClient();
  const [comments, setComments] = useState<Comment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && videoId) {
      void loadComments();
      setReplyTo(null);
      setNewComment('');
    }
  }, [isOpen, videoId]);

  useEffect(() => {
    if (replyTo && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyTo]);

  const loadComments = async () => {
    setLoading(true);
    setNextCursor(null);
    try {
      const response = await fetchComments(videoId);
      setComments(response.items);
      setNextCursor(response.nextCursor);
      setVideoCommentCount(queryClient, videoId, commentCount(response.items));
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await fetchComments(videoId, nextCursor);
      setComments((prev) => [...prev, ...response.items]);
      setNextCursor(response.nextCursor);
    } catch (error) {
      console.error('Failed to load more comments:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || sending) return;

    const text = newComment.trim();
    const parent = replyTo;
    setNewComment('');
    setReplyTo(null);

    const optimisticComment: Comment = {
      id: `temp_${Date.now()}`,
      userId: 'u_current',
      username: 'you',
      userAvatar: '/avatars/default.png',
      text,
      timestamp: Date.now(),
      likes: 0,
      ...(parent ? { parentId: parent.id } : {}),
    };

    if (parent) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === parent.id
            ? { ...c, replies: [...(c.replies ?? []), optimisticComment] }
            : c
        )
      );
    } else {
      setComments((prev) => [{ ...optimisticComment, replies: [] }, ...prev]);
    }
    bumpVideoCommentCount(queryClient, videoId, 1);

    setSending(true);
    try {
      const comment = await postComment(videoId, text, parent?.id);
      if (parent) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === parent.id
              ? {
                  ...c,
                  replies: (c.replies ?? []).map((r) =>
                    r.id === optimisticComment.id ? comment : r
                  ),
                }
              : c
          )
        );
      } else {
        setComments((prev) =>
          prev.map((c) =>
            c.id === optimisticComment.id ? { ...comment, replies: [] } : c
          )
        );
      }
    } catch (error) {
      console.error('Failed to post comment:', error);
      bumpVideoCommentCount(queryClient, videoId, -1);
      if (parent) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === parent.id
              ? {
                  ...c,
                  replies: (c.replies ?? []).filter(
                    (r) => r.id !== optimisticComment.id
                  ),
                }
              : c
          )
        );
      } else {
        setComments((prev) =>
          prev.filter((c) => c.id !== optimisticComment.id)
        );
      }
    } finally {
      setSending(false);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const renderCommentBody = (comment: Comment, isReply = false) => (
    <div className={`flex gap-3 ${isReply ? 'mt-3' : ''}`}>
      <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-zinc-700">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={comment.userAvatar || '/avatars/default.png'}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-white">
            {comment.username}
          </span>
          <span className="text-xs text-white/40">
            {formatTimestamp(comment.timestamp)}
          </span>
        </div>
        <p className="mt-1 text-sm text-white/90">{comment.text}</p>
        {!isReply && (
          <button
            type="button"
            className="mt-1 text-xs font-medium text-white/45 hover:text-white/80"
            onClick={() => setReplyTo(comment)}
          >
            Reply
          </button>
        )}
      </div>
    </div>
  );

  if (!isOpen) return null;

  const total = commentCount(comments);

  return (
    <>
      <button
        type="button"
        className="absolute inset-0 z-40 bg-black/50"
        aria-label="Close comments"
        onClick={onClose}
      />

      <div
        className="absolute bottom-14 left-0 right-0 z-50 flex max-h-[70%] flex-col rounded-t-2xl border-t border-white/10 bg-zinc-950 text-white shadow-2xl"
        role="dialog"
        aria-label="Comments"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-base font-semibold">
            Comments {total > 0 && `(${formatNumber(total)})`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-white/10"
            aria-label="Close comments"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ScrollArea className="flex-1 px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
            </div>
          ) : comments.length === 0 ? (
            <div className="py-8 text-center text-sm text-white/45">
              No comments yet. Be the first!
            </div>
          ) : (
            <div className="space-y-4 pb-2">
              {comments.map((comment) => (
                <div key={comment.id}>
                  {renderCommentBody(comment)}
                  {(comment.replies?.length ?? 0) > 0 && (
                    <div className="ml-8 border-l border-white/10 pl-3">
                      {comment.replies!.map((reply) => (
                        <div key={reply.id}>
                          {renderCommentBody(reply, true)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {nextCursor && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => void loadMore()}
                    disabled={loadingMore}
                    className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/15 disabled:opacity-60"
                  >
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <form
          onSubmit={handleSubmit}
          className="space-y-2 border-t border-white/10 p-3"
        >
          {replyTo && (
            <div className="flex items-center justify-between rounded-md bg-white/5 px-2 py-1.5 text-xs text-white/70">
              <span>
                Replying to <strong>@{replyTo.username}</strong>
              </span>
              <button
                type="button"
                className="text-white/50 hover:text-white"
                onClick={() => setReplyTo(null)}
                aria-label="Cancel reply"
              >
                Cancel
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              type="text"
              placeholder={
                replyTo
                  ? `Reply to @${replyTo.username}...`
                  : 'Add a comment...'
              }
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              disabled={sending}
              className="flex-1 border-white/10 bg-white/5 text-white placeholder:text-white/35"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!newComment.trim() || sending}
              className="bg-white text-black hover:bg-white/90"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
