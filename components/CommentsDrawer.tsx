'use client';

import { useEffect, useState, useRef } from 'react';
import { X, Send } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Comment } from '@/types/video';
import { fetchComments, postComment } from '@/lib/api';
import { formatNumber } from '@/lib/utils';

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
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && videoId) {
      loadComments();
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
    try {
      const response = await fetchComments(videoId);
      setComments(response.items);
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setLoading(false);
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
      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={comment.userAvatar || '/avatars/default.png'}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-sm">{comment.username}</span>
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(comment.timestamp)}
          </span>
        </div>
        <p className="text-sm mt-1">{comment.text}</p>
        {!isReply && (
          <button
            type="button"
            className="mt-1 text-xs font-medium text-muted-foreground hover:text-foreground"
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed bottom-0 left-0 right-0 md:right-0 md:left-auto md:top-0 md:bottom-0 md:w-96 bg-white dark:bg-gray-900 z-50 flex flex-col transition-transform duration-300 md:h-full md:max-h-full ${
          isOpen
            ? 'translate-y-0 md:translate-x-0'
            : 'translate-y-full md:translate-y-0 md:translate-x-full'
        }`}
        style={{ maxHeight: '85vh', height: 'auto' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">
            Comments {total > 0 && `(${formatNumber(total)})`}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close comments"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Comments List */}
        <ScrollArea className="flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No comments yet. Be the first!
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id}>
                  {renderCommentBody(comment)}
                  {(comment.replies?.length ?? 0) > 0 && (
                    <div className="ml-8 border-l border-gray-200 dark:border-gray-700 pl-3">
                      {comment.replies!.map((reply) => (
                        <div key={reply.id}>
                          {renderCommentBody(reply, true)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Comment Input */}
        <form
          onSubmit={handleSubmit}
          className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2"
        >
          {replyTo && (
            <div className="flex items-center justify-between rounded-md bg-muted px-2 py-1.5 text-xs">
              <span>
                Replying to <strong>@{replyTo.username}</strong>
              </span>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
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
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!newComment.trim() || sending}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
