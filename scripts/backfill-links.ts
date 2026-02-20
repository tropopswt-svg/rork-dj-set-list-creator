#!/usr/bin/env bun
/**
 * Link Connectivity Backfill Script
 *
 * Ensures all records cross-reference each other:
 * - Sets ↔ Artists (dj_id linkage)
 * - Tracks ↔ Artists (artist_id linkage)
 * - Set_tracks ↔ Tracks (track_id linkage via fuzzy match)
 * - Updates artist stats (sets_count, tracks_count)
 *
 * Usage:
 *   bun scripts/backfill-links.ts
 *   bun scripts/backfill-links.ts --sets-artists
 *   bun scripts/backfill-links.ts --tracks-artists
 *   bun scripts/backfill-links.ts --set-tracks
 *   bun scripts/backfill-links.ts --update-counts
 *   bun scripts/backfill-links.ts --dry-run
 *   bun scripts/backfill-links.ts --limit 200
 */

import { createClient } from '@supabase/supabase-js';

// ============================================
// Config
// ============================================

const DEFAULT_LIMIT = 500;

function getSupabase() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);
  if (s1 === s2) return 1;

  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) matrix[i] = [i];
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

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
// Sets ↔ Artists linkage
// ============================================

async function linkSetsToArtists(supabase: any, limit: number, dryRun: boolean) {
  console.log('\n--- Sets ↔ Artists Linkage ---\n');

  // Find sets with dj_name but no dj_id
  const { data: sets, error } = await supabase
    .from('sets')
    .select('id, title, dj_name, dj_id')
    .is('dj_id', null)
    .not('dj_name', 'is', null)
    .neq('dj_name', '')
    .limit(limit);

  if (error) {
    console.error('Query error:', error.message);
    return { processed: 0, linked: 0, notFound: 0 };
  }

  if (!sets || sets.length === 0) {
    console.log('All sets already linked to artists!');
    return { processed: 0, linked: 0, notFound: 0 };
  }

  console.log(`Found ${sets.length} sets without artist link\n`);

  // Load all artists for matching
  const { data: artists } = await supabase
    .from('artists')
    .select('id, name')
    .limit(5000);

  const { data: aliases } = await supabase
    .from('artist_aliases')
    .select('artist_id, alias_lower')
    .limit(10000);

  const aliasMap = new Map<string, string>();
  for (const a of aliases || []) {
    aliasMap.set(a.alias_lower, a.artist_id);
  }

  let linked = 0;
  let notFound = 0;

  for (const set of sets) {
    const djName = set.dj_name.trim();
    const normalized = normalizeText(djName);

    // 1. Exact match
    let matchId: string | null = null;
    for (const artist of artists || []) {
      if (normalizeText(artist.name) === normalized) {
        matchId = artist.id;
        break;
      }
    }

    // 2. Alias match
    if (!matchId) {
      matchId = aliasMap.get(normalized) || null;
    }

    // 3. Fuzzy match (>= 0.85 threshold)
    if (!matchId) {
      let bestSim = 0;
      for (const artist of artists || []) {
        const sim = calculateSimilarity(djName, artist.name);
        if (sim > bestSim && sim >= 0.85) {
          bestSim = sim;
          matchId = artist.id;
        }
      }
    }

    if (matchId) {
      if (dryRun) {
        console.log(`  DRY: Set "${set.title}" -> artist_id ${matchId}`);
      } else {
        await supabase
          .from('sets')
          .update({ dj_id: matchId })
          .eq('id', set.id);
        console.log(`  LINKED: "${djName}" in set "${set.title}"`);
      }
      linked++;
    } else {
      console.log(`  MISS: "${djName}" (set: "${set.title}")`);
      notFound++;
    }
  }

  console.log(`\nSets: ${linked} linked, ${notFound} unmatched out of ${sets.length}`);
  return { processed: sets.length, linked, notFound };
}

// ============================================
// Tracks ↔ Artists linkage
// ============================================

async function linkTracksToArtists(supabase: any, limit: number, dryRun: boolean) {
  console.log('\n--- Tracks ↔ Artists Linkage ---\n');

  const { data: tracks, error } = await supabase
    .from('tracks')
    .select('id, title, artist_name, artist_id')
    .is('artist_id', null)
    .not('artist_name', 'is', null)
    .neq('artist_name', '')
    .limit(limit);

  if (error) {
    console.error('Query error:', error.message);
    return { processed: 0, linked: 0, notFound: 0 };
  }

  if (!tracks || tracks.length === 0) {
    console.log('All tracks already linked to artists!');
    return { processed: 0, linked: 0, notFound: 0 };
  }

  console.log(`Found ${tracks.length} tracks without artist link\n`);

  // Load all artists for matching
  const { data: artists } = await supabase
    .from('artists')
    .select('id, name')
    .limit(5000);

  const { data: aliases } = await supabase
    .from('artist_aliases')
    .select('artist_id, alias_lower')
    .limit(10000);

  const aliasMap = new Map<string, string>();
  for (const a of aliases || []) {
    aliasMap.set(a.alias_lower, a.artist_id);
  }

  let linked = 0;
  let notFound = 0;

  for (const track of tracks) {
    const artistName = track.artist_name.trim();
    const normalized = normalizeText(artistName);

    let matchId: string | null = null;

    // 1. Exact match
    for (const artist of artists || []) {
      if (normalizeText(artist.name) === normalized) {
        matchId = artist.id;
        break;
      }
    }

    // 2. Alias match
    if (!matchId) {
      matchId = aliasMap.get(normalized) || null;
    }

    // 3. Fuzzy match
    if (!matchId) {
      let bestSim = 0;
      for (const artist of artists || []) {
        const sim = calculateSimilarity(artistName, artist.name);
        if (sim > bestSim && sim >= 0.85) {
          bestSim = sim;
          matchId = artist.id;
        }
      }
    }

    if (matchId) {
      if (dryRun) {
        console.log(`  DRY: "${artistName} - ${track.title}" -> artist_id ${matchId}`);
      } else {
        await supabase
          .from('tracks')
          .update({ artist_id: matchId })
          .eq('id', track.id);
      }
      linked++;
    } else {
      notFound++;
    }
  }

  console.log(`Tracks: ${linked} linked, ${notFound} unmatched out of ${tracks.length}`);
  return { processed: tracks.length, linked, notFound };
}

// ============================================
// Set_tracks ↔ Tracks linkage
// ============================================

async function linkSetTracksToTracks(supabase: any, limit: number, dryRun: boolean) {
  console.log('\n--- Set_tracks ↔ Tracks Linkage ---\n');

  const { data: setTracks, error } = await supabase
    .from('set_tracks')
    .select('id, raw_title, raw_artist, track_id')
    .is('track_id', null)
    .not('raw_title', 'is', null)
    .not('raw_artist', 'is', null)
    .neq('raw_title', '')
    .neq('raw_artist', '')
    .limit(limit);

  if (error) {
    console.error('Query error:', error.message);
    return { processed: 0, linked: 0, notFound: 0 };
  }

  if (!setTracks || setTracks.length === 0) {
    console.log('All set_tracks already linked!');
    return { processed: 0, linked: 0, notFound: 0 };
  }

  console.log(`Found ${setTracks.length} set_tracks without track link\n`);

  // Load tracks for matching
  const { data: tracks } = await supabase
    .from('tracks')
    .select('id, title, title_normalized, artist_name')
    .limit(10000);

  let linked = 0;
  let notFound = 0;

  for (const st of setTracks) {
    const rawTitle = normalizeText(st.raw_title);
    const rawArtist = normalizeText(st.raw_artist);

    let bestMatch: { id: string; confidence: number } | null = null;

    for (const track of tracks || []) {
      const titleNorm = track.title_normalized || normalizeText(track.title);
      const artistNorm = normalizeText(track.artist_name);

      // Title similarity
      const titleSim = calculateSimilarity(rawTitle, titleNorm);
      if (titleSim < 0.7) continue;

      // Artist similarity
      const artistSim = calculateSimilarity(rawArtist, artistNorm);
      if (artistSim < 0.7) continue;

      // Combined confidence
      const confidence = (titleSim * 0.6) + (artistSim * 0.4);

      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = { id: track.id, confidence };
      }
    }

    if (bestMatch && bestMatch.confidence >= 0.75) {
      if (dryRun) {
        console.log(`  DRY: "${st.raw_artist} - ${st.raw_title}" -> track_id (conf: ${bestMatch.confidence.toFixed(2)})`);
      } else {
        await supabase
          .from('set_tracks')
          .update({
            track_id: bestMatch.id,
            confidence: parseFloat(bestMatch.confidence.toFixed(2)),
          })
          .eq('id', st.id);
      }
      linked++;
    } else {
      notFound++;
    }
  }

  console.log(`Set_tracks: ${linked} linked, ${notFound} unmatched out of ${setTracks.length}`);
  return { processed: setTracks.length, linked, notFound };
}

// ============================================
// Update denormalized counts
// ============================================

async function updateArtistCounts(supabase: any, dryRun: boolean) {
  console.log('\n--- Updating Artist Counts ---\n');

  const { data: artists } = await supabase
    .from('artists')
    .select('id, name, tracks_count, sets_count')
    .limit(5000);

  if (!artists || artists.length === 0) {
    console.log('No artists found');
    return { updated: 0 };
  }

  let updated = 0;

  for (const artist of artists) {
    // Count tracks linked to this artist
    const { count: tracksCount } = await supabase
      .from('tracks')
      .select('id', { count: 'exact', head: true })
      .eq('artist_id', artist.id);

    // Count sets linked to this artist
    const { count: setsCount } = await supabase
      .from('sets')
      .select('id', { count: 'exact', head: true })
      .eq('dj_id', artist.id);

    const newTracksCount = tracksCount || 0;
    const newSetsCount = setsCount || 0;

    if (newTracksCount !== artist.tracks_count || newSetsCount !== artist.sets_count) {
      if (dryRun) {
        console.log(`  DRY: "${artist.name}" tracks: ${artist.tracks_count}->${newTracksCount}, sets: ${artist.sets_count}->${newSetsCount}`);
      } else {
        await supabase
          .from('artists')
          .update({ tracks_count: newTracksCount, sets_count: newSetsCount })
          .eq('id', artist.id);
      }
      updated++;
    }
  }

  console.log(`Updated counts for ${updated} artists`);
  return { updated };
}

// ============================================
// Main
// ============================================

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Link Connectivity Backfill

Usage:
  bun scripts/backfill-links.ts                # Run all linkages
  bun scripts/backfill-links.ts --sets-artists  # Only link sets to artists
  bun scripts/backfill-links.ts --tracks-artists # Only link tracks to artists
  bun scripts/backfill-links.ts --set-tracks    # Only link set_tracks to tracks
  bun scripts/backfill-links.ts --update-counts # Only update artist counts
  bun scripts/backfill-links.ts --dry-run       # Preview without writing
  bun scripts/backfill-links.ts --limit 200     # Custom batch size
`);
    process.exit(0);
  }

  const supabase = getSupabase();
  if (!supabase) {
    console.error('Error: Supabase not configured');
    process.exit(1);
  }

  const dryRun = args.includes('--dry-run');
  const setsArtistsOnly = args.includes('--sets-artists');
  const tracksArtistsOnly = args.includes('--tracks-artists');
  const setTracksOnly = args.includes('--set-tracks');
  const updateCountsOnly = args.includes('--update-counts');
  const runAll = !setsArtistsOnly && !tracksArtistsOnly && !setTracksOnly && !updateCountsOnly;

  let limit = DEFAULT_LIMIT;
  const limitIdx = args.indexOf('--limit');
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    limit = parseInt(args[limitIdx + 1], 10) || DEFAULT_LIMIT;
  }

  console.log('='.repeat(60));
  console.log('Link Connectivity Backfill');
  console.log('='.repeat(60));
  if (dryRun) console.log('** DRY RUN MODE **');
  console.log(`Batch limit: ${limit}`);

  const totals = { processed: 0, linked: 0, notFound: 0 };

  if (runAll || setsArtistsOnly) {
    const r = await linkSetsToArtists(supabase, limit, dryRun);
    totals.processed += r.processed;
    totals.linked += r.linked;
    totals.notFound += r.notFound;
  }

  if (runAll || tracksArtistsOnly) {
    const r = await linkTracksToArtists(supabase, limit, dryRun);
    totals.processed += r.processed;
    totals.linked += r.linked;
    totals.notFound += r.notFound;
  }

  if (runAll || setTracksOnly) {
    const r = await linkSetTracksToTracks(supabase, limit, dryRun);
    totals.processed += r.processed;
    totals.linked += r.linked;
    totals.notFound += r.notFound;
  }

  if (runAll || updateCountsOnly) {
    await updateArtistCounts(supabase, dryRun);
  }

  console.log('\n' + '='.repeat(60));
  console.log('TOTAL SUMMARY');
  console.log('='.repeat(60));
  console.log(`Processed:  ${totals.processed}`);
  console.log(`Linked:     ${totals.linked}`);
  console.log(`Unmatched:  ${totals.notFound}`);
}

main().catch(console.error);
