// Social features service for follows, likes, comments, and activity feed
import { supabase } from './client';

// ============================================
// FOLLOWS
// ============================================

export interface Follow {
  id: string;
  follower_id: string;
  following_user_id: string | null;
  following_artist_id: string | null;
  created_at: string;
}

export interface FollowWithDetails extends Follow {
  // When following a user
  following_user?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string;
  };
  // When following an artist
  following_artist?: {
    id: string;
    name: string;
    slug: string;
    image_url: string;
  };
}

// Follow a user
export async function followUser(followerId: string, userId: string) {
  const { data, error } = await supabase
    .from('follows')
    .insert({
      follower_id: followerId,
      following_user_id: userId,
    })
    .select()
    .single();

  if (!error) {
    // Create activity
    await createActivity({
      user_id: followerId,
      activity_type: 'follow_user',
      target_user_id: userId,
    });
  }

  return { data, error };
}

// Follow an artist
export async function followArtist(followerId: string, artistId: string) {
  const { data, error } = await supabase
    .from('follows')
    .insert({
      follower_id: followerId,
      following_artist_id: artistId,
    })
    .select()
    .single();

  if (!error) {
    // Create activity
    await createActivity({
      user_id: followerId,
      activity_type: 'follow_artist',
      artist_id: artistId,
    });
  }

  return { data, error };
}

// Unfollow a user
export async function unfollowUser(followerId: string, userId: string) {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_user_id', userId);

  return { error };
}

// Unfollow an artist
export async function unfollowArtist(followerId: string, artistId: string) {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_artist_id', artistId);

  return { error };
}

// Check if following a user
export async function isFollowingUser(followerId: string, userId: string) {
  const { data } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_user_id', userId)
    .single();

  return !!data;
}

// Check if following an artist
export async function isFollowingArtist(followerId: string, artistId: string) {
  const { data } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_artist_id', artistId)
    .single();

  return !!data;
}

// Get user's following list (both users and artists)
export async function getFollowing(userId: string) {
  const { data, error } = await supabase
    .from('follows')
    .select(`
      *,
      following_user:profiles!following_user_id(id, username, display_name, avatar_url),
      following_artist:artists!following_artist_id(id, name, slug, image_url)
    `)
    .eq('follower_id', userId)
    .order('created_at', { ascending: false });

  return { data: data as FollowWithDetails[] | null, error };
}

// Get user's followers
export async function getFollowers(userId: string) {
  const { data, error } = await supabase
    .from('follows')
    .select(`
      *,
      follower:profiles!follower_id(id, username, display_name, avatar_url)
    `)
    .eq('following_user_id', userId)
    .order('created_at', { ascending: false });

  return { data, error };
}

// Get user's followers list with pagination
export async function getFollowersList(userId: string, limit = 50, offset = 0) {
  const { data, error } = await supabase
    .from('follows')
    .select(`
      id,
      created_at,
      follower:profiles!follower_id(
        id,
        username,
        display_name,
        avatar_url,
        bio,
        followers_count,
        following_count
      )
    `)
    .eq('following_user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  return { data, error };
}

// Get user's following list with pagination (both users and artists)
export async function getFollowingList(userId: string, limit = 50, offset = 0) {
  const { data, error } = await supabase
    .from('follows')
    .select(`
      id,
      created_at,
      following_user_id,
      following_artist_id,
      following_user:profiles!following_user_id(
        id,
        username,
        display_name,
        avatar_url,
        bio,
        followers_count
      ),
      following_artist:artists!following_artist_id(
        id,
        name,
        slug,
        image_url,
        bio,
        followers_count
      )
    `)
    .eq('follower_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  return { data, error };
}

// Get mutual followers count between two users
export async function getMutualFollowersCount(userId: string, targetUserId: string): Promise<{ count: number; error: any }> {
  // Get followers of the current user who also follow the target user
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_user_id', userId);

  if (error || !data) {
    return { count: 0, error };
  }

  const userFollowerIds = data.map(f => f.follower_id);

  if (userFollowerIds.length === 0) {
    return { count: 0, error: null };
  }

  // Count how many of these also follow the target user
  const { count, error: countError } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_user_id', targetUserId)
    .in('follower_id', userFollowerIds);

  return { count: count || 0, error: countError };
}

// Get mutual followers list (up to a limit)
export async function getMutualFollowers(userId: string, targetUserId: string, limit = 10) {
  // Get followers of the current user
  const { data: userFollowers, error: error1 } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_user_id', userId);

  if (error1 || !userFollowers) {
    return { data: [], error: error1 };
  }

  const userFollowerIds = userFollowers.map(f => f.follower_id);

  if (userFollowerIds.length === 0) {
    return { data: [], error: null };
  }

  // Get followers of target user who are also followers of current user
  const { data, error } = await supabase
    .from('follows')
    .select(`
      follower:profiles!follower_id(id, username, display_name, avatar_url)
    `)
    .eq('following_user_id', targetUserId)
    .in('follower_id', userFollowerIds)
    .limit(limit);

  return { data: data?.map(d => d.follower) || [], error };
}

// Get artist's followers count
export async function getArtistFollowersCount(artistId: string) {
  const { count, error } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_artist_id', artistId);

  return { count: count || 0, error };
}

// ============================================
// LIKES
// ============================================

export interface Like {
  id: string;
  user_id: string;
  set_id: string;
  created_at: string;
}

// Like a set
export async function likeSet(userId: string, setId: string) {
  const { data, error } = await supabase
    .from('likes')
    .insert({
      user_id: userId,
      set_id: setId,
    })
    .select()
    .single();

  if (!error) {
    // Create activity
    await createActivity({
      user_id: userId,
      activity_type: 'like_set',
      set_id: setId,
    });
  }

  return { data, error };
}

// Unlike a set
export async function unlikeSet(userId: string, setId: string) {
  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('user_id', userId)
    .eq('set_id', setId);

  return { error };
}

// Check if user liked a set
export async function hasLikedSet(userId: string, setId: string) {
  const { data } = await supabase
    .from('likes')
    .select('id')
    .eq('user_id', userId)
    .eq('set_id', setId)
    .single();

  return !!data;
}

// Get user's liked sets
export async function getLikedSets(userId: string, limit = 50) {
  const { data, error } = await supabase
    .from('likes')
    .select(`
      *,
      set:sets(*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return { data, error };
}

// Get set's like count
export async function getSetLikesCount(setId: string) {
  const { count, error } = await supabase
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('set_id', setId);

  return { count: count || 0, error };
}

// ============================================
// COMMENTS
// ============================================

export interface Comment {
  id: string;
  user_id: string;
  set_id: string;
  content: string;
  parent_id: string | null;
  timestamp_seconds: number | null;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommentWithUser extends Comment {
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string;
  };
  replies?: CommentWithUser[];
}

// Add a comment
export async function addComment(
  userId: string,
  setId: string,
  content: string,
  parentId?: string,
  timestampSeconds?: number
) {
  const { data, error } = await supabase
    .from('comments')
    .insert({
      user_id: userId,
      set_id: setId,
      content,
      parent_id: parentId || null,
      timestamp_seconds: timestampSeconds || null,
    })
    .select()
    .single();

  if (!error && data) {
    // Create activity
    await createActivity({
      user_id: userId,
      activity_type: 'comment',
      set_id: setId,
      comment_id: data.id,
    });
  }

  return { data, error };
}

// Edit a comment
export async function editComment(commentId: string, userId: string, content: string) {
  const { data, error } = await supabase
    .from('comments')
    .update({
      content,
      is_edited: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', commentId)
    .eq('user_id', userId) // Ensure user owns comment
    .select()
    .single();

  return { data, error };
}

// Delete a comment (soft delete)
export async function deleteComment(commentId: string, userId: string) {
  const { error } = await supabase
    .from('comments')
    .update({
      is_deleted: true,
      content: '[deleted]',
      updated_at: new Date().toISOString(),
    })
    .eq('id', commentId)
    .eq('user_id', userId);

  return { error };
}

// Get comments for a set
export async function getComments(setId: string, limit = 50) {
  const { data, error } = await supabase
    .from('comments')
    .select(`
      *,
      user:profiles!user_id(id, username, display_name, avatar_url)
    `)
    .eq('set_id', setId)
    .eq('is_deleted', false)
    .is('parent_id', null) // Only top-level comments
    .order('created_at', { ascending: true })
    .limit(limit);

  if (data) {
    // Fetch replies for each comment
    for (const comment of data) {
      const { data: replies } = await supabase
        .from('comments')
        .select(`
          *,
          user:profiles!user_id(id, username, display_name, avatar_url)
        `)
        .eq('parent_id', comment.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      (comment as CommentWithUser).replies = replies as CommentWithUser[] || [];
    }
  }

  return { data: data as CommentWithUser[] | null, error };
}

// ============================================
// SAVED SETS
// ============================================

export interface SavedSet {
  id: string;
  user_id: string;
  set_id: string;
  collection_name: string | null;
  created_at: string;
}

// Save a set
export async function saveSet(userId: string, setId: string, collectionName?: string) {
  const { data, error } = await supabase
    .from('saved_sets')
    .insert({
      user_id: userId,
      set_id: setId,
      collection_name: collectionName || null,
    })
    .select()
    .single();

  if (!error) {
    // Create activity
    await createActivity({
      user_id: userId,
      activity_type: 'save_set',
      set_id: setId,
    });
  }

  return { data, error };
}

// Unsave a set
export async function unsaveSet(userId: string, setId: string) {
  const { error } = await supabase
    .from('saved_sets')
    .delete()
    .eq('user_id', userId)
    .eq('set_id', setId);

  return { error };
}

// Check if set is saved
export async function isSetSaved(userId: string, setId: string) {
  const { data } = await supabase
    .from('saved_sets')
    .select('id')
    .eq('user_id', userId)
    .eq('set_id', setId)
    .single();

  return !!data;
}

// Get user's saved sets
export async function getSavedSets(userId: string, limit = 50) {
  const { data, error } = await supabase
    .from('saved_sets')
    .select(`
      *,
      set:sets(*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return { data, error };
}

// ============================================
// CONTRIBUTIONS
// ============================================

export interface Contribution {
  id: string;
  user_id: string;
  set_id: string;
  set_track_id: string | null;
  contribution_type: 'track_id' | 'source_link' | 'correction' | 'verification';
  track_title: string | null;
  track_artist: string | null;
  timestamp_seconds: number | null;
  source_url: string | null;
  source_platform: string | null;
  status: 'pending' | 'verified' | 'rejected';
  points_awarded: number;
  created_at: string;
  verified_at: string | null;
  verified_by: string | null;
}

// Create a contribution (track ID)
export async function createTrackContribution(
  userId: string,
  setId: string,
  trackTitle: string,
  trackArtist: string,
  timestampSeconds: number,
  setTrackId?: string
) {
  const { data, error } = await supabase
    .from('contributions')
    .insert({
      user_id: userId,
      set_id: setId,
      set_track_id: setTrackId || null,
      contribution_type: 'track_id',
      track_title: trackTitle,
      track_artist: trackArtist,
      timestamp_seconds: timestampSeconds,
      points_awarded: 15, // Default points for track ID
    })
    .select()
    .single();

  if (!error && data) {
    // Create activity
    await createActivity({
      user_id: userId,
      activity_type: 'track_id',
      set_id: setId,
      contribution_id: data.id,
      metadata: {
        track_title: trackTitle,
        track_artist: trackArtist,
        timestamp: timestampSeconds,
      },
    });
  }

  return { data, error };
}

// Create a contribution (source link)
export async function createSourceContribution(
  userId: string,
  setId: string,
  sourceUrl: string,
  sourcePlatform: string
) {
  const { data, error } = await supabase
    .from('contributions')
    .insert({
      user_id: userId,
      set_id: setId,
      contribution_type: 'source_link',
      source_url: sourceUrl,
      source_platform: sourcePlatform,
      points_awarded: 25, // Default points for source link
    })
    .select()
    .single();

  return { data, error };
}

// Get user's contributions
export async function getUserContributions(userId: string, limit = 50) {
  const { data, error } = await supabase
    .from('contributions')
    .select(`
      *,
      set:sets(id, name, artist_name, cover_url)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return { data, error };
}

// ============================================
// ACTIVITY FEED
// ============================================

export interface Activity {
  id: string;
  user_id: string;
  activity_type: string;
  set_id: string | null;
  artist_id: string | null;
  target_user_id: string | null;
  contribution_id: string | null;
  comment_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface ActivityWithDetails extends Activity {
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string;
  };
  set?: {
    id: string;
    name: string;
    artist_name: string;
    cover_url: string;
  };
  artist?: {
    id: string;
    name: string;
    slug: string;
    image_url: string;
  };
  target_user?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string;
  };
}

// Create an activity (internal use)
async function createActivity(activity: Partial<Omit<Activity, 'id' | 'created_at'>> & { user_id: string; activity_type: string }) {
  const { error } = await supabase
    .from('activity')
    .insert(activity);

  if (error) {
    if (__DEV__) console.error('[Social] Error creating activity:', error);
  }
}

// Get feed for a user (activities from people they follow)
export async function getFeed(userId: string, limit = 50, offset = 0) {
  // First get the list of users and artists this user follows
  const { data: following } = await getFollowing(userId);

  if (!following || following.length === 0) {
    return { data: [], error: null };
  }

  const followedUserIds = following
    .filter(f => f.following_user_id)
    .map(f => f.following_user_id!);

  const followedArtistIds = following
    .filter(f => f.following_artist_id)
    .map(f => f.following_artist_id!);

  // Build query for user activities
  let query = supabase
    .from('activity')
    .select(`
      *,
      user:profiles!user_id(id, username, display_name, avatar_url),
      set:sets(id, name, artist_name, cover_url),
      artist:artists(id, name, slug, image_url),
      target_user:profiles!target_user_id(id, username, display_name, avatar_url)
    `)
    .in('activity_type', ['track_id', 'new_set']) // Only show sets + contributions per user preference
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Filter by followed users OR followed artists
  if (followedUserIds.length > 0 && followedArtistIds.length > 0) {
    query = query.or(`user_id.in.(${followedUserIds.join(',')}),artist_id.in.(${followedArtistIds.join(',')})`);
  } else if (followedUserIds.length > 0) {
    query = query.in('user_id', followedUserIds);
  } else if (followedArtistIds.length > 0) {
    query = query.in('artist_id', followedArtistIds);
  }

  const { data, error } = await query;

  return { data: data as ActivityWithDetails[] | null, error };
}

// Get a user's own activity
export async function getUserActivity(userId: string, limit = 50) {
  const { data, error } = await supabase
    .from('activity')
    .select(`
      *,
      user:profiles!user_id(id, username, display_name, avatar_url),
      set:sets(id, name, artist_name, cover_url),
      artist:artists(id, name, slug, image_url)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return { data: data as ActivityWithDetails[] | null, error };
}

// ============================================
// NOTIFICATIONS
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

// Get user's notifications
export async function getNotifications(userId: string, limit = 50) {
  const { data, error } = await supabase
    .from('notifications')
    .select(`
      *,
      from_user:profiles!from_user_id(id, username, display_name, avatar_url)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return { data, error };
}

// Get unread notification count
export async function getUnreadNotificationCount(userId: string) {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  return { count: count || 0, error };
}

// Mark notification as read
export async function markNotificationRead(notificationId: string, userId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);

  return { error };
}

// Mark all notifications as read
export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  return { error };
}

// ============================================
// PROFILE LOOKUPS
// ============================================

// Get a user's public profile
export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  return { data, error };
}

// Get a user's profile by username
export async function getProfileByUsername(username: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username.toLowerCase())
    .single();

  return { data, error };
}

// Search users by username or display name
export async function searchUsers(query: string, limit = 20) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio')
    .eq('is_public', true)
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .limit(limit);

  return { data, error };
}
