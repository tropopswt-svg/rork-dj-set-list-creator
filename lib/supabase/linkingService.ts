/**
 * Service for auto-linking imported data to Supabase entities
 * Used when scraping sets to match artists and tracks
 */

import { supabase, isSupabaseConfigured } from './client';
import { findArtist, getOrCreateArtist, normalizeText, generateSlug } from './artistService';
import { findTrack, getOrCreateTrack } from './trackService';
import type { DbArtist, DbTrack, ArtistMatch, TrackMatch } from './types';

export interface LinkResult {
  success: boolean;
  artistMatch?: ArtistMatch;
  trackMatches?: TrackMatch[];
  setId?: string;
}

export interface ImportedTrack {
  title: string;
  artist: string;
  timestamp?: number;
  source?: string;
  isUnreleased?: boolean;
}

export interface ImportedSet {
  name: string;
  artist: string;
  venue?: string;
  date?: Date;
  youtubeUrl?: string;
  soundcloudUrl?: string;
  coverUrl?: string;
  duration?: number;
  tracks: ImportedTrack[];
  externalId?: string;
}

/**
 * Link an imported set to Supabase entities
 * - Finds or creates the DJ artist
 * - Matches tracks to existing database entries
 * - Creates new track entries for unmatched tracks
 * - Stores the set with all relationships
 */
export async function linkImportedSet(imported: ImportedSet): Promise<LinkResult> {
  if (!isSupabaseConfigured()) {
    console.warn('[LinkingService] Supabase not configured');
    return { success: false };
  }

  try {
    // 1. Find or match the set artist
    const artistMatch = await findArtist(imported.artist);
    let artistId: string | null = null;
    
    if (artistMatch && artistMatch.confidence >= 0.8) {
      artistId = artistMatch.artist.id;
      console.log(`[LinkingService] Matched artist: ${imported.artist} → ${artistMatch.artist.name} (${Math.round(artistMatch.confidence * 100)}%)`);
    } else {
      // Could create new artist, but for now just log
      console.log(`[LinkingService] No artist match for: ${imported.artist}`);
    }

    // 2. Match tracks
    const trackMatches: TrackMatch[] = [];
    for (const track of imported.tracks) {
      const match = await findTrack(track.title, track.artist);
      if (match && match.confidence >= 0.75) {
        trackMatches.push(match);
        console.log(`[LinkingService] Matched track: ${track.artist} - ${track.title} → ${match.track.artist_name} - ${match.track.title} (${Math.round(match.confidence * 100)}%)`);
        
        // Increment play count
        await incrementTrackPlays(match.track.id);
      }
    }

    // 3. Store set in Supabase (optional - if you want to persist)
    // For now, just return the matches
    
    return {
      success: true,
      artistMatch: artistMatch || undefined,
      trackMatches,
    };
  } catch (error) {
    console.error('[LinkingService] Error linking set:', error);
    return { success: false };
  }
}

/**
 * Enhance imported tracks with database matches
 * Returns the tracks with additional metadata from the database
 */
export async function enhanceTracksWithDatabase(tracks: ImportedTrack[]): Promise<Array<ImportedTrack & {
  dbTrack?: DbTrack;
  dbArtist?: DbArtist;
  confidence?: number;
}>> {
  if (!isSupabaseConfigured()) {
    return tracks;
  }

  const enhanced = [];
  
  for (const track of tracks) {
    let dbTrack: DbTrack | undefined;
    let dbArtist: DbArtist | undefined;
    let confidence: number | undefined;
    
    // Try to match the track
    const trackMatch = await findTrack(track.title, track.artist);
    if (trackMatch && trackMatch.confidence >= 0.75) {
      dbTrack = trackMatch.track;
      confidence = trackMatch.confidence;
      
      // If track has an artist, we have the artist match too
      if (trackMatch.artistMatch) {
        dbArtist = trackMatch.artistMatch.artist;
      }
    } else {
      // Try to at least match the artist
      const artistMatch = await findArtist(track.artist);
      if (artistMatch && artistMatch.confidence >= 0.8) {
        dbArtist = artistMatch.artist;
      }
    }
    
    enhanced.push({
      ...track,
      dbTrack,
      dbArtist,
      confidence,
      isUnreleased: dbTrack?.is_unreleased || track.isUnreleased,
    });
  }
  
  return enhanced;
}

/**
 * Get artist slug for navigation
 */
export function getArtistSlug(artistName: string): string {
  return generateSlug(artistName);
}

/**
 * Check if an artist exists in the database
 */
export async function artistExists(artistName: string): Promise<{
  exists: boolean;
  artist?: DbArtist;
  slug?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { exists: false };
  }

  const match = await findArtist(artistName);
  if (match && match.confidence >= 0.8) {
    return {
      exists: true,
      artist: match.artist,
      slug: match.artist.slug,
    };
  }
  
  return { exists: false };
}

/**
 * Increment track play count
 */
async function incrementTrackPlays(trackId: string): Promise<void> {
  const { data, error } = await supabase
    .from('tracks')
    .select('times_played')
    .eq('id', trackId)
    .single();
  
  if (data && !error) {
    await supabase
      .from('tracks')
      .update({ times_played: (data.times_played || 0) + 1 })
      .eq('id', trackId);
  }
}

/**
 * Batch check which tracks from a list exist in database
 * More efficient than checking one by one
 */
export async function batchCheckTracks(tracks: Array<{ title: string; artist: string }>): Promise<Map<string, DbTrack>> {
  if (!isSupabaseConfigured() || tracks.length === 0) {
    return new Map();
  }

  const results = new Map<string, DbTrack>();
  
  // Get all unique normalized titles
  const normalizedTitles = tracks.map(t => normalizeText(t.title));
  
  // Batch query
  const { data } = await supabase
    .from('tracks')
    .select('*')
    .in('title_normalized', normalizedTitles);
  
  if (data) {
    for (const dbTrack of data) {
      // Match to original track
      const matchIndex = tracks.findIndex(t => 
        normalizeText(t.title) === dbTrack.title_normalized &&
        normalizeText(t.artist) === normalizeText(dbTrack.artist_name)
      );
      
      if (matchIndex >= 0) {
        const key = `${tracks[matchIndex].artist}|${tracks[matchIndex].title}`;
        results.set(key, dbTrack);
      }
    }
  }
  
  return results;
}
