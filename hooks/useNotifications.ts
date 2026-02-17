// Enhanced notifications hook with real-time support
import { useState, useCallback, useEffect, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';
import * as notificationService from '@/lib/supabase/notificationService';

// Re-export types
export type { Notification, NotificationWithUser } from '@/lib/supabase/notificationService';

// ============================================
// NOTIFICATIONS HOOK WITH REAL-TIME
// ============================================

interface UseNotificationsOptions {
  enableRealtime?: boolean;
  limit?: number;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { enableRealtime = true, limit = 50 } = options;
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<notificationService.NotificationWithUser[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const channelRef = useRef<RealtimeChannel | null>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async (refresh = false) => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    if (refresh) {
      setIsRefreshing(true);
      setOffset(0);
    } else {
      setIsLoading(true);
    }

    const currentOffset = refresh ? 0 : offset;

    const [{ data }, { count }] = await Promise.all([
      notificationService.getNotifications(user.id, limit, currentOffset),
      notificationService.getUnreadCount(user.id),
    ]);

    if (refresh) {
      setNotifications(data || []);
    } else {
      setNotifications(prev => [...prev, ...(data || [])]);
    }

    setUnreadCount(count);
    setHasMore((data?.length || 0) >= limit);
    setOffset(currentOffset + (data?.length || 0));
    setIsLoading(false);
    setIsRefreshing(false);
  }, [user, limit, offset]);

  // Initial load
  useEffect(() => {
    fetchNotifications(true);
  }, [user?.id]);

  // Set up real-time subscription
  useEffect(() => {
    if (!user || !enableRealtime) return;

    // Subscribe to new notifications
    channelRef.current = notificationService.subscribeToNotifications(
      user.id,
      (newNotification) => {
        // Add new notification to the top of the list
        setNotifications(prev => [newNotification, ...prev]);
        setUnreadCount(prev => prev + 1);
      }
    );

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        notificationService.unsubscribeFromNotifications(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id, enableRealtime]);

  // Refresh function
  const refresh = useCallback(() => fetchNotifications(true), [fetchNotifications]);

  // Load more function
  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchNotifications(false);
    }
  }, [isLoading, hasMore, fetchNotifications]);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;

    const { success } = await notificationService.markAsRead(notificationId, user.id);

    if (success) {
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  }, [user]);

  // Mark multiple notifications as read
  const markMultipleAsRead = useCallback(async (notificationIds: string[]) => {
    if (!user || notificationIds.length === 0) return;

    const { success } = await notificationService.markMultipleAsRead(notificationIds, user.id);

    if (success) {
      setNotifications(prev =>
        prev.map(n => notificationIds.includes(n.id) ? { ...n, is_read: true } : n)
      );
      // Count how many were actually unread
      const unreadMarked = notifications.filter(
        n => notificationIds.includes(n.id) && !n.is_read
      ).length;
      setUnreadCount(prev => Math.max(0, prev - unreadMarked));
    }
  }, [user, notifications]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    const { success } = await notificationService.markAllAsRead(user.id);

    if (success) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  }, [user]);

  return {
    notifications,
    unreadCount,
    isLoading,
    isRefreshing,
    hasMore,
    refresh,
    loadMore,
    markAsRead,
    markMultipleAsRead,
    markAllAsRead,
  };
}

// ============================================
// UNREAD COUNT ONLY HOOK (LIGHTWEIGHT)
// ============================================

export function useUnreadNotificationCount() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const channelRef = useRef<RealtimeChannel | null>(null);

  // Fetch initial count
  const fetchCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    const { count } = await notificationService.getUnreadCount(user.id);
    setUnreadCount(count);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  // Real-time subscription for new notifications
  useEffect(() => {
    if (!user) return;

    channelRef.current = notificationService.subscribeToNotifications(
      user.id,
      () => {
        // Increment count when new notification arrives
        setUnreadCount(prev => prev + 1);
      }
    );

    return () => {
      if (channelRef.current) {
        notificationService.unsubscribeFromNotifications(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id]);

  const refresh = useCallback(() => fetchCount(), [fetchCount]);

  return { unreadCount, isLoading, refresh };
}
