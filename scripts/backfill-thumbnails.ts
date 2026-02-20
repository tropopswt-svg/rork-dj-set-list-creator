#!/usr/bin/env bun
/**
 * Thumbnail & Cover Art Backfill Script
 *
 * Fills missing cover_url on sets (from YouTube thumbnails),
 * missing artwork_url on tracks (from Spotify),
 * and missing image_url on artists (from multiple sources).
 *
 * Usage:
 *   bun scripts/backfill-thumbnails.ts
 *   bun scripts/backfill-thumbnails.ts --sets-only
 *   bun scripts/backfill-thumbnails.ts --tracks-only
 *   bun scripts/backfill-thumbnails.ts --artists-only
 *   bun scripts/backfill-thumbnails.ts --dry-run
 *   bun scripts/backfill-thumbnails.ts --limit 50
 */

import { createClient } from '@supabase/supabase-js';
import { searchSpotifyTrack, getSpotifyToken } from '../lib/spotify';
import { getArtistImageWithFallback } from '../lib/artistImages';

// ============================================
// Config
// ============================================

const BATCH_LIMIT = 100;
const DELAY_MS = 200; // Delay between API calls

function getSupabase() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ============================================
// Sets: YouTube thumbnail backfill
// ============================================

async function backfillSetThumbnails(supabase: any, limit: number, dryRun: boolean) {
  console.log('\n--- Sets: YouTube Thumbnail Backfill ---\n');

  const { data: sets, error } = await supabase
    .from('sets')
    .select('id, title, youtube_url')
    .is('cover_url', null)
    .not('youtube_url', 'is', null)
    .limit(limit);

  if (error) {
    console.error('Query error:', error.message);
    return { processed: 0, updated: 0, failed: 0 };
  }

  if (!sets || sets.length === 0) {
    console.log('All sets already have cover art!');
    return { processed: 0, updated: 0, failed: 0 };
  }

  console.log(`Found ${sets.length} sets missing cover art\n`);

  let updated = 0;
  let failed = 0;

  for (const set of sets) {
    const videoId = extractVideoId(set.youtube_url);
    if (!videoId) {
      console.log(`  SKIP: Invalid YouTube URL for "${set.title}"`);
      failed++;
      continue;
    }

    // Try maxresdefault first, fallback to mqdefault
    const thumbnailUrls = [
      `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    ];

    let coverUrl: string | null = null;

    for (const url of thumbnailUrls) {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (response.ok) {
          // maxresdefault returns 200 even for default image; check content-length
          const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
          if (contentLength > 1000) { // Real thumbnails are > 1KB
            coverUrl = url;
            break;
          }
        }
      } catch {
        // Try next URL
      }
    }

    if (!coverUrl) {
      // Final fallback: hqdefault always exists
      coverUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }

    if (dryRun) {
      console.log(`  DRY: "${set.title}" -> ${coverUrl}`);
    } else {
      const { error: updateError } = await supabase
        .from('sets')
        .update({ cover_url: coverUrl, enriched_at: new Date().toISOString() })
        .eq('id', set.id);

      if (updateError) {
        console.log(`  FAIL: "${set.title}" - ${updateError.message}`);
        failed++;
      } else {
        console.log(`  OK: "${set.title}"`);
        updated++;
      }
    }

    await sleep(50); // Light throttle for HEAD requests
  }

  console.log(`\nSets: ${updated} updated, ${failed} failed out of ${sets.length}`);
  return { processed: sets.length, updated, failed };
}

// ============================================
// Tracks: Spotify artwork backfill
// ============================================

async function backfillTrackArtwork(supabase: any, limit: number, dryRun: boolean) {
  console.log('\n--- Tracks: Spotify Artwork Backfill ---\n');

  // Find tracks with Spotify URL but no artwork_url
  const { data: tracks, error } = await supabase
    .from('tracks')
    .select('id, title, artist_name, spotify_url')
    .is('artwork_url', null)
    .not('spotify_url', 'is', null)
    .limit(limit);

  if (error) {
    console.error('Query error:', error.message);
    return { processed: 0, updated: 0, failed: 0 };
  }

  if (!tracks || tracks.length === 0) {
    console.log('All tracks with Spotify URLs already have artwork!');
    return { processed: 0, updated: 0, failed: 0 };
  }

  console.log(`Found ${tracks.length} tracks needing artwork\n`);

  // Ensure Spotify token is available
  const token = await getSpotifyToken();
  if (!token) {
    console.error('Spotify credentials not configured');
    return { processed: 0, updated: 0, failed: 0 };
  }

  let updated = 0;
  let failed = 0;

  for (const track of tracks) {
    await sleep(DELAY_MS);

    try {
      const result = await searchSpotifyTrack(track.artist_name, track.title);

      if (result.found && result.albumArt) {
        if (dryRun) {
          console.log(`  DRY: "${track.artist_name} - ${track.title}" -> artwork found`);
        } else {
          const update: Record<string, any> = { artwork_url: result.albumArt };
          if (result.previewUrl) update.spotify_preview_url = result.previewUrl;
          if (result.popularity) update.popularity = result.popularity;
          if (result.album) update.album_name = result.album;

          await supabase.from('tracks').update(update).eq('id', track.id);
          console.log(`  OK: "${track.artist_name} - ${track.title}"`);
          updated++;
        }
      } else {
        console.log(`  MISS: "${track.artist_name} - ${track.title}"`);
        failed++;
      }
    } catch (err) {
      console.log(`  ERR: "${track.artist_name} - ${track.title}"`);
      failed++;
    }
  }

  console.log(`\nTracks: ${updated} updated, ${failed} no artwork out of ${tracks.length}`);
  return { processed: tracks.length, updated, failed };
}

// ============================================
// Artists: Image backfill
// ============================================

async function backfillArtistImages(supabase: any, limit: number, dryRun: boolean) {
  console.log('\n--- Artists: Image Backfill ---\n');

  const { data: artists, error } = await supabase
    .from('artists')
    .select('id, name')
    .is('image_url', null)
    .order('tracks_count', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Query error:', error.message);
    return { processed: 0, updated: 0, failed: 0 };
  }

  if (!artists || artists.length === 0) {
    console.log('All artists already have images!');
    return { processed: 0, updated: 0, failed: 0 };
  }

  console.log(`Found ${artists.length} artists missing images\n`);

  let updated = 0;
  let failed = 0;

  for (const artist of artists) {
    await sleep(1100); // MusicBrainz rate limit: 1 req/sec

    try {
      const imageUrl = await getArtistImageWithFallback(artist.name);

      if (imageUrl) {
        if (dryRun) {
          console.log(`  DRY: "${artist.name}" -> ${imageUrl.substring(0, 60)}...`);
        } else {
          await supabase
            .from('artists')
            .update({ image_url: imageUrl })
            .eq('id', artist.id);
          console.log(`  OK: "${artist.name}"`);
          updated++;
        }
      } else {
        console.log(`  MISS: "${artist.name}"`);
        failed++;
      }
    } catch (err) {
      console.log(`  ERR: "${artist.name}"`);
      failed++;
    }
  }

  console.log(`\nArtists: ${updated} updated, ${failed} no image out of ${artists.length}`);
  return { processed: artists.length, updated, failed };
}

// ============================================
// Main
// ============================================

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Thumbnail & Cover Art Backfill

Usage:
  bun scripts/backfill-thumbnails.ts              # All categories
  bun scripts/backfill-thumbnails.ts --sets-only   # Only set cover art
  bun scripts/backfill-thumbnails.ts --tracks-only # Only track artwork
  bun scripts/backfill-thumbnails.ts --artists-only # Only artist images
  bun scripts/backfill-thumbnails.ts --dry-run     # Preview without writing
  bun scripts/backfill-thumbnails.ts --limit 200   # Custom batch size
`);
    process.exit(0);
  }

  const supabase = getSupabase();
  if (!supabase) {
    console.error('Error: Supabase not configured');
    process.exit(1);
  }

  const dryRun = args.includes('--dry-run');
  const setsOnly = args.includes('--sets-only');
  const tracksOnly = args.includes('--tracks-only');
  const artistsOnly = args.includes('--artists-only');
  const runAll = !setsOnly && !tracksOnly && !artistsOnly;

  let limit = BATCH_LIMIT;
  const limitIdx = args.indexOf('--limit');
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    limit = parseInt(args[limitIdx + 1], 10) || BATCH_LIMIT;
  }

  console.log('='.repeat(60));
  console.log('Thumbnail & Cover Art Backfill');
  console.log('='.repeat(60));
  if (dryRun) console.log('** DRY RUN MODE **');
  console.log(`Batch limit: ${limit}`);

  const totals = { processed: 0, updated: 0, failed: 0 };

  if (runAll || setsOnly) {
    const r = await backfillSetThumbnails(supabase, limit, dryRun);
    totals.processed += r.processed;
    totals.updated += r.updated;
    totals.failed += r.failed;
  }

  if (runAll || tracksOnly) {
    const r = await backfillTrackArtwork(supabase, limit, dryRun);
    totals.processed += r.processed;
    totals.updated += r.updated;
    totals.failed += r.failed;
  }

  if (runAll || artistsOnly) {
    const r = await backfillArtistImages(supabase, limit, dryRun);
    totals.processed += r.processed;
    totals.updated += r.updated;
    totals.failed += r.failed;
  }

  console.log('\n' + '='.repeat(60));
  console.log('TOTAL SUMMARY');
  console.log('='.repeat(60));
  console.log(`Processed: ${totals.processed}`);
  console.log(`Updated:   ${totals.updated}`);
  console.log(`Failed:    ${totals.failed}`);
}

main().catch(console.error);
