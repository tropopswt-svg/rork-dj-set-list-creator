import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Send, MessageCircle, Reply, MoreHorizontal, Trash2, Edit2, Clock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useComments, CommentWithUser } from '@/hooks/useSocial';

interface CommentsSectionProps {
  setId: string;
}

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

function formatTimestamp(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function CommentItem({
  comment,
  onReply,
  onDelete,
  currentUserId,
}: {
  comment: CommentWithUser;
  onReply: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  currentUserId?: string;
}) {
  const router = useRouter();
  const isOwnComment = currentUserId === comment.user_id;

  return (
    <View style={styles.commentItem}>
      <Pressable
        onPress={() => router.push(`/user/${comment.user?.username}`)}
      >
        <Image
          source={{ uri: comment.user?.avatar_url || 'https://via.placeholder.com/40' }}
          style={styles.commentAvatar}
          placeholder={{ blurhash: 'L9B:x]of00ay~qj[M{ay-;j[RjfQ' }}
          transition={250}
        />
      </Pressable>

      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Pressable
            onPress={() => router.push(`/user/${comment.user?.username}`)}
          >
            <Text style={styles.commentUsername}>
              {comment.user?.display_name || comment.user?.username || 'User'}
            </Text>
          </Pressable>
          <Text style={styles.commentTime}>{formatTimeAgo(comment.created_at)}</Text>
          {comment.is_edited && (
            <Text style={styles.editedLabel}>(edited)</Text>
          )}
        </View>

        {comment.timestamp_seconds && (
          <View style={styles.timestampBadge}>
            <Clock size={10} color={Colors.dark.primary} />
            <Text style={styles.timestampText}>
              {formatTimestamp(comment.timestamp_seconds)}
            </Text>
          </View>
        )}

        <Text style={styles.commentText}>{comment.content}</Text>

        <View style={styles.commentActions}>
          <Pressable
            style={styles.commentAction}
            onPress={() => {
              Haptics.selectionAsync();
              onReply(comment.id);
            }}
          >
            <Reply size={14} color={Colors.dark.textMuted} />
            <Text style={styles.commentActionText}>Reply</Text>
          </Pressable>

          {isOwnComment && (
            <Pressable
              style={styles.commentAction}
              onPress={() => {
                Haptics.selectionAsync();
                onDelete(comment.id);
              }}
            >
              <Trash2 size={14} color={Colors.dark.textMuted} />
              <Text style={styles.commentActionText}>Delete</Text>
            </Pressable>
          )}
        </View>

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <View style={styles.repliesContainer}>
            {comment.replies.map((reply) => (
              <View key={reply.id} style={styles.replyItem}>
                <Pressable
                  onPress={() => router.push(`/user/${reply.user?.username}`)}
                >
                  <Image
                    source={{ uri: reply.user?.avatar_url || 'https://via.placeholder.com/32' }}
                    style={styles.replyAvatar}
                    placeholder={{ blurhash: 'L9B:x]of00ay~qj[M{ay-;j[RjfQ' }}
                    transition={250}
                  />
                </Pressable>
                <View style={styles.replyContent}>
                  <View style={styles.replyHeader}>
                    <Text style={styles.replyUsername}>
                      {reply.user?.display_name || reply.user?.username || 'User'}
                    </Text>
                    <Text style={styles.replyTime}>{formatTimeAgo(reply.created_at)}</Text>
                  </View>
                  <Text style={styles.replyText}>{reply.content}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

export default function CommentsSection({ setId }: CommentsSectionProps) {
  const router = useRouter();
  const { isAuthenticated, user, profile } = useAuth();
  const {
    comments,
    isLoading,
    isSubmitting,
    addComment,
    deleteComment,
  } = useComments(setId);

  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await addComment(newComment.trim(), replyingTo || undefined);

    if (!result?.error) {
      setNewComment('');
      setReplyingTo(null);
    }
  };

  const handleReply = (commentId: string) => {
    setReplyingTo(commentId);
  };

  const handleDelete = async (commentId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await deleteComment(commentId);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MessageCircle size={20} color={Colors.dark.text} />
        <Text style={styles.headerTitle}>Comments</Text>
        <Text style={styles.commentCount}>{comments.length}</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.dark.primary} />
        </View>
      ) : comments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No comments yet</Text>
          <Text style={styles.emptySubtext}>Be the first to comment!</Text>
        </View>
      ) : (
        <View style={styles.commentsList}>
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onReply={handleReply}
              onDelete={handleDelete}
              currentUserId={user?.id}
            />
          ))}
        </View>
      )}

      {/* Reply indicator */}
      {replyingTo && (
        <View style={styles.replyingToBar}>
          <Text style={styles.replyingToText}>Replying to comment</Text>
          <Pressable onPress={handleCancelReply}>
            <Text style={styles.cancelReplyText}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {/* Comment input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <View style={styles.inputContainer}>
          {isAuthenticated ? (
            <>
              <Image
                source={{ uri: profile?.avatar_url || 'https://via.placeholder.com/36' }}
                style={styles.inputAvatar}
                placeholder={{ blurhash: 'L9B:x]of00ay~qj[M{ay-;j[RjfQ' }}
                transition={250}
              />
              <TextInput
                style={styles.input}
                placeholder={replyingTo ? "Write a reply..." : "Add a comment..."}
                placeholderTextColor={Colors.dark.textMuted}
                value={newComment}
                onChangeText={setNewComment}
                multiline
                maxLength={1000}
              />
              <Pressable
                style={[
                  styles.sendButton,
                  (!newComment.trim() || isSubmitting) && styles.sendButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!newComment.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Send size={18} color="#fff" />
                )}
              </Pressable>
            </>
          ) : (
            <Pressable
              style={styles.loginPrompt}
              onPress={() => router.push('/(auth)/login')}
            >
              <Text style={styles.loginPromptText}>Log in to comment</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
    flex: 1,
  },
  commentCount: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    backgroundColor: Colors.dark.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: Colors.dark.text,
    fontWeight: '500',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },
  commentsList: {
    padding: 16,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  commentTime: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  editedLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    fontStyle: 'italic',
  },
  timestampBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${Colors.dark.primary}20`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  timestampText: {
    fontSize: 11,
    color: Colors.dark.primary,
    fontWeight: '600',
  },
  commentText: {
    fontSize: 14,
    color: Colors.dark.text,
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  commentAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentActionText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  repliesContainer: {
    marginTop: 12,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: Colors.dark.border,
  },
  replyItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 10,
  },
  replyContent: {
    flex: 1,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  replyUsername: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  replyTime: {
    fontSize: 11,
    color: Colors.dark.textMuted,
  },
  replyText: {
    fontSize: 13,
    color: Colors.dark.text,
    lineHeight: 18,
  },
  replyingToBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: `${Colors.dark.primary}15`,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  replyingToText: {
    fontSize: 13,
    color: Colors.dark.primary,
  },
  cancelReplyText: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    gap: 12,
  },
  inputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.dark.text,
    maxHeight: 100,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.dark.surfaceLight,
  },
  loginPrompt: {
    flex: 1,
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  loginPromptText: {
    fontSize: 14,
    color: Colors.dark.primary,
    fontWeight: '500',
  },
});
