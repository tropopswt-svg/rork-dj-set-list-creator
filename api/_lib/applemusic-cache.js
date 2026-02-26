// Shared cache + rate-limit utilities for Apple Music enrichment
// Mirrors spotify-cache.js pattern — own table, own rate limit, own RPC
import { generateLookupKey } from './spotify-cache.js';

const NOT_FOUND_TTL_DAYS = 7;

// Re-export for convenience
export { generateLookupKey };

/**
 * Check Apple Music cache for a single track.
 * Returns { found, applemusic_data } or null (cache miss).
 */
export async function checkAppleMusicCache(supabase, artist, title) {
  const key = generateLookupKey(artist, title);
  const { data, error } = await supabase
    .from('applemusic_track_cache')
    .select('found, applemusic_data, updated_at')
    .eq('lookup_key', key)
    .single();

  if (error || !data) return null;

  // Expire not-found entries after TTL
  if (!data.found) {
    const age = Date.now() - new Date(data.updated_at).getTime();
    if (age > NOT_FOUND_TTL_DAYS * 24 * 60 * 60 * 1000) {
      return null; // Treat as cache miss
    }
  }

  return { found: data.found, applemusic_data: data.applemusic_data };
}

/**
 * Batch check Apple Music cache for multiple tracks.
 * Input: [{ artist_name, track_title, ...extra }]
 * Returns: { hits: Map<lookupKey, applemusic_data>, misses: [original items] }
 */
export async function batchCheckAppleMusicCache(supabase, tracks) {
  if (!tracks || tracks.length === 0) return { hits: new Map(), misses: [] };

  const keys = tracks.map(t => generateLookupKey(t.artist_name, t.track_title));
  const uniqueKeys = [...new Set(keys)];

  const { data: cached, error } = await supabase
    .from('applemusic_track_cache')
    .select('lookup_key, found, applemusic_data, updated_at')
    .in('lookup_key', uniqueKeys);

  if (error) {
    console.error('batchCheckAppleMusicCache error:', error);
    return { hits: new Map(), misses: tracks };
  }

  const cacheMap = new Map();
  for (const row of cached || []) {
    if (!row.found) {
      const age = Date.now() - new Date(row.updated_at).getTime();
      if (age > NOT_FOUND_TTL_DAYS * 24 * 60 * 60 * 1000) continue;
    }
    cacheMap.set(row.lookup_key, row);
  }

  const hits = new Map();
  const misses = [];

  for (let i = 0; i < tracks.length; i++) {
    const key = keys[i];
    const cached = cacheMap.get(key);
    if (cached && cached.found && cached.applemusic_data) {
      hits.set(key, cached.applemusic_data);
    } else if (cached && !cached.found) {
      hits.set(key, null); // Known not-found
    } else {
      misses.push(tracks[i]);
    }
  }

  return { hits, misses };
}

/**
 * Write a cache entry (upsert).
 */
export async function writeAppleMusicCache(supabase, artist, title, found, appleMusicData) {
  const key = generateLookupKey(artist, title);
  const { error } = await supabase
    .from('applemusic_track_cache')
    .upsert({
      lookup_key: key,
      artist_name: artist,
      track_title: title,
      found,
      applemusic_data: appleMusicData || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'lookup_key' });

  if (error) console.error('writeAppleMusicCache error:', error);
}

/**
 * Check if we can make an Apple Music API request (rate limit budget).
 * Calls the Postgres atomic counter function.
 * Returns { allowed: boolean, currentCount: number, isLocked: boolean }
 */
export async function canMakeAppleMusicRequest(supabase) {
  const { data, error } = await supabase.rpc('increment_applemusic_requests');

  if (error) {
    console.error('canMakeAppleMusicRequest error:', error);
    return { allowed: false, currentCount: 0, isLocked: false };
  }

  const row = data?.[0] || data;
  return {
    allowed: row?.allowed ?? false,
    currentCount: row?.current_count ?? 0,
    isLocked: row?.is_locked ?? false,
  };
}

/**
 * Record a rate limit (429) from Apple Music. Locks requests for retryAfter seconds.
 */
export async function recordAppleMusicRateLimit(supabase, retryAfterSeconds = 60) {
  const cappedSeconds = Math.min(retryAfterSeconds, 300);
  const lockedUntil = new Date(Date.now() + cappedSeconds * 1000).toISOString();
  const { error } = await supabase
    .from('applemusic_rate_limit')
    .update({
      locked_until: lockedUntil,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);

  if (error) console.error('recordAppleMusicRateLimit error:', error);
}
