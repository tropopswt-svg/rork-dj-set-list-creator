import { supabase, isSupabaseConfigured } from './client';
import { normalizeText } from './artistService';
import { findArtist, getOrCreateArtist } from './artistService';
import type { DbTrack, TrackMatch, CreateTrackInput } from './types';

// ============================================
// Track Matching
// ============================================

/**
 * Find a track by title and artist
 */
export async function findTrack(title: string, artistName: string): Promise<TrackMatch | null> {
  if (!isSupabaseConfigured()) {
    console.warn('[TrackService] Supabase not configured');
    return null;
  }

  const normalizedTitle = normalizeText(title);
  
  // 1. First find the artist
  const artistMatch = await findArtist(artistName);
  
  // 2. Try exact match on normalized title + artist
  if (artistMatch) {
    const { data: exactMatch } = await supabase
      .from('tracks')
      .select('*')
      .eq('title_normalized', normalizedTitle)
      .eq('artist_id', artistMatch.artist.id)
      .limit(1)
      .single();
    
    if (exactMatch) {
      return {
        track: exactMatch as DbTrack,
        confidence: 1,
        matchType: 'exact',
        artistMatch,
      };
    }
  }
  
  // 3. Try title alias match
  const { data: aliasMatches } = await supabase
    .from('track_aliases')
    .select('*, tracks(*)')
    .eq('title_alias_normalized', normalizedTitle)
    .limit(10);
  
  if (aliasMatches && aliasMatches.length > 0) {
    // Filter by artist if we have a match
    for (const alias of aliasMatches) {
      if (!alias.tracks) continue;
      
      const track = alias.tracks as DbTrack;
      
      // Check if artist matches
      if (artistMatch && track.artist_id === artistMatch.artist.id) {
        return {
          track,
          confidence: 0.95,
          matchType: 'alias',
          artistMatch,
        };
      }
      
      // Check artist name fuzzy match
      const artistSimilarity = calculateSimilarity(artistName, track.artist_name);
      if (artistSimilarity >= 0.8) {
        return {
          track,
          confidence: 0.9 * artistSimilarity,
          matchType: 'alias',
        };
      }
    }
  }
  
  // 4. Fuzzy match on title (slower, use sparingly)
  const { data: titleMatches } = await supabase
    .from('tracks')
    .select('*')
    .ilike('title', `%${title.substring(0, 20)}%`)
    .limit(50);
  
  if (titleMatches && titleMatches.length > 0) {
    let bestMatch: DbTrack | null = null;
    let bestScore = 0;
    
    for (const track of titleMatches) {
      const titleSimilarity = calculateSimilarity(title, track.title);
      const artistSimilarity = calculateSimilarity(artistName, track.artist_name);
      
      // Combined score weighing both title and artist
      const score = (titleSimilarity * 0.6) + (artistSimilarity * 0.4);
      
      if (score > bestScore && score >= 0.75) {
        bestScore = score;
        bestMatch = track as DbTrack;
      }
    }
    
    if (bestMatch) {
      return {
        track: bestMatch,
        confidence: bestScore,
        matchType: 'fuzzy',
        artistMatch: artistMatch || undefined,
      };
    }
  }
  
  return null;
}

// Helper function (duplicated here to avoid circular deps)
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);
  
  if (s1 === s2) return 1;
  
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = [];
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

// ============================================
// Track CRUD Operations
// ============================================

/**
 * Get track by ID
 */
export async function getTrack(id: string): Promise<DbTrack | null> {
  if (!isSupabaseConfigured()) return null;
  
  const { data, error } = await supabase
    .from('tracks')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('[TrackService] Error fetching track:', error);
    return null;
  }
  
  return data as DbTrack;
}

/**
 * Create a new track
 */
export async function createTrack(input: CreateTrackInput): Promise<DbTrack | null> {
  if (!isSupabaseConfigured()) return null;
  
  // Get or create artist
  let artistId = input.artist_id;
  if (!artistId && input.artist_name) {
    const artistResult = await getOrCreateArtist(input.artist_name);
    if (artistResult) {
      artistId = artistResult.artist.id;
    }
  }
  
  // Handle remix artist
  let remixArtistId = input.remix_artist_id;
  if (!remixArtistId && input.remix_artist_name) {
    const remixArtistResult = await getOrCreateArtist(input.remix_artist_name);
    if (remixArtistResult) {
      remixArtistId = remixArtistResult.artist.id;
    }
  }
  
  const titleNormalized = normalizeText(input.title);
  
  const { data, error } = await supabase
    .from('tracks')
    .insert({
      title: input.title,
      title_normalized: titleNormalized,
      artist_id: artistId,
      artist_name: input.artist_name,
      remix_artist_id: remixArtistId,
      remix_artist_name: input.remix_artist_name,
      remix_type: input.remix_type,
      label: input.label,
      release_year: input.release_year,
      is_unreleased: input.is_unreleased || false,
      spotify_url: input.spotify_url,
      beatport_url: input.beatport_url,
      soundcloud_url: input.soundcloud_url,
      youtube_url: input.youtube_url,
      duration_seconds: input.duration_seconds,
      bpm: input.bpm,
      key: input.key,
    })
    .select()
    .single();
  
  if (error) {
    console.error('[TrackService] Error creating track:', error);
    return null;
  }
  
  // Update artist track count
  if (artistId) {
    await supabase.rpc('increment_artist_tracks', { artist_id: artistId });
  }
  
  return data as DbTrack;
}

/**
 * Get or create track - finds existing or creates new
 */
export async function getOrCreateTrack(
  title: string, 
  artistName: string, 
  additionalInfo?: Partial<CreateTrackInput>
): Promise<{ track: DbTrack; isNew: boolean } | null> {
  // First try to find existing track
  const match = await findTrack(title, artistName);
  
  if (match && match.confidence >= 0.9) {
    return { track: match.track, isNew: false };
  }
  
  // Create new track
  const newTrack = await createTrack({
    title,
    artist_name: artistName,
    ...additionalInfo,
  });
  
  if (newTrack) {
    return { track: newTrack, isNew: true };
  }
  
  return null;
}

/**
 * Add track alias for alternative names
 */
export async function addTrackAlias(
  trackId: string, 
  titleAlias: string, 
  artistAlias?: string
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  
  const { error } = await supabase
    .from('track_aliases')
    .upsert({
      track_id: trackId,
      title_alias: titleAlias,
      title_alias_normalized: normalizeText(titleAlias),
      artist_alias: artistAlias,
    }, { onConflict: 'title_alias_normalized,artist_alias' });
  
  if (error) {
    console.error('[TrackService] Error adding track alias:', error);
  }
}

/**
 * Search tracks
 */
export async function searchTracks(query: string, limit: number = 20): Promise<DbTrack[]> {
  if (!isSupabaseConfigured()) return [];
  
  const { data, error } = await supabase
    .from('tracks')
    .select('*')
    .or(`title.ilike.%${query}%,artist_name.ilike.%${query}%`)
    .order('times_played', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('[TrackService] Error searching tracks:', error);
    return [];
  }
  
  return data as DbTrack[];
}

/**
 * Get popular tracks
 */
export async function getPopularTracks(limit: number = 50): Promise<DbTrack[]> {
  if (!isSupabaseConfigured()) return [];
  
  const { data, error } = await supabase
    .from('tracks')
    .select('*')
    .order('times_played', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('[TrackService] Error fetching popular tracks:', error);
    return [];
  }
  
  return data as DbTrack[];
}

/**
 * Increment track play count (when added to a set)
 */
export async function incrementTrackPlays(trackId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  
  const { error } = await supabase
    .from('tracks')
    .update({ times_played: supabase.rpc('increment', { x: 1 }) })
    .eq('id', trackId);
  
  if (error) {
    // Fallback: fetch and update manually
    const { data } = await supabase
      .from('tracks')
      .select('times_played')
      .eq('id', trackId)
      .single();
    
    if (data) {
      await supabase
        .from('tracks')
        .update({ times_played: (data.times_played || 0) + 1 })
        .eq('id', trackId);
    }
  }
}
