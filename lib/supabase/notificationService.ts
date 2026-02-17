// Enhanced notification service with real-time support
import { supabase } from './client';
import { RealtimeChannel } from '@supabase/supabase-js';

// ============================================
// TYPES
// ============================================

export interface Notification {
  id: string;
  user_id: string;
  notification_type: string;
  from_user_id: string | null;
  set_id: string | null;
  artist_id: string | null;
  comment_id: string | null;
  contribution_id: string | null;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationWithUser extends Notification {
  from_user?: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export type NotificationCallback = (notification: NotificationWithUser) => void;

// ============================================
// REAL-TIME SUBSCRIPTION
// ============================================

/**
 * Subscribe to real-time notifications for a user
 * Returns the channel for cleanup
 */
export function subscribeToNotifications(
  userId: string,
  onNewNotification: NotificationCallback
): RealtimeChannel {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      async (payload) => {
        // Fetch the full notification with user details
        const { data } = await supabase
          .from('notifications')
          .select(`
            *,
            from_user:profiles!from_user_id(id, username, display_name, avatar_url)
          `)
          .eq('id', payload.new.id)
          .single();

        if (data) {
          onNewNotification(data as NotificationWithUser);
        }
      }
    )
    .subscribe();

  return channel;
}

/**
 * Unsubscribe from notifications channel
 */
export async function unsubscribeFromNotifications(channel: RealtimeChannel): Promise<void> {
  await supabase.removeChannel(channel);
}

// ============================================
// FETCH NOTIFICATIONS
// ============================================

/**
 * Get user's notifications with pagination
 */
export async function getNotifications(
  userId: string,
  limit = 50,
  offset = 0
): Promise<{ data: NotificationWithUser[] | null; error: any }> {
  const { data, error } = await supabase
    .from('notifications')
    .select(`
      *,
      from_user:profiles!from_user_id(id, username, display_name, avatar_url)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[Notifications] Error getting notifications:', error);
    return { data: null, error };
  }

  return { data: data as NotificationWithUser[], error: null };
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: string): Promise<{ count: number; error: any }> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('[Notifications] Error getting unread count:', error);
    return { count: 0, error };
  }

  return { count: count || 0, error: null };
}

// ============================================
// MARK AS READ
// ============================================

/**
 * Mark a single notification as read
 */
export async function markAsRead(
  notificationId: string,
  userId: string
): Promise<{ success: boolean; error: any }> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    console.error('[Notifications] Error marking as read:', error);
    return { success: false, error };
  }

  return { success: true, error: null };
}

/**
 * Mark multiple notifications as read
 */
export async function markMultipleAsRead(
  notificationIds: string[],
  userId: string
): Promise<{ success: boolean; error: any }> {
  if (notificationIds.length === 0) {
    return { success: true, error: null };
  }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .in('id', notificationIds)
    .eq('user_id', userId);

  if (error) {
    console.error('[Notifications] Error marking multiple as read:', error);
    return { success: false, error };
  }

  return { success: true, error: null };
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<{ success: boolean; error: any }> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('[Notifications] Error marking all as read:', error);
    return { success: false, error };
  }

  return { success: true, error: null };
}

// ============================================
// CREATE NOTIFICATIONS
// ============================================

interface CreateNotificationParams {
  user_id: string;
  notification_type: string;
  title: string;
  body?: string;
  from_user_id?: string;
  set_id?: string;
  artist_id?: string;
  comment_id?: string;
  contribution_id?: string;
}

/**
 * Create a notification (used internally by other services)
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<{ data: Notification | null; error: any }> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: params.user_id,
      notification_type: params.notification_type,
      title: params.title,
      body: params.body || null,
      from_user_id: params.from_user_id || null,
      set_id: params.set_id || null,
      artist_id: params.artist_id || null,
      comment_id: params.comment_id || null,
      contribution_id: params.contribution_id || null,
    })
    .select()
    .single();

  if (error) {
    console.error('[Notifications] Error creating notification:', error);
    return { data: null, error };
  }

  return { data: data as Notification, error: null };
}

/**
 * Create a follow notification
 */
export async function createFollowNotification(
  targetUserId: string,
  fromUserId: string,
  fromUsername: string
): Promise<void> {
  await createNotification({
    user_id: targetUserId,
    notification_type: 'new_follower',
    title: `${fromUsername} started following you`,
    from_user_id: fromUserId,
  });
}

/**
 * Create a comment reply notification
 */
export async function createCommentReplyNotification(
  targetUserId: string,
  fromUserId: string,
  fromUsername: string,
  setId: string,
  commentId: string
): Promise<void> {
  await createNotification({
    user_id: targetUserId,
    notification_type: 'comment_reply',
    title: `${fromUsername} replied to your comment`,
    from_user_id: fromUserId,
    set_id: setId,
    comment_id: commentId,
  });
}

/**
 * Create a contribution verified notification
 */
export async function createContributionVerifiedNotification(
  targetUserId: string,
  setName: string,
  contributionId: string,
  pointsAwarded: number
): Promise<void> {
  await createNotification({
    user_id: targetUserId,
    notification_type: 'contribution_verified',
    title: 'Your track ID was verified!',
    body: `Your contribution to "${setName}" was verified. You earned ${pointsAwarded} points!`,
    contribution_id: contributionId,
  });
}

/**
 * Create an artist new set notification (for followers)
 */
export async function createArtistNewSetNotification(
  targetUserId: string,
  artistId: string,
  artistName: string,
  setId: string,
  setName: string
): Promise<void> {
  await createNotification({
    user_id: targetUserId,
    notification_type: 'artist_new_set',
    title: `${artistName} has a new set!`,
    body: setName,
    artist_id: artistId,
    set_id: setId,
  });
}

// ============================================
// DELETE NOTIFICATIONS
// ============================================

/**
 * Delete old notifications (cleanup, older than 30 days)
 */
export async function deleteOldNotifications(userId: string): Promise<{ success: boolean; error: any }> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId)
    .eq('is_read', true)
    .lt('created_at', thirtyDaysAgo);

  if (error) {
    console.error('[Notifications] Error deleting old notifications:', error);
    return { success: false, error };
  }

  return { success: true, error: null };
}
