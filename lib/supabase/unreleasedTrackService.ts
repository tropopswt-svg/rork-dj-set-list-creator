/**
 * Unreleased Track Service
 *
 * CRUD operations and management for unreleased/ID tracks in the database.
 * Works with the ACRCloud bucket service for fingerprinting.
 */

import { supabase, isSupabaseConfigured } from './client';

// ============================================
// Types
// ============================================

export interface DbUnreleasedTrack {
  id: string;
  title: string;
  artist: string;
  source_platform: 'soundcloud' | 'instagram' | 'tiktok' | 'manual';
  source_url: string;
  source_user: string | null;
  source_post_date: string | null;
  acrcloud_acr_id: string | null;
  acrcloud_status: 'pending' | 'uploaded' | 'failed' | 'removed';
  fingerprint_created_at: string | null;
  confidence_score: number;
  audio_duration_seconds: number | null;
  audio_quality: 'high' | 'medium' | 'low' | 'clip' | null;
  times_identified: number;
  last_identified_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}

export interface DbUnreleasedIdentification {
  id: string;
  unreleased_track_id: string;
  identified_in_set_id: string | null;
  identified_at: string;
  confidence: number;
}

export interface CreateUnreleasedTrackInput {
  title: string;
  artist: string;
  source_platform: 'soundcloud' | 'instagram' | 'tiktok' | 'manual';
  source_url: string;
  source_user?: string;
  source_post_date?: string;
  audio_duration_seconds?: number;
  audio_quality?: 'high' | 'medium' | 'low' | 'clip';
  confidence_score?: number;
  metadata?: Record<string, any>;
}

export interface UpdateUnreleasedTrackInput {
  title?: string;
  artist?: string;
  acrcloud_acr_id?: string;
  acrcloud_status?: 'pending' | 'uploaded' | 'failed' | 'removed';
  fingerprint_created_at?: string;
  confidence_score?: number;
  audio_duration_seconds?: number;
  audio_quality?: 'high' | 'medium' | 'low' | 'clip';
  is_active?: boolean;
  metadata?: Record<string, any>;
}

export interface UnreleasedTrackFilters {
  platform?: 'soundcloud' | 'instagram' | 'tiktok' | 'manual';
  status?: 'pending' | 'uploaded' | 'failed' | 'removed';
  isActive?: boolean;
  artist?: string;
  search?: string;
}

// ============================================
// CRUD Operations
// ============================================

/**
 * Create a new unreleased track entry
 */
export async function createUnreleasedTrack(
  input: CreateUnreleasedTrackInput
): Promise<DbUnreleasedTrack | null> {
  if (!isSupabaseConfigured()) {
    console.warn('[UnreleasedTrackService] Supabase not configured');
    return null;
  }

  const { data, error } = await supabase
    .from('unreleased_tracks')
    .insert({
      title: input.title,
      artist: input.artist,
      source_platform: input.source_platform,
      source_url: input.source_url,
      source_user: input.source_user || null,
      source_post_date: input.source_post_date || null,
      audio_duration_seconds: input.audio_duration_seconds || null,
      audio_quality: input.audio_quality || null,
      confidence_score: input.confidence_score ?? 0.5,
      metadata: input.metadata || {},
    })
    .select()
    .single();

  if (error) {
    console.error('[UnreleasedTrackService] Error creating track:', error);
    return null;
  }

  return data as DbUnreleasedTrack;
}

/**
 * Get unreleased track by ID
 */
export async function getUnreleasedTrack(id: string): Promise<DbUnreleasedTrack | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('unreleased_tracks')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[UnreleasedTrackService] Error fetching track:', error);
    return null;
  }

  return data as DbUnreleasedTrack;
}

/**
 * Get unreleased track by ACRCloud ID
 */
export async function getUnreleasedTrackByAcrId(
  acrId: string
): Promise<DbUnreleasedTrack | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('unreleased_tracks')
    .select('*')
    .eq('acrcloud_acr_id', acrId)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned
    console.error('[UnreleasedTrackService] Error fetching track by ACR ID:', error);
  }

  return data as DbUnreleasedTrack | null;
}

/**
 * Get unreleased track by source URL
 */
export async function getUnreleasedTrackBySourceUrl(
  sourceUrl: string
): Promise<DbUnreleasedTrack | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('unreleased_tracks')
    .select('*')
    .eq('source_url', sourceUrl)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[UnreleasedTrackService] Error fetching track by source URL:', error);
  }

  return data as DbUnreleasedTrack | null;
}

/**
 * Update an unreleased track
 */
export async function updateUnreleasedTrack(
  id: string,
  input: UpdateUnreleasedTrackInput
): Promise<DbUnreleasedTrack | null> {
  if (!isSupabaseConfigured()) return null;

  const updateData: Record<string, any> = {};

  if (input.title !== undefined) updateData.title = input.title;
  if (input.artist !== undefined) updateData.artist = input.artist;
  if (input.acrcloud_acr_id !== undefined) updateData.acrcloud_acr_id = input.acrcloud_acr_id;
  if (input.acrcloud_status !== undefined) updateData.acrcloud_status = input.acrcloud_status;
  if (input.fingerprint_created_at !== undefined)
    updateData.fingerprint_created_at = input.fingerprint_created_at;
  if (input.confidence_score !== undefined) updateData.confidence_score = input.confidence_score;
  if (input.audio_duration_seconds !== undefined)
    updateData.audio_duration_seconds = input.audio_duration_seconds;
  if (input.audio_quality !== undefined) updateData.audio_quality = input.audio_quality;
  if (input.is_active !== undefined) updateData.is_active = input.is_active;
  if (input.metadata !== undefined) updateData.metadata = input.metadata;

  const { data, error } = await supabase
    .from('unreleased_tracks')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[UnreleasedTrackService] Error updating track:', error);
    return null;
  }

  return data as DbUnreleasedTrack;
}

/**
 * Delete an unreleased track
 */
export async function deleteUnreleasedTrack(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase.from('unreleased_tracks').delete().eq('id', id);

  if (error) {
    console.error('[UnreleasedTrackService] Error deleting track:', error);
    return false;
  }

  return true;
}

/**
 * List unreleased tracks with filters
 */
export async function listUnreleasedTracks(
  filters: UnreleasedTrackFilters = {},
  limit: number = 50,
  offset: number = 0
): Promise<{ tracks: DbUnreleasedTrack[]; total: number }> {
  if (!isSupabaseConfigured()) return { tracks: [], total: 0 };

  let query = supabase
    .from('unreleased_tracks')
    .select('*', { count: 'exact' });

  // Apply filters
  if (filters.platform) {
    query = query.eq('source_platform', filters.platform);
  }
  if (filters.status) {
    query = query.eq('acrcloud_status', filters.status);
  }
  if (filters.isActive !== undefined) {
    query = query.eq('is_active', filters.isActive);
  }
  if (filters.artist) {
    query = query.ilike('artist', `%${filters.artist}%`);
  }
  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,artist.ilike.%${filters.search}%`);
  }

  // Pagination and ordering
  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('[UnreleasedTrackService] Error listing tracks:', error);
    return { tracks: [], total: 0 };
  }

  return {
    tracks: (data || []) as DbUnreleasedTrack[],
    total: count || 0,
  };
}

/**
 * Get tracks pending upload to ACRCloud
 */
export async function getPendingUploads(limit: number = 50): Promise<DbUnreleasedTrack[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('unreleased_tracks')
    .select('*')
    .eq('acrcloud_status', 'pending')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[UnreleasedTrackService] Error fetching pending uploads:', error);
    return [];
  }

  return (data || []) as DbUnreleasedTrack[];
}

/**
 * Mark track as uploaded to ACRCloud
 */
export async function markAsUploaded(
  id: string,
  acrId: string
): Promise<DbUnreleasedTrack | null> {
  return updateUnreleasedTrack(id, {
    acrcloud_acr_id: acrId,
    acrcloud_status: 'uploaded',
    fingerprint_created_at: new Date().toISOString(),
  });
}

/**
 * Mark track upload as failed
 */
export async function markAsFailed(
  id: string,
  errorMessage?: string
): Promise<DbUnreleasedTrack | null> {
  const track = await getUnreleasedTrack(id);
  const metadata = track?.metadata || {};

  return updateUnreleasedTrack(id, {
    acrcloud_status: 'failed',
    metadata: {
      ...metadata,
      lastError: errorMessage,
      lastErrorAt: new Date().toISOString(),
    },
  });
}

// ============================================
// Identification Tracking
// ============================================

/**
 * Record when an unreleased track is identified
 */
export async function recordIdentification(
  unreleasedTrackId: string,
  setId: string | null,
  confidence: number
): Promise<DbUnreleasedIdentification | null> {
  if (!isSupabaseConfigured()) return null;

  // Insert identification record
  const { data: identification, error: identError } = await supabase
    .from('unreleased_identifications')
    .insert({
      unreleased_track_id: unreleasedTrackId,
      identified_in_set_id: setId,
      confidence,
    })
    .select()
    .single();

  if (identError) {
    console.error('[UnreleasedTrackService] Error recording identification:', identError);
    return null;
  }

  // Update track stats
  const track = await getUnreleasedTrack(unreleasedTrackId);
  if (track) {
    await supabase
      .from('unreleased_tracks')
      .update({
        times_identified: (track.times_identified || 0) + 1,
        last_identified_at: new Date().toISOString(),
      })
      .eq('id', unreleasedTrackId);
  }

  return identification as DbUnreleasedIdentification;
}

/**
 * Get identification history for a track
 */
export async function getIdentificationHistory(
  unreleasedTrackId: string,
  limit: number = 50
): Promise<DbUnreleasedIdentification[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('unreleased_identifications')
    .select('*')
    .eq('unreleased_track_id', unreleasedTrackId)
    .order('identified_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[UnreleasedTrackService] Error fetching identification history:', error);
    return [];
  }

  return (data || []) as DbUnreleasedIdentification[];
}

// ============================================
// Statistics
// ============================================

/**
 * Get unreleased tracks statistics
 */
export async function getUnreleasedStats(): Promise<{
  total: number;
  pending: number;
  uploaded: number;
  failed: number;
  byPlatform: Record<string, number>;
  totalIdentifications: number;
}> {
  if (!isSupabaseConfigured()) {
    return {
      total: 0,
      pending: 0,
      uploaded: 0,
      failed: 0,
      byPlatform: {},
      totalIdentifications: 0,
    };
  }

  // Get counts by status
  const { data: statusCounts } = await supabase
    .from('unreleased_tracks')
    .select('acrcloud_status')
    .eq('is_active', true);

  const counts = {
    total: 0,
    pending: 0,
    uploaded: 0,
    failed: 0,
  };

  (statusCounts || []).forEach((row: { acrcloud_status: string }) => {
    counts.total++;
    if (row.acrcloud_status === 'pending') counts.pending++;
    if (row.acrcloud_status === 'uploaded') counts.uploaded++;
    if (row.acrcloud_status === 'failed') counts.failed++;
  });

  // Get counts by platform
  const { data: platformCounts } = await supabase
    .from('unreleased_tracks')
    .select('source_platform')
    .eq('is_active', true);

  const byPlatform: Record<string, number> = {};
  (platformCounts || []).forEach((row: { source_platform: string }) => {
    byPlatform[row.source_platform] = (byPlatform[row.source_platform] || 0) + 1;
  });

  // Get total identifications
  const { count: totalIdentifications } = await supabase
    .from('unreleased_identifications')
    .select('*', { count: 'exact', head: true });

  return {
    ...counts,
    byPlatform,
    totalIdentifications: totalIdentifications || 0,
  };
}

/**
 * Get most identified unreleased tracks
 */
export async function getMostIdentified(limit: number = 10): Promise<DbUnreleasedTrack[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('unreleased_tracks')
    .select('*')
    .eq('is_active', true)
    .eq('acrcloud_status', 'uploaded')
    .gt('times_identified', 0)
    .order('times_identified', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[UnreleasedTrackService] Error fetching most identified:', error);
    return [];
  }

  return (data || []) as DbUnreleasedTrack[];
}

// ============================================
// Search / Deduplication
// ============================================

/**
 * Check if a track already exists by title/artist (fuzzy)
 */
export async function findSimilarTrack(
  title: string,
  artist: string
): Promise<DbUnreleasedTrack | null> {
  if (!isSupabaseConfigured()) return null;

  // Normalize for comparison
  const normalizedTitle = title.toLowerCase().trim();
  const normalizedArtist = artist.toLowerCase().trim();

  // Try exact match first
  const { data: exactMatch } = await supabase
    .from('unreleased_tracks')
    .select('*')
    .ilike('title', normalizedTitle)
    .ilike('artist', normalizedArtist)
    .limit(1)
    .single();

  if (exactMatch) {
    return exactMatch as DbUnreleasedTrack;
  }

  // Try partial match
  const { data: partialMatches } = await supabase
    .from('unreleased_tracks')
    .select('*')
    .or(`title.ilike.%${normalizedTitle.substring(0, 20)}%`)
    .limit(20);

  if (!partialMatches || partialMatches.length === 0) {
    return null;
  }

  // Check for similar artist
  for (const track of partialMatches) {
    const trackArtist = (track.artist || '').toLowerCase();
    if (
      trackArtist.includes(normalizedArtist) ||
      normalizedArtist.includes(trackArtist)
    ) {
      return track as DbUnreleasedTrack;
    }
  }

  return null;
}

// ============================================
// Track ID Hints
// ============================================

export interface DbTrackIdHint {
  id: string;
  unreleased_track_id: string;
  platform: string;
  hint_type: 'id_response' | 'direct_mention' | 'link' | 'timestamp_ref';
  original_comment: string;
  commenter_username: string | null;
  parsed_artist: string | null;
  parsed_title: string | null;
  extracted_links: string[] | null;
  timestamp_reference: string | null;
  confidence: 'high' | 'medium' | 'low';
  is_reply_to_id_request: boolean;
  verified: boolean;
  verified_at: string | null;
  verified_by: string | null;
  confirmed_artist: string | null;
  confirmed_title: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTrackIdHintInput {
  unreleased_track_id: string;
  platform: string;
  hint_type: 'id_response' | 'direct_mention' | 'link' | 'timestamp_ref';
  original_comment: string;
  commenter_username?: string;
  parsed_artist?: string;
  parsed_title?: string;
  extracted_links?: string[];
  timestamp_reference?: string;
  confidence: 'high' | 'medium' | 'low';
  is_reply_to_id_request?: boolean;
}

/**
 * Add track ID hints (batch insert)
 */
export async function addTrackIdHints(
  trackId: string,
  hints: CreateTrackIdHintInput[]
): Promise<DbTrackIdHint[]> {
  if (!isSupabaseConfigured() || hints.length === 0) return [];

  const records = hints.map((hint) => ({
    unreleased_track_id: trackId,
    platform: hint.platform,
    hint_type: hint.hint_type,
    original_comment: hint.original_comment,
    commenter_username: hint.commenter_username || null,
    parsed_artist: hint.parsed_artist || null,
    parsed_title: hint.parsed_title || null,
    extracted_links: hint.extracted_links || null,
    timestamp_reference: hint.timestamp_reference || null,
    confidence: hint.confidence,
    is_reply_to_id_request: hint.is_reply_to_id_request || false,
  }));

  const { data, error } = await supabase
    .from('track_id_hints')
    .insert(records)
    .select();

  if (error) {
    console.error('[UnreleasedTrackService] Error adding hints:', error);
    return [];
  }

  return (data || []) as DbTrackIdHint[];
}

/**
 * Get track ID hints for a specific track
 */
export async function getTrackIdHints(
  trackId: string,
  options: { verified?: boolean; limit?: number } = {}
): Promise<DbTrackIdHint[]> {
  if (!isSupabaseConfigured()) return [];

  let query = supabase
    .from('track_id_hints')
    .select('*')
    .eq('unreleased_track_id', trackId)
    .order('confidence', { ascending: true }) // high first
    .order('created_at', { ascending: false });

  if (options.verified !== undefined) {
    query = query.eq('verified', options.verified);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[UnreleasedTrackService] Error fetching hints:', error);
    return [];
  }

  return (data || []) as DbTrackIdHint[];
}

/**
 * Get unverified hints (review queue)
 */
export async function getUnverifiedHints(
  limit: number = 50,
  options: { platform?: string; confidence?: 'high' | 'medium' | 'low' } = {}
): Promise<DbTrackIdHint[]> {
  if (!isSupabaseConfigured()) return [];

  let query = supabase
    .from('track_id_hints')
    .select('*')
    .eq('verified', false)
    .order('confidence', { ascending: true }) // high first
    .order('created_at', { ascending: false })
    .limit(limit);

  if (options.platform) {
    query = query.eq('platform', options.platform);
  }

  if (options.confidence) {
    query = query.eq('confidence', options.confidence);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[UnreleasedTrackService] Error fetching unverified hints:', error);
    return [];
  }

  return (data || []) as DbTrackIdHint[];
}

/**
 * Verify a hint (mark as verified with optional confirmed info)
 */
export async function verifyHint(
  hintId: string,
  verifiedBy: string,
  confirmedInfo?: { artist?: string; title?: string }
): Promise<DbTrackIdHint | null> {
  if (!isSupabaseConfigured()) return null;

  const updateData: Record<string, any> = {
    verified: true,
    verified_at: new Date().toISOString(),
    verified_by: verifiedBy,
  };

  if (confirmedInfo?.artist) {
    updateData.confirmed_artist = confirmedInfo.artist;
  }
  if (confirmedInfo?.title) {
    updateData.confirmed_title = confirmedInfo.title;
  }

  const { data, error } = await supabase
    .from('track_id_hints')
    .update(updateData)
    .eq('id', hintId)
    .select()
    .single();

  if (error) {
    console.error('[UnreleasedTrackService] Error verifying hint:', error);
    return null;
  }

  return data as DbTrackIdHint;
}

/**
 * Delete a hint
 */
export async function deleteHint(hintId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase.from('track_id_hints').delete().eq('id', hintId);

  if (error) {
    console.error('[UnreleasedTrackService] Error deleting hint:', error);
    return false;
  }

  return true;
}

/**
 * Get hint statistics
 */
export async function getHintStats(): Promise<{
  total: number;
  verified: number;
  unverified: number;
  byPlatform: Record<string, number>;
  byConfidence: Record<string, number>;
}> {
  if (!isSupabaseConfigured()) {
    return {
      total: 0,
      verified: 0,
      unverified: 0,
      byPlatform: {},
      byConfidence: {},
    };
  }

  const { data: hints } = await supabase.from('track_id_hints').select('verified, platform, confidence');

  const stats = {
    total: 0,
    verified: 0,
    unverified: 0,
    byPlatform: {} as Record<string, number>,
    byConfidence: {} as Record<string, number>,
  };

  (hints || []).forEach((hint: { verified: boolean; platform: string; confidence: string }) => {
    stats.total++;
    if (hint.verified) {
      stats.verified++;
    } else {
      stats.unverified++;
    }
    stats.byPlatform[hint.platform] = (stats.byPlatform[hint.platform] || 0) + 1;
    stats.byConfidence[hint.confidence] = (stats.byConfidence[hint.confidence] || 0) + 1;
  });

  return stats;
}

export default {
  // CRUD
  createUnreleasedTrack,
  getUnreleasedTrack,
  getUnreleasedTrackByAcrId,
  getUnreleasedTrackBySourceUrl,
  updateUnreleasedTrack,
  deleteUnreleasedTrack,
  listUnreleasedTracks,

  // Upload management
  getPendingUploads,
  markAsUploaded,
  markAsFailed,

  // Identification
  recordIdentification,
  getIdentificationHistory,

  // Stats
  getUnreleasedStats,
  getMostIdentified,

  // Search
  findSimilarTrack,

  // Track ID Hints
  addTrackIdHints,
  getTrackIdHints,
  getUnverifiedHints,
  verifyHint,
  deleteHint,
  getHintStats,
};
