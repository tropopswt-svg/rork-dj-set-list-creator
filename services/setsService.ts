/**
 * Sets Service - Handles set CRUD operations with duplicate prevention
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Only create client if credentials are available
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export interface SetInput {
  title: string;
  dj_name: string;
  venue?: string;
  event_name?: string;
  event_date?: string;
  tracklist_url?: string;
  soundcloud_url?: string;
  youtube_url?: string;
  mixcloud_url?: string;
  genre?: string;
  duration_seconds?: number;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingSet?: {
    id: string;
    title: string;
    dj_name: string;
    event_name: string;
    event_date: string;
    tracklist_url?: string;
  };
  matchReason?: 'tracklist_url' | 'youtube_url' | 'soundcloud_url' | 'dj_event_date' | 'similar_title';
}

export interface UpsertResult {
  success: boolean;
  id?: string;
  isNew?: boolean;
  error?: string;
}

/**
 * Check if a set already exists in the database
 */
export async function checkDuplicate(input: SetInput): Promise<DuplicateCheckResult> {
  if (!supabase) {
    return { isDuplicate: false };
  }

  // 1. Check by tracklist URL (most reliable)
  if (input.tracklist_url) {
    const { data } = await supabase
      .from('sets')
      .select('id, title, dj_name, event_name, event_date, tracklist_url')
      .eq('tracklist_url', input.tracklist_url)
      .single();

    if (data) {
      return {
        isDuplicate: true,
        existingSet: data,
        matchReason: 'tracklist_url'
      };
    }
  }

  // 2. Check by YouTube URL
  if (input.youtube_url) {
    const { data } = await supabase
      .from('sets')
      .select('id, title, dj_name, event_name, event_date, tracklist_url')
      .eq('youtube_url', input.youtube_url)
      .single();

    if (data) {
      return {
        isDuplicate: true,
        existingSet: data,
        matchReason: 'youtube_url'
      };
    }
  }

  // 3. Check by SoundCloud URL
  if (input.soundcloud_url) {
    const { data } = await supabase
      .from('sets')
      .select('id, title, dj_name, event_name, event_date, tracklist_url')
      .eq('soundcloud_url', input.soundcloud_url)
      .single();

    if (data) {
      return {
        isDuplicate: true,
        existingSet: data,
        matchReason: 'soundcloud_url'
      };
    }
  }

  // 4. Check by DJ + Event + Date combination
  if (input.dj_name && input.event_name && input.event_date) {
    const { data } = await supabase
      .from('sets')
      .select('id, title, dj_name, event_name, event_date, tracklist_url')
      .ilike('dj_name', input.dj_name)
      .ilike('event_name', input.event_name)
      .eq('event_date', input.event_date)
      .single();

    if (data) {
      return {
        isDuplicate: true,
        existingSet: data,
        matchReason: 'dj_event_date'
      };
    }
  }

  // 5. Check by DJ + Date (looser match)
  if (input.dj_name && input.event_date) {
    const { data } = await supabase
      .from('sets')
      .select('id, title, dj_name, event_name, event_date, tracklist_url')
      .ilike('dj_name', input.dj_name)
      .eq('event_date', input.event_date)
      .limit(1)
      .single();

    if (data) {
      return {
        isDuplicate: true,
        existingSet: data,
        matchReason: 'similar_title'
      };
    }
  }

  return { isDuplicate: false };
}

/**
 * Find similar sets for a given DJ (useful for UI suggestions)
 */
export async function findSimilarSets(djName: string, limit = 10) {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('sets')
    .select('id, title, dj_name, event_name, event_date, venue, tracklist_url')
    .ilike('dj_name', `%${djName}%`)
    .order('event_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error finding similar sets:', error);
    return [];
  }

  return data || [];
}

/**
 * Insert or update a set (prevents duplicates)
 */
export async function upsertSet(input: SetInput): Promise<UpsertResult> {
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  // First check for duplicates
  const duplicateCheck = await checkDuplicate(input);

  if (duplicateCheck.isDuplicate && duplicateCheck.existingSet) {
    // Update the existing set with any new information
    const { error } = await supabase
      .from('sets')
      .update({
        title: input.title,
        venue: input.venue || undefined,
        tracklist_url: input.tracklist_url || undefined,
        soundcloud_url: input.soundcloud_url || undefined,
        youtube_url: input.youtube_url || undefined,
        mixcloud_url: input.mixcloud_url || undefined,
        genre: input.genre || undefined,
        duration_seconds: input.duration_seconds || undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', duplicateCheck.existingSet.id);

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      id: duplicateCheck.existingSet.id,
      isNew: false
    };
  }

  // Generate slug
  const slug = generateSlug(`${input.dj_name}-${input.event_name || input.title}-${input.event_date || Date.now()}`);

  // Insert new set
  const { data, error } = await supabase
    .from('sets')
    .insert({
      title: input.title,
      slug,
      dj_name: input.dj_name,
      venue: input.venue,
      event_name: input.event_name,
      event_date: input.event_date,
      tracklist_url: input.tracklist_url,
      soundcloud_url: input.soundcloud_url,
      youtube_url: input.youtube_url,
      mixcloud_url: input.mixcloud_url,
      genre: input.genre,
      duration_seconds: input.duration_seconds,
      source: '1001tracklists'
    })
    .select('id')
    .single();

  if (error) {
    // Handle unique constraint violations gracefully
    if (error.code === '23505') {
      return {
        success: false,
        error: 'This set already exists in the database'
      };
    }
    return { success: false, error: error.message };
  }

  return {
    success: true,
    id: data.id,
    isNew: true
  };
}

/**
 * Get all sets for a DJ
 */
export async function getSetsByDJ(djName: string) {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('sets')
    .select(`
      id, title, dj_name, venue, event_name, event_date,
      tracklist_url, youtube_url, soundcloud_url,
      genre, track_count, duration_seconds
    `)
    .ilike('dj_name', djName)
    .order('event_date', { ascending: false });

  if (error) {
    console.error('Error fetching sets:', error);
    return [];
  }

  return data || [];
}

/**
 * Search sets by various criteria
 */
export async function searchSets(query: string, limit = 20) {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('sets')
    .select(`
      id, title, dj_name, venue, event_name, event_date,
      tracklist_url, genre, track_count
    `)
    .or(`title.ilike.%${query}%,dj_name.ilike.%${query}%,venue.ilike.%${query}%,event_name.ilike.%${query}%`)
    .order('event_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error searching sets:', error);
    return [];
  }

  return data || [];
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 100)
    .trim();
}
