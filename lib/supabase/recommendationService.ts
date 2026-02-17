// Recommendation service for artist and user suggestions
import { supabase } from './client';

// ============================================
// TYPES
// ============================================

export interface ArtistRecommendation {
  artist_id: string;
  artist_name: string;
  artist_slug: string;
  artist_image_url: string | null;
  recommendation_score: number;
  reason: string;
}

export interface UserRecommendation {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  recommendation_score: number;
  common_likes: number;
  common_artists: number;
  is_contact: boolean;
  mutual_followers: number;
}

export interface ContactMatch {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_following: boolean;
}

// ============================================
// RECOMMENDED ARTISTS
// ============================================

/**
 * Get recommended artists for a user based on their liked sets and similar users
 */
export async function getRecommendedArtists(
  userId: string,
  limit = 10
): Promise<{ data: ArtistRecommendation[] | null; error: any }> {
  const { data, error } = await supabase.rpc('get_recommended_artists', {
    p_user_id: userId,
    p_limit: limit,
  });

  if (error) {
    console.error('[Recommendations] Error getting recommended artists:', error);
    return { data: null, error };
  }

  return { data: data as ArtistRecommendation[], error: null };
}

// ============================================
// RECOMMENDED USERS
// ============================================

/**
 * Get recommended users to follow based on similar taste
 */
export async function getRecommendedUsers(
  userId: string,
  limit = 20
): Promise<{ data: UserRecommendation[] | null; error: any }> {
  const { data, error } = await supabase.rpc('get_recommended_users', {
    p_user_id: userId,
    p_limit: limit,
  });

  if (error) {
    console.error('[Recommendations] Error getting recommended users:', error);
    return { data: null, error };
  }

  return { data: data as UserRecommendation[], error: null };
}

// ============================================
// REFRESH RECOMMENDATIONS
// ============================================

/**
 * Refresh a user's recommendations by recalculating affinity and similarity
 */
export async function refreshUserRecommendations(userId: string): Promise<{ success: boolean; error: any }> {
  // Calculate artist affinity
  const { error: affinityError } = await supabase.rpc('calculate_user_artist_affinity', {
    p_user_id: userId,
  });

  if (affinityError) {
    console.error('[Recommendations] Error calculating artist affinity:', affinityError);
    return { success: false, error: affinityError };
  }

  // Calculate user similarity
  const { error: similarityError } = await supabase.rpc('calculate_user_similarity', {
    p_user_id: userId,
  });

  if (similarityError) {
    console.error('[Recommendations] Error calculating user similarity:', similarityError);
    return { success: false, error: similarityError };
  }

  return { success: true, error: null };
}

/**
 * Check if recommendations are stale (>12 hours old or never calculated)
 */
export async function areRecommendationsStale(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('last_recommendation_update')
    .eq('id', userId)
    .single();

  if (error || !data?.last_recommendation_update) {
    return true;
  }

  const lastUpdate = new Date(data.last_recommendation_update);
  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

  return lastUpdate < twelveHoursAgo;
}

// ============================================
// CONTACT SYNC
// ============================================

/**
 * Find friends from contact phone hashes
 */
export async function findFriendsFromContacts(
  userId: string,
  phoneHashes: string[]
): Promise<{ data: ContactMatch[] | null; error: any }> {
  if (phoneHashes.length === 0) {
    return { data: [], error: null };
  }

  const { data, error } = await supabase.rpc('find_friends_from_contacts', {
    p_user_id: userId,
    p_phone_hashes: phoneHashes,
  });

  if (error) {
    console.error('[Recommendations] Error finding friends from contacts:', error);
    return { data: null, error };
  }

  return { data: data as ContactMatch[], error: null };
}

/**
 * Store user's phone contacts (hashed) for future matching
 */
export async function storePhoneContacts(
  userId: string,
  phoneHashes: string[]
): Promise<{ success: boolean; error: any }> {
  if (phoneHashes.length === 0) {
    return { success: true, error: null };
  }

  // Batch insert, ignoring conflicts
  const records = phoneHashes.map(hash => ({
    user_id: userId,
    phone_hash: hash,
  }));

  const { error } = await supabase
    .from('phone_contacts')
    .upsert(records, { onConflict: 'user_id,phone_hash', ignoreDuplicates: true });

  if (error) {
    console.error('[Recommendations] Error storing phone contacts:', error);
    return { success: false, error };
  }

  return { success: true, error: null };
}

/**
 * Update user's phone hash for contact matching
 */
export async function updateUserPhoneHash(
  userId: string,
  phoneHash: string
): Promise<{ success: boolean; error: any }> {
  const { error } = await supabase
    .from('profiles')
    .update({ phone_hash: phoneHash })
    .eq('id', userId);

  if (error) {
    console.error('[Recommendations] Error updating phone hash:', error);
    return { success: false, error };
  }

  return { success: true, error: null };
}

// ============================================
// AFFINITY DATA
// ============================================

/**
 * Get user's artist affinity scores
 */
export async function getUserArtistAffinity(
  userId: string,
  limit = 50
): Promise<{ data: any[] | null; error: any }> {
  const { data, error } = await supabase
    .from('user_artist_affinity')
    .select(`
      *,
      artist:artists(id, name, slug, image_url)
    `)
    .eq('user_id', userId)
    .order('affinity_score', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Recommendations] Error getting artist affinity:', error);
    return { data: null, error };
  }

  return { data, error: null };
}

/**
 * Get similar users for a user
 */
export async function getSimilarUsers(
  userId: string,
  limit = 20
): Promise<{ data: any[] | null; error: any }> {
  const { data, error } = await supabase
    .from('user_similarity')
    .select(`
      *,
      similar_user:profiles!similar_user_id(id, username, display_name, avatar_url)
    `)
    .eq('user_id', userId)
    .order('similarity_score', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Recommendations] Error getting similar users:', error);
    return { data: null, error };
  }

  return { data, error: null };
}
