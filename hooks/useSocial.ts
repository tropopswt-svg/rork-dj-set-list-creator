// Hooks for social features (following, likes, comments)
import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import * as socialService from '@/lib/supabase/socialService';

// Re-export types for convenience
export type { CommentWithUser, ActivityWithDetails, Notification } from '@/lib/supabase/socialService';

// ============================================
// FOLLOW HOOKS
// ============================================

export function useFollowUser(userId: string) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user && userId) {
      socialService.isFollowingUser(user.id, userId).then(setIsFollowing);
    }
  }, [user, userId]);

  const toggleFollow = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      if (isFollowing) {
        await socialService.unfollowUser(user.id, userId);
        setIsFollowing(false);
      } else {
        await socialService.followUser(user.id, userId);
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Follow error:', error);
    }
    setIsLoading(false);
  }, [user, userId, isFollowing]);

  return { isFollowing, isLoading, toggleFollow };
}

export function useFollowArtist(artistId: string) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user && artistId) {
      socialService.isFollowingArtist(user.id, artistId).then(setIsFollowing);
    }
  }, [user, artistId]);

  const toggleFollow = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      if (isFollowing) {
        await socialService.unfollowArtist(user.id, artistId);
        setIsFollowing(false);
      } else {
        await socialService.followArtist(user.id, artistId);
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Follow error:', error);
    }
    setIsLoading(false);
  }, [user, artistId, isFollowing]);

  return { isFollowing, isLoading, toggleFollow };
}

export function useFollowing() {
  const { user } = useAuth();
  const [following, setFollowing] = useState<socialService.FollowWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setFollowing([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data } = await socialService.getFollowing(user.id);
    setFollowing(data || []);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const followedUsers = following.filter(f => f.following_user);
  const followedArtists = following.filter(f => f.following_artist);

  return { following, followedUsers, followedArtists, isLoading, refresh };
}

export function useFollowers(userId: string) {
  const [followers, setFollowers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await socialService.getFollowers(userId);
      setFollowers(data || []);
      setIsLoading(false);
    };
    fetch();
  }, [userId]);

  return { followers, isLoading };
}

// ============================================
// LIKE HOOKS
// ============================================

export function useLikeSet(setId: string) {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user && setId) {
      socialService.hasLikedSet(user.id, setId).then(setIsLiked);
    }
  }, [user, setId]);

  const toggleLike = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      if (isLiked) {
        await socialService.unlikeSet(user.id, setId);
        setIsLiked(false);
      } else {
        await socialService.likeSet(user.id, setId);
        setIsLiked(true);
      }
    } catch (error) {
      console.error('Like error:', error);
    }
    setIsLoading(false);
  }, [user, setId, isLiked]);

  return { isLiked, isLoading, toggleLike };
}

export function useLikedSets() {
  const { user } = useAuth();
  const [likedSets, setLikedSets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setLikedSets([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data } = await socialService.getLikedSets(user.id);
    setLikedSets(data || []);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { likedSets, isLoading, refresh };
}

// ============================================
// COMMENT HOOKS
// ============================================

export function useComments(setId: string) {
  const { user } = useAuth();
  const [comments, setComments] = useState<socialService.CommentWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const { data } = await socialService.getComments(setId);
    setComments(data || []);
    setIsLoading(false);
  }, [setId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addComment = useCallback(async (
    content: string,
    parentId?: string,
    timestampSeconds?: number
  ) => {
    if (!user) return null;

    setIsSubmitting(true);
    const { data, error } = await socialService.addComment(
      user.id,
      setId,
      content,
      parentId,
      timestampSeconds
    );
    setIsSubmitting(false);

    if (!error && data) {
      await refresh();
    }

    return { data, error };
  }, [user, setId, refresh]);

  const editComment = useCallback(async (commentId: string, content: string) => {
    if (!user) return null;

    const { data, error } = await socialService.editComment(commentId, user.id, content);

    if (!error) {
      await refresh();
    }

    return { data, error };
  }, [user, refresh]);

  const deleteComment = useCallback(async (commentId: string) => {
    if (!user) return null;

    const { error } = await socialService.deleteComment(commentId, user.id);

    if (!error) {
      await refresh();
    }

    return { error };
  }, [user, refresh]);

  return {
    comments,
    isLoading,
    isSubmitting,
    refresh,
    addComment,
    editComment,
    deleteComment,
  };
}

// ============================================
// SAVED SETS HOOKS
// ============================================

export function useSaveSet(setId: string) {
  const { user } = useAuth();
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user && setId) {
      socialService.isSetSaved(user.id, setId).then(setIsSaved);
    }
  }, [user, setId]);

  const toggleSave = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      if (isSaved) {
        await socialService.unsaveSet(user.id, setId);
        setIsSaved(false);
      } else {
        await socialService.saveSet(user.id, setId);
        setIsSaved(true);
      }
    } catch (error) {
      console.error('Save error:', error);
    }
    setIsLoading(false);
  }, [user, setId, isSaved]);

  return { isSaved, isLoading, toggleSave };
}

export function useSavedSets() {
  const { user } = useAuth();
  const [savedSets, setSavedSets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setSavedSets([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data } = await socialService.getSavedSets(user.id);
    setSavedSets(data || []);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { savedSets, isLoading, refresh };
}

// ============================================
// ACTIVITY FEED HOOKS
// ============================================

export function useFeed(limit = 50) {
  const { user } = useAuth();
  const [feed, setFeed] = useState<socialService.ActivityWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const loadFeed = useCallback(async (refresh = false) => {
    if (!user) {
      setFeed([]);
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
    const { data } = await socialService.getFeed(user.id, limit, currentOffset);

    if (refresh) {
      setFeed(data || []);
    } else {
      setFeed(prev => [...prev, ...(data || [])]);
    }

    setHasMore((data?.length || 0) >= limit);
    setOffset(currentOffset + (data?.length || 0));
    setIsLoading(false);
    setIsRefreshing(false);
  }, [user, limit, offset]);

  useEffect(() => {
    loadFeed(true);
  }, [user]);

  const refresh = useCallback(() => loadFeed(true), [loadFeed]);
  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      loadFeed(false);
    }
  }, [isLoading, hasMore, loadFeed]);

  return { feed, isLoading, isRefreshing, hasMore, refresh, loadMore };
}

// ============================================
// NOTIFICATIONS HOOKS
// ============================================

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<socialService.Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const [{ data }, { count }] = await Promise.all([
      socialService.getNotifications(user.id),
      socialService.getUnreadNotificationCount(user.id),
    ]);
    setNotifications(data || []);
    setUnreadCount(count || 0);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;
    await socialService.markNotificationRead(notificationId, user.id);
    setUnreadCount(prev => Math.max(0, prev - 1));
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    );
  }, [user]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    await socialService.markAllNotificationsRead(user.id);
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }, [user]);

  return {
    notifications,
    unreadCount,
    isLoading,
    refresh,
    markAsRead,
    markAllAsRead,
  };
}

// ============================================
// USER PROFILE HOOKS
// ============================================

export function useUserProfile(userIdOrUsername: string) {
  const [profile, setProfile] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const isUsername = !userIdOrUsername.includes('-');
      const { data, error } = isUsername
        ? await socialService.getProfileByUsername(userIdOrUsername)
        : await socialService.getProfile(userIdOrUsername);

      if (!error && data) {
        setProfile(data);
      }
      setIsLoading(false);
    };
    fetch();
  }, [userIdOrUsername]);

  return { profile, isFollowing, isLoading };
}

export function useSearchUsers(query: string) {
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const search = async () => {
      setIsLoading(true);
      const { data } = await socialService.searchUsers(query);
      setResults(data || []);
      setIsLoading(false);
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  return { results, isLoading };
}
