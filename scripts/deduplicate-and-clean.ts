#!/usr/bin/env bun
/**
 * Deduplication & Data Quality Cleanup Script
 *
 * 1. Duplicate artists (similar names via Levenshtein)
 * 2. Duplicate tracks (same title_normalized + artist_id)
 * 3. Orphaned set_tracks (pointing to deleted sets or tracks)
 * 4. Genre normalization (Title Case, merge near-duplicates)
 * 5. Empty/null cleanup (remove test data, empty records)
 *
 * Usage:
 *   bun scripts/deduplicate-and-clean.ts
 *   bun scripts/deduplicate-and-clean.ts --artists
 *   bun scripts/deduplicate-and-clean.ts --tracks
 *   bun scripts/deduplicate-and-clean.ts --orphans
 *   bun scripts/deduplicate-and-clean.ts --genres
 *   bun scripts/deduplicate-and-clean.ts --empty
 *   bun scripts/deduplicate-and-clean.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';

// ============================================
// Config
// ============================================

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

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============================================
// 1. Duplicate Artists
// ============================================

async function deduplicateArtists(supabase: any, dryRun: boolean) {
  console.log('\n--- Duplicate Artists ---\n');

  const { data: artists, error } = await supabase
    .from('artists')
    .select('id, name, slug, image_url, bio, spotify_url, tracks_count, sets_count, genres')
    .order('name');

  if (error || !artists) {
    console.error('Query error:', error?.message);
    return { duplicates: 0, merged: 0 };
  }

  console.log(`Checking ${artists.length} artists for duplicates...\n`);

  const processed = new Set<string>();
  let duplicates = 0;
  let merged = 0;

  for (let i = 0; i < artists.length; i++) {
    if (processed.has(artists[i].id)) continue;

    const group = [artists[i]];

    for (let j = i + 1; j < artists.length; j++) {
      if (processed.has(artists[j].id)) continue;

      const sim = calculateSimilarity(artists[i].name, artists[j].name);
      if (sim >= 0.85) {
        group.push(artists[j]);
      }
    }

    if (group.length <= 1) continue;

    duplicates += group.length - 1;

    // Pick the "best" record to keep (most data, most tracks/sets)
    group.sort((a, b) => {
      // Prefer one with more data
      const aScore =
        (a.image_url ? 2 : 0) +
        (a.bio ? 2 : 0) +
        (a.spotify_url ? 2 : 0) +
        (a.genres?.length || 0) +
        (a.tracks_count || 0) +
        (a.sets_count || 0);
      const bScore =
        (b.image_url ? 2 : 0) +
        (b.bio ? 2 : 0) +
        (b.spotify_url ? 2 : 0) +
        (b.genres?.length || 0) +
        (b.tracks_count || 0) +
        (b.sets_count || 0);
      return bScore - aScore;
    });

    const keeper = group[0];
    const duplicateIds = group.slice(1).map(a => a.id);

    console.log(`  DUPLICATE GROUP: "${keeper.name}"`);
    for (const dup of group.slice(1)) {
      console.log(`    -> "${dup.name}" (id: ${dup.id.substring(0, 8)}...)`);
    }

    if (!dryRun) {
      // Add duplicate names as aliases for the keeper
      for (const dup of group.slice(1)) {
        await supabase.from('artist_aliases').upsert({
          artist_id: keeper.id,
          alias: dup.name,
          alias_lower: normalizeText(dup.name),
        }, { onConflict: 'alias_lower' });
      }

      // Reassign tracks from duplicates to keeper
      for (const dupId of duplicateIds) {
        await supabase
          .from('tracks')
          .update({ artist_id: keeper.id })
          .eq('artist_id', dupId);

        await supabase
          .from('sets')
          .update({ artist_id: keeper.id })
          .eq('artist_id', dupId);

        // Delete the duplicate artist (cascades aliases)
        await supabase
          .from('artists')
          .delete()
          .eq('id', dupId);
      }

      merged += duplicateIds.length;
    }

    for (const a of group) processed.add(a.id);
  }

  console.log(`\nFound ${duplicates} duplicates, merged ${merged}`);
  return { duplicates, merged };
}

// ============================================
// 2. Duplicate Tracks
// ============================================

async function deduplicateTracks(supabase: any, dryRun: boolean) {
  console.log('\n--- Duplicate Tracks ---\n');

  const { data: tracks, error } = await supabase
    .from('tracks')
    .select('id, title, title_normalized, artist_id, artist_name, spotify_url, isrc, duration_seconds, times_played')
    .order('title_normalized');

  if (error || !tracks) {
    console.error('Query error:', error?.message);
    return { duplicates: 0, merged: 0 };
  }

  console.log(`Checking ${tracks.length} tracks for duplicates...\n`);

  // Group by title_normalized + artist_id
  const groups = new Map<string, typeof tracks>();
  for (const track of tracks) {
    const key = `${track.title_normalized}|||${track.artist_id || track.artist_name?.toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(track);
  }

  let duplicates = 0;
  let merged = 0;

  for (const [key, group] of groups) {
    if (group.length <= 1) continue;

    duplicates += group.length - 1;

    // Keep the track with most metadata
    group.sort((a, b) => {
      const aScore =
        (a.spotify_url ? 3 : 0) +
        (a.isrc ? 2 : 0) +
        (a.duration_seconds ? 1 : 0) +
        (a.times_played || 0);
      const bScore =
        (b.spotify_url ? 3 : 0) +
        (b.isrc ? 2 : 0) +
        (b.duration_seconds ? 1 : 0) +
        (b.times_played || 0);
      return bScore - aScore;
    });

    const keeper = group[0];
    const dupeIds = group.slice(1).map(t => t.id);

    console.log(`  DUP: "${keeper.artist_name} - ${keeper.title}" (${group.length} copies)`);

    if (!dryRun) {
      // Reassign set_tracks from duplicates to keeper
      for (const dupeId of dupeIds) {
        await supabase
          .from('set_tracks')
          .update({ track_id: keeper.id })
          .eq('track_id', dupeId);

        await supabase
          .from('tracks')
          .delete()
          .eq('id', dupeId);
      }

      // Update times_played on keeper
      const totalPlayed = group.reduce((sum, t) => sum + (t.times_played || 0), 0);
      await supabase
        .from('tracks')
        .update({ times_played: totalPlayed })
        .eq('id', keeper.id);

      merged += dupeIds.length;
    }
  }

  console.log(`\nFound ${duplicates} duplicates, merged ${merged}`);
  return { duplicates, merged };
}

// ============================================
// 3. Orphaned Set_tracks
// ============================================

async function cleanOrphanedSetTracks(supabase: any, dryRun: boolean) {
  console.log('\n--- Orphaned Set_tracks ---\n');

  // Find set_tracks pointing to non-existent sets
  const { data: allSetTracks } = await supabase
    .from('set_tracks')
    .select('id, set_id, track_id')
    .limit(50000);

  if (!allSetTracks || allSetTracks.length === 0) {
    console.log('No set_tracks to check');
    return { orphaned: 0, cleaned: 0 };
  }

  // Get all valid set IDs
  const { data: validSets } = await supabase
    .from('sets')
    .select('id')
    .limit(50000);

  const validSetIds = new Set((validSets || []).map((s: any) => s.id));

  // Get all valid track IDs
  const { data: validTracks } = await supabase
    .from('tracks')
    .select('id')
    .limit(50000);

  const validTrackIds = new Set((validTracks || []).map((t: any) => t.id));

  const orphanedIds: string[] = [];

  for (const st of allSetTracks) {
    // Check if set exists
    if (!validSetIds.has(st.set_id)) {
      orphanedIds.push(st.id);
      continue;
    }
    // Check if track reference is valid (NULL track_id is fine — means unidentified)
    if (st.track_id && !validTrackIds.has(st.track_id)) {
      orphanedIds.push(st.id);
    }
  }

  console.log(`Found ${orphanedIds.length} orphaned set_tracks out of ${allSetTracks.length}`);

  let cleaned = 0;
  if (orphanedIds.length > 0 && !dryRun) {
    // Delete in batches
    for (let i = 0; i < orphanedIds.length; i += 100) {
      const batch = orphanedIds.slice(i, i + 100);
      await supabase.from('set_tracks').delete().in('id', batch);
      cleaned += batch.length;
    }
  }

  console.log(`Cleaned: ${cleaned}`);
  return { orphaned: orphanedIds.length, cleaned };
}

// ============================================
// 4. Genre Normalization
// ============================================

async function normalizeGenres(supabase: any, dryRun: boolean) {
  console.log('\n--- Genre Normalization ---\n');

  const { data: artists, error } = await supabase
    .from('artists')
    .select('id, name, genres')
    .not('genres', 'is', null)
    .limit(5000);

  if (error || !artists) {
    console.error('Query error:', error?.message);
    return { updated: 0 };
  }

  // Known genre mappings (merge near-duplicates)
  const genreMap: Record<string, string> = {
    'deep-house': 'Deep House',
    'deep house': 'Deep House',
    'deephouse': 'Deep House',
    'tech-house': 'Tech House',
    'tech house': 'Tech House',
    'techhouse': 'Tech House',
    'drum-and-bass': 'Drum And Bass',
    'drum and bass': 'Drum And Bass',
    'dnb': 'Drum And Bass',
    'd&b': 'Drum And Bass',
    'drum & bass': 'Drum And Bass',
    'drum&bass': 'Drum And Bass',
    'minimal-techno': 'Minimal Techno',
    'minimal techno': 'Minimal Techno',
    'progressive-house': 'Progressive House',
    'progressive house': 'Progressive House',
    'afro-house': 'Afro House',
    'afro house': 'Afro House',
    'acid-house': 'Acid House',
    'acid house': 'Acid House',
    'hard-techno': 'Hard Techno',
    'hard techno': 'Hard Techno',
    'melodic-techno': 'Melodic Techno',
    'melodic techno': 'Melodic Techno',
    'melodic house': 'Melodic House',
    'melodic-house': 'Melodic House',
    'uk garage': 'UK Garage',
    'uk-garage': 'UK Garage',
    'garage': 'UK Garage',
    'breaks': 'Breaks',
    'breakbeat': 'Breaks',
    'electronic': 'Electronic',
    'electronica': 'Electronic',
    'edm': 'EDM',
    'house': 'House',
    'techno': 'Techno',
    'trance': 'Trance',
    'ambient': 'Ambient',
    'dubstep': 'Dubstep',
    'disco': 'Disco',
    'funk': 'Funk',
    'soul': 'Soul',
    'hip-hop': 'Hip Hop',
    'hip hop': 'Hip Hop',
    'r&b': 'R&B',
    'rnb': 'R&B',
  };

  let updated = 0;

  for (const artist of artists) {
    if (!artist.genres || artist.genres.length === 0) continue;

    const normalized = artist.genres.map((g: string) => {
      const lower = g.toLowerCase().trim();
      return genreMap[lower] || toTitleCase(g.trim());
    });

    // Deduplicate (case-insensitive)
    const seen = new Set<string>();
    const deduped = normalized.filter((g: string) => {
      const key = g.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Check if anything changed
    const changed = JSON.stringify(deduped) !== JSON.stringify(artist.genres);

    if (changed) {
      if (dryRun) {
        console.log(`  "${artist.name}": ${JSON.stringify(artist.genres)} -> ${JSON.stringify(deduped)}`);
      } else {
        await supabase
          .from('artists')
          .update({ genres: deduped })
          .eq('id', artist.id);
      }
      updated++;
    }
  }

  console.log(`\nNormalized genres for ${updated} artists`);
  return { updated };
}

// ============================================
// 5. Empty/Null Cleanup
// ============================================

async function cleanEmptyRecords(supabase: any, dryRun: boolean) {
  console.log('\n--- Empty/Null Cleanup ---\n');

  let removedArtists = 0;
  let removedTracks = 0;

  // Find artists with no sets, no tracks, and no meaningful data (likely test data)
  const { data: emptyArtists } = await supabase
    .from('artists')
    .select('id, name, tracks_count, sets_count')
    .eq('tracks_count', 0)
    .eq('sets_count', 0)
    .is('image_url', null)
    .is('spotify_url', null)
    .is('bio', null)
    .limit(500);

  if (emptyArtists && emptyArtists.length > 0) {
    console.log(`Found ${emptyArtists.length} empty artists (no sets, no tracks, no data)`);

    // Double-check they truly have no tracks/sets (counts might be stale)
    for (const artist of emptyArtists) {
      const { count: trackCount } = await supabase
        .from('tracks')
        .select('id', { count: 'exact', head: true })
        .eq('artist_id', artist.id);

      const { count: setCount } = await supabase
        .from('sets')
        .select('id', { count: 'exact', head: true })
        .eq('artist_id', artist.id);

      if ((trackCount || 0) === 0 && (setCount || 0) === 0) {
        if (dryRun) {
          console.log(`  DRY: Would remove artist "${artist.name}"`);
        } else {
          await supabase.from('artists').delete().eq('id', artist.id);
        }
        removedArtists++;
      }
    }
  }

  // Find tracks with no title
  const { data: emptyTracks } = await supabase
    .from('tracks')
    .select('id, title, artist_name')
    .or('title.is.null,title.eq.')
    .limit(500);

  if (emptyTracks && emptyTracks.length > 0) {
    console.log(`Found ${emptyTracks.length} tracks with no title`);

    if (!dryRun) {
      const ids = emptyTracks.map((t: any) => t.id);
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        // Remove set_track references first
        await supabase.from('set_tracks').delete().in('track_id', batch);
        await supabase.from('tracks').delete().in('id', batch);
      }
    }
    removedTracks = emptyTracks.length;
  }

  console.log(`\nRemoved: ${removedArtists} artists, ${removedTracks} tracks`);
  return { removedArtists, removedTracks };
}

// ============================================
// Main
// ============================================

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Deduplication & Data Quality Cleanup

Usage:
  bun scripts/deduplicate-and-clean.ts           # Run all cleanup
  bun scripts/deduplicate-and-clean.ts --artists  # Only dedupe artists
  bun scripts/deduplicate-and-clean.ts --tracks   # Only dedupe tracks
  bun scripts/deduplicate-and-clean.ts --orphans  # Only clean orphans
  bun scripts/deduplicate-and-clean.ts --genres   # Only normalize genres
  bun scripts/deduplicate-and-clean.ts --empty    # Only clean empty records
  bun scripts/deduplicate-and-clean.ts --dry-run  # Preview without changes
`);
    process.exit(0);
  }

  const supabase = getSupabase();
  if (!supabase) {
    console.error('Error: Supabase not configured');
    process.exit(1);
  }

  const dryRun = args.includes('--dry-run');
  const artistsOnly = args.includes('--artists');
  const tracksOnly = args.includes('--tracks');
  const orphansOnly = args.includes('--orphans');
  const genresOnly = args.includes('--genres');
  const emptyOnly = args.includes('--empty');
  const runAll = !artistsOnly && !tracksOnly && !orphansOnly && !genresOnly && !emptyOnly;

  console.log('='.repeat(60));
  console.log('Deduplication & Data Quality Cleanup');
  console.log('='.repeat(60));
  if (dryRun) console.log('** DRY RUN MODE **');

  if (runAll || artistsOnly) {
    await deduplicateArtists(supabase, dryRun);
  }

  if (runAll || tracksOnly) {
    await deduplicateTracks(supabase, dryRun);
  }

  if (runAll || orphansOnly) {
    await cleanOrphanedSetTracks(supabase, dryRun);
  }

  if (runAll || genresOnly) {
    await normalizeGenres(supabase, dryRun);
  }

  if (runAll || emptyOnly) {
    await cleanEmptyRecords(supabase, dryRun);
  }

  console.log('\n' + '='.repeat(60));
  console.log('CLEANUP COMPLETE');
  console.log('='.repeat(60));
}

main().catch(console.error);
