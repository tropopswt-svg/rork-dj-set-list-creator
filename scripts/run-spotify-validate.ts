/**
 * Run Spotify re-validation against all is_unreleased=true set_tracks.
 *
 * Strategy (in priority order, fewest API calls first):
 *   1. If spotify_data already has spotify_id → flip is_unreleased=false, no API call
 *   2. Check spotify_track_cache → if found, apply cached data; if known not-found, skip
 *   3. Only for true cache misses → search Spotify fresh (rate-limited 1.2s/call)
 *
 * Skip rules:
 *   - DJ edits: "(... Edit)" in title → skip
 *   - is_id=true / title "ID" / "Unknown" → skip
 *
 * Usage: bun run scripts/run-spotify-validate.ts
 * Dry run: bun run scripts/run-spotify-validate.ts --dry-run
 * Cache only (no API calls): bun run scripts/run-spotify-validate.ts --cache-only
 */

import { createClient } from '@supabase/supabase-js';

const DRY_RUN    = process.argv.includes('--dry-run');
const CACHE_ONLY = process.argv.includes('--cache-only');
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const SPOTIFY_ID   = process.env.SPOTIFY_CLIENT_ID!;
const SPOTIFY_SEC  = process.env.SPOTIFY_CLIENT_SECRET!;
const DELAY_MS     = 1200;
const BATCH_SIZE   = 200;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ───────────────────────────────────────────────────────────────────

function normKey(s: string): string {
  return (s || '').toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(unreleased|free download|clip|preview|edit|remix|original mix)\b/gi, '')
    .trim();
}

function isDjEdit(title: string): boolean {
  return /\((?:[^)]*\s)?edit\)/i.test(title);
}

// ── Cache lookup ──────────────────────────────────────────────────────────────

async function checkCache(artist: string, title: string) {
  const key = `${normKey(artist)}|||${normKey(title)}`;
  const { data } = await supabase
    .from('spotify_track_cache')
    .select('found, spotify_data, updated_at')
    .eq('lookup_key', key)
    .maybeSingle();
  if (!data) return null;

  // Expire not-found entries after 30 days
  if (!data.found) {
    const age = Date.now() - new Date(data.updated_at).getTime();
    if (age > 30 * 24 * 60 * 60 * 1000) return null;
  }
  return { found: data.found, spotify_data: data.spotify_data };
}

async function writeCache(artist: string, title: string, found: boolean, spotifyData: any) {
  const key = `${normKey(artist)}|||${normKey(title)}`;
  await supabase.from('spotify_track_cache').upsert({
    lookup_key: key,
    artist_name: artist,
    track_title: title,
    found,
    spotify_data: spotifyData || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'lookup_key' });
}

// ── Spotify token + search ────────────────────────────────────────────────────

let _token = '';
let _tokenExpiry = 0;

async function getToken(): Promise<string | null> {
  if (_token && Date.now() < _tokenExpiry) return _token;
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${SPOTIFY_ID}:${SPOTIFY_SEC}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) { console.error('Failed to get Spotify token:', res.status); return null; }
  const data = await res.json() as any;
  _token = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _token;
}

async function searchSpotify(artist: string, title: string) {
  const token = await getToken();
  if (!token) return null;

  const cleanTitle = title
    .replace(/\(unreleased\)/gi, '')
    .replace(/\(free download\)/gi, '')
    .replace(/\(clip\)/gi, '')
    .trim();

  const query = encodeURIComponent(`track:${cleanTitle} artist:${artist}`);
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${query}&type=track&limit=5`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10);
    return { _rateLimited: true, _retryAfter: retryAfter };
  }
  if (!res.ok) return null;

  const data = await res.json() as any;
  for (const track of data.tracks?.items || []) {
    const na = normalize(track.name);
    const nc = normalize(cleanTitle);
    const titleMatch = na === nc || na.includes(nc) || nc.includes(na);
    const artistMatch = track.artists.some((a: any) =>
      normalize(a.name).includes(normalize(artist)) ||
      normalize(artist).includes(normalize(a.name))
    );
    if (titleMatch && artistMatch) {
      const images = track.album?.images || [];
      const albumArt = images.find((i: any) => i.width >= 300)?.url || images[0]?.url;
      return {
        spotify_id:    track.id,
        title:         track.name,
        artist:        track.artists[0]?.name,
        artists:       track.artists.map((a: any) => a.name),
        album:         track.album?.name,
        album_art_url: albumArt || null,
        preview_url:   track.preview_url || null,
        spotify_url:   track.external_urls?.spotify || null,
        isrc:          track.external_ids?.isrc || null,
        duration_ms:   track.duration_ms,
        release_date:  track.album?.release_date || null,
        popularity:    track.popularity || 0,
        source:        'spotify',
      };
    }
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) console.log('⚠️  DRY RUN — no database changes will be made\n');
  if (CACHE_ONLY) console.log('ℹ  CACHE ONLY — no Spotify API calls will be made\n');
  console.log('=== Spotify Re-Validation ===\n');

  const { count } = await supabase
    .from('set_tracks')
    .select('id', { count: 'exact', head: true })
    .eq('is_unreleased', true)
    .eq('is_id', false)
    .not('artist_name', 'is', null)
    .not('track_title', 'is', null)
    .neq('track_title', 'ID')
    .neq('track_title', 'Unknown');

  console.log(`Found ${count} is_unreleased=true tracks to check\n`);

  let offset       = 0;
  let fromId       = 0; // flipped via existing spotify_id
  let fromCache    = 0; // flipped via cache hit
  let fromApi      = 0; // flipped via fresh API
  let cacheNotFound = 0; // already known not on Spotify
  let noMatch      = 0;
  let skipped      = 0;
  let apiCalls     = 0;
  let rateLimited  = false;

  while (!rateLimited) {
    const { data: tracks, error } = await supabase
      .from('set_tracks')
      .select('id, artist_name, track_title, spotify_data')
      .eq('is_unreleased', true)
      .eq('is_id', false)
      .not('artist_name', 'is', null)
      .not('track_title', 'is', null)
      .neq('track_title', 'ID')
      .neq('track_title', 'Unknown')
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) { console.error('DB error:', error.message); break; }
    if (!tracks || tracks.length === 0) break;

    console.log(`--- Batch ${Math.floor(offset / BATCH_SIZE) + 1}: rows ${offset + 1}–${offset + tracks.length} ---`);

    for (const track of tracks) {
      if (!track.artist_name || !track.track_title) { skipped++; continue; }
      if (isDjEdit(track.track_title)) {
        skipped++;
        continue;
      }

      const existing = (track.spotify_data as any) || {};

      // ── Step 1: already has spotify_id → just flip ─────────────────────────
      if (existing.spotify_id) {
        console.log(`  ✓ [has-id] "${track.artist_name} - ${track.track_title}"`);
        if (!DRY_RUN) {
          const { error: e } = await supabase
            .from('set_tracks').update({ is_unreleased: false }).eq('id', track.id);
          if (e) console.error(`     ✗ ${e.message}`); else fromId++;
        } else { fromId++; }
        continue;
      }

      // ── Step 2: check cache ─────────────────────────────────────────────────
      const cached = await checkCache(track.artist_name, track.track_title);
      if (cached !== null) {
        if (cached.found && cached.spotify_data) {
          console.log(`  ✓ [cache] "${track.artist_name} - ${track.track_title}" → "${cached.spotify_data.artist} - ${cached.spotify_data.title}"`);
          if (!DRY_RUN) {
            const merged = { ...existing, ...cached.spotify_data };
            const { error: e } = await supabase
              .from('set_tracks').update({ spotify_data: merged, is_unreleased: false }).eq('id', track.id);
            if (e) console.error(`     ✗ ${e.message}`); else fromCache++;
          } else { fromCache++; }
        } else {
          cacheNotFound++; // Spotify already said it's not there
        }
        continue;
      }

      // ── Step 3: fresh API search ────────────────────────────────────────────
      if (CACHE_ONLY) { noMatch++; continue; }

      try {
        await new Promise(r => setTimeout(r, DELAY_MS));
        apiCalls++;
        const result = await searchSpotify(track.artist_name, track.track_title) as any;

        if (result?._rateLimited) {
          console.warn(`\n  ⚠ Rate limited by Spotify — retry after ${result._retryAfter}s. Stopping.`);
          rateLimited = true;
          break;
        }

        await writeCache(track.artist_name, track.track_title, !!result, result || null);

        if (result) {
          console.log(`  ✓ [api]   "${track.artist_name} - ${track.track_title}"\n           → "${result.artist} - ${result.title}" (${result.album || 'no album'})`);
          if (!DRY_RUN) {
            const merged = { ...existing, ...result };
            const { error: e } = await supabase
              .from('set_tracks').update({ spotify_data: merged, is_unreleased: false }).eq('id', track.id);
            if (e) console.error(`     ✗ ${e.message}`); else fromApi++;
          } else { fromApi++; }
        } else {
          noMatch++;
        }
      } catch (err: any) {
        console.error(`  ✗ Error: "${track.artist_name} - ${track.track_title}": ${err.message}`);
      }
    }

    offset += tracks.length;
    if (tracks.length < BATCH_SIZE) break;
  }

  if (rateLimited) console.log('\n⚠ Stopped early — re-run when rate limit expires.');

  const totalConfirmed = fromId + fromCache + fromApi;
  console.log('\n=== FINAL RESULTS ===');
  console.log(`Confirmed: ${totalConfirmed}${DRY_RUN ? ' [DRY RUN]' : ''}`);
  console.log(`  from existing spotify_id:  ${fromId}`);
  console.log(`  from cache:                ${fromCache}`);
  console.log(`  from fresh API:            ${fromApi}  (${apiCalls} calls made)`);
  console.log(`Still not on Spotify:        ${cacheNotFound + noMatch}`);
  console.log(`  known not-found (cache):   ${cacheNotFound}`);
  console.log(`  no match (fresh):          ${noMatch}`);
  console.log(`Skipped (edits/invalid):     ${skipped}`);

  // List remaining unreleased
  console.log('\n=== STILL UNRELEASED ===');
  const { data: remaining } = await supabase
    .from('set_tracks')
    .select('artist_name, track_title')
    .eq('is_unreleased', true)
    .eq('is_id', false)
    .not('artist_name', 'is', null)
    .not('track_title', 'is', null)
    .neq('track_title', 'ID')
    .neq('track_title', 'Unknown')
    .order('artist_name');

  if (!remaining || remaining.length === 0) {
    console.log('  (none)');
  } else {
    console.log(`  ${remaining.length} tracks:\n`);
    for (const t of remaining) {
      console.log(`  • ${t.artist_name} - ${t.track_title}`);
    }
  }
}

main().catch(console.error);
