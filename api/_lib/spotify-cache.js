// Shared cache + rate-limit utilities for Spotify enrichment
// Used by spotify-enrich.js, spotify-drip.js, and sets/[id].js

const NOT_FOUND_TTL_DAYS = 7;

/**
 * Generate a normalized lookup key for cache: "artist|||title"
 */
export function generateLookupKey(artist, title) {
  const norm = (s) => (s || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `${norm(artist)}|||${norm(title)}`;
}

/**
 * Check cache for a single track. Returns { found, spotify_data } or null (cache miss).
 */
export async function checkCache(supabase, artist, title) {
  const key = generateLookupKey(artist, title);
  const { data, error } = await supabase
    .from('spotify_track_cache')
    .select('found, spotify_data, updated_at')
    .eq('lookup_key', key)
    .single();

  if (error || !data) return null;

  // Expire not-found entries after TTL
  if (!data.found) {
    const age = Date.now() - new Date(data.updated_at).getTime();
    if (age > NOT_FOUND_TTL_DAYS * 24 * 60 * 60 * 1000) {
      return null; // Treat as cache miss — will be re-queried
    }
  }

  return { found: data.found, spotify_data: data.spotify_data };
}

/**
 * Batch check cache for multiple tracks.
 * Input: [{ artist_name, track_title, ...extra }]
 * Returns: { hits: Map<lookupKey, spotify_data>, misses: [original items] }
 */
export async function batchCheckCache(supabase, tracks) {
  if (!tracks || tracks.length === 0) return { hits: new Map(), misses: [] };

  const keys = tracks.map(t => generateLookupKey(t.artist_name, t.track_title));
  const uniqueKeys = [...new Set(keys)];

  const { data: cached, error } = await supabase
    .from('spotify_track_cache')
    .select('lookup_key, found, spotify_data, updated_at')
    .in('lookup_key', uniqueKeys);

  if (error) {
    console.error('batchCheckCache error:', error);
    return { hits: new Map(), misses: tracks };
  }

  // Build lookup map, respecting TTL for not-found entries
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
    if (cached && cached.found && cached.spotify_data) {
      hits.set(key, cached.spotify_data);
    } else if (cached && !cached.found) {
      // Known not-found — don't add to misses (no point re-querying within TTL)
      hits.set(key, null);
    } else {
      misses.push(tracks[i]);
    }
  }

  return { hits, misses };
}

/**
 * Write a cache entry (upsert).
 */
export async function writeCache(supabase, artist, title, found, spotifyData) {
  const key = generateLookupKey(artist, title);
  const { error } = await supabase
    .from('spotify_track_cache')
    .upsert({
      lookup_key: key,
      artist_name: artist,
      track_title: title,
      found,
      spotify_data: spotifyData || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'lookup_key' });

  if (error) console.error('writeCache error:', error);
}

/**
 * Check if we can make a Spotify API request (rate limit budget).
 * Calls the Postgres atomic counter function.
 * Returns { allowed: boolean, currentCount: number, isLocked: boolean }
 */
export async function canMakeRequest(supabase) {
  const { data, error } = await supabase.rpc('increment_spotify_requests');

  if (error) {
    console.error('canMakeRequest error:', error);
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
 * Record a rate limit (429) from Spotify. Locks requests for retryAfter seconds.
 */
export async function recordRateLimit(supabase, retryAfterSeconds = 60) {
  const cappedSeconds = Math.min(retryAfterSeconds, 300); // Cap at 5 minutes max
  const lockedUntil = new Date(Date.now() + cappedSeconds * 1000).toISOString();
  const { error } = await supabase
    .from('spotify_rate_limit')
    .update({
      locked_until: lockedUntil,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);

  if (error) console.error('recordRateLimit error:', error);
}
