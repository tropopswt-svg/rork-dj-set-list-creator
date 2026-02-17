#!/usr/bin/env bun
/**
 * Bucket Validation Script
 *
 * Checks for:
 * 1. Duplicate tracks in the bucket (same audio from different sources)
 * 2. Tracks that have been released (now on Spotify)
 * 3. Near-duplicate titles (fuzzy matching)
 *
 * Usage:
 *   bun scripts/validate-bucket.ts              # Full validation
 *   bun scripts/validate-bucket.ts --duplicates # Check duplicates only
 *   bun scripts/validate-bucket.ts --released   # Check released only
 *   bun scripts/validate-bucket.ts --cleanup    # Remove duplicates/released
 */

import { createClient } from '@supabase/supabase-js';

// Config
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

interface BucketTrack {
  id: number;
  acr_id: string;
  title: string;
  user_defined: {
    artist?: string;
    source_url?: string;
    source_platform?: string;
    db_track_id?: string;
  };
  duration: number;
  created_at: string;
}

interface ValidationResult {
  duplicates: Array<{
    original: BucketTrack;
    duplicates: BucketTrack[];
    reason: string;
  }>;
  released: Array<{
    track: BucketTrack;
    spotifyUrl?: string;
    beatportUrl?: string;
  }>;
  suspicious: Array<{
    track: BucketTrack;
    reason: string;
  }>;
}

// Supabase client
function getSupabase() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ACRCloud bucket config
function getBucketConfig() {
  return {
    bucketId: process.env.ACRCLOUD_BUCKET_NAME,
    bearerToken: process.env.ACRCLOUD_BEARER_TOKEN,
    consoleHost: 'api-v2.acrcloud.com',
  };
}

// Fetch all tracks from bucket (paginated)
async function fetchAllBucketTracks(): Promise<BucketTrack[]> {
  const config = getBucketConfig();
  if (!config.bucketId || !config.bearerToken) {
    throw new Error('ACRCloud bucket credentials not configured');
  }

  const allTracks: BucketTrack[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `https://${config.consoleHost}/api/buckets/${config.bucketId}/files?page=${page}&per_page=100`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${config.bearerToken}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch bucket tracks: ${response.status}`);
    }

    const data = await response.json();
    allTracks.push(...data.data);

    hasMore = data.meta.current_page < data.meta.last_page;
    page++;
  }

  return allTracks;
}

// Normalize string for comparison
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .replace(/\b(unreleased|free download|clip|preview|edit|remix|original mix)\b/gi, '')
    .trim();
}

// Calculate similarity between two strings (Levenshtein-based)
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);

  if (na === nb) return 1;

  const longer = na.length > nb.length ? na : nb;
  const shorter = na.length > nb.length ? nb : na;

  if (longer.length === 0) return 1;

  // Simple containment check
  if (longer.includes(shorter) || shorter.includes(longer)) {
    return shorter.length / longer.length;
  }

  // Word overlap
  const wordsA = new Set(na.split(' ').filter(w => w.length > 2));
  const wordsB = new Set(nb.split(' ').filter(w => w.length > 2));
  const intersection = [...wordsA].filter(w => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.length / union.size;
}

// Find duplicate tracks based on title/artist similarity
function findDuplicates(tracks: BucketTrack[]): ValidationResult['duplicates'] {
  const duplicates: ValidationResult['duplicates'] = [];
  const processed = new Set<string>();

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    if (processed.has(track.acr_id)) continue;

    const trackKey = `${normalize(track.user_defined?.artist || '')} - ${normalize(track.title)}`;
    const matches: BucketTrack[] = [];

    for (let j = i + 1; j < tracks.length; j++) {
      const other = tracks[j];
      if (processed.has(other.acr_id)) continue;

      const otherKey = `${normalize(other.user_defined?.artist || '')} - ${normalize(other.title)}`;

      // Check title similarity
      const titleSim = similarity(track.title, other.title);
      const artistSim = similarity(
        track.user_defined?.artist || '',
        other.user_defined?.artist || ''
      );

      // Check duration similarity (within 30 seconds)
      const durationDiff = Math.abs(track.duration - other.duration);

      // High similarity = likely duplicate
      if (titleSim > 0.8 && artistSim > 0.6 && durationDiff < 30) {
        matches.push(other);
        processed.add(other.acr_id);
      }
      // Same normalized key
      else if (trackKey === otherKey) {
        matches.push(other);
        processed.add(other.acr_id);
      }
    }

    if (matches.length > 0) {
      duplicates.push({
        original: track,
        duplicates: matches,
        reason: `Similar title/artist (${matches.length} copies)`,
      });
    }
    processed.add(track.acr_id);
  }

  return duplicates;
}

// Get Spotify access token
async function getSpotifyToken(): Promise<string | null> {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    return null;
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.access_token;
}

// Search Spotify for a track
async function searchSpotify(
  artist: string,
  title: string,
  token: string
): Promise<{ found: boolean; url?: string }> {
  // Clean up search query
  const cleanTitle = title
    .replace(/\(unreleased\)/gi, '')
    .replace(/\(free download\)/gi, '')
    .replace(/\(clip\)/gi, '')
    .replace(/\(preview\)/gi, '')
    .trim();

  const query = encodeURIComponent(`track:${cleanTitle} artist:${artist}`);
  const url = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=5`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) return { found: false };

  const data = await response.json();
  const tracks = data.tracks?.items || [];

  // Check for close matches
  for (const spotifyTrack of tracks) {
    const spotifyTitle = normalize(spotifyTrack.name);
    const spotifyArtists = spotifyTrack.artists.map((a: any) => normalize(a.name)).join(' ');

    const titleMatch = similarity(normalize(cleanTitle), spotifyTitle) > 0.8;
    const artistMatch = similarity(normalize(artist), spotifyArtists) > 0.6;

    if (titleMatch && artistMatch) {
      return {
        found: true,
        url: spotifyTrack.external_urls?.spotify,
      };
    }
  }

  return { found: false };
}

// Check which tracks are now released on Spotify
async function findReleasedTracks(tracks: BucketTrack[]): Promise<ValidationResult['released']> {
  const token = await getSpotifyToken();
  if (!token) {
    console.log('⚠️  Spotify credentials not configured - skipping release check');
    return [];
  }

  const released: ValidationResult['released'] = [];
  let checked = 0;

  for (const track of tracks) {
    const artist = track.user_defined?.artist || '';
    const title = track.title;

    if (!artist || !title) continue;

    // Rate limit: 1 request per 100ms
    await new Promise(r => setTimeout(r, 100));

    const result = await searchSpotify(artist, title, token);
    checked++;

    if (result.found) {
      released.push({
        track,
        spotifyUrl: result.url,
      });
      console.log(`  🎵 RELEASED: ${artist} - ${title}`);
      console.log(`     Spotify: ${result.url}`);
    }

    // Progress
    if (checked % 20 === 0) {
      console.log(`  Checked ${checked}/${tracks.length} tracks...`);
    }
  }

  return released;
}

// Delete track from bucket
async function deleteFromBucket(acrId: string): Promise<boolean> {
  const config = getBucketConfig();
  const url = `https://${config.consoleHost}/api/buckets/${config.bucketId}/files/${acrId}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${config.bearerToken}` },
  });

  return response.ok || response.status === 204;
}

// Update database status
async function markAsRemoved(dbTrackId: string, reason: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !dbTrackId) return;

  await supabase
    .from('unreleased_tracks')
    .update({
      acrcloud_status: 'removed',
      is_active: false,
      metadata: { removal_reason: reason, removed_at: new Date().toISOString() },
    })
    .eq('id', dbTrackId);
}

// Main validation function
async function validateBucket(options: {
  checkDuplicates?: boolean;
  checkReleased?: boolean;
  cleanup?: boolean;
}): Promise<ValidationResult> {
  console.log('='.repeat(60));
  console.log('ACRCloud Bucket Validation');
  console.log('='.repeat(60));

  // Fetch all tracks
  console.log('\n📥 Fetching all bucket tracks...');
  const tracks = await fetchAllBucketTracks();
  console.log(`   Found ${tracks.length} tracks in bucket\n`);

  const result: ValidationResult = {
    duplicates: [],
    released: [],
    suspicious: [],
  };

  // Check duplicates
  if (options.checkDuplicates !== false) {
    console.log('🔍 Checking for duplicates...');
    result.duplicates = findDuplicates(tracks);
    console.log(`   Found ${result.duplicates.length} duplicate groups\n`);

    if (result.duplicates.length > 0) {
      console.log('Duplicates found:');
      for (const dup of result.duplicates) {
        console.log(`\n  Original: ${dup.original.user_defined?.artist} - ${dup.original.title}`);
        console.log(`  ACR ID: ${dup.original.acr_id}`);
        for (const d of dup.duplicates) {
          console.log(`    → Duplicate: ${d.user_defined?.artist} - ${d.title} (${d.acr_id})`);
        }
      }
    }
  }

  // Check released
  if (options.checkReleased !== false) {
    console.log('\n🎧 Checking Spotify for released tracks...');
    result.released = await findReleasedTracks(tracks);
    console.log(`   Found ${result.released.length} tracks now on Spotify\n`);
  }

  // Cleanup if requested
  if (options.cleanup) {
    console.log('\n🧹 Cleaning up...');

    // Remove duplicate copies (keep original)
    for (const dup of result.duplicates) {
      for (const d of dup.duplicates) {
        console.log(`   Removing duplicate: ${d.acr_id}`);
        const deleted = await deleteFromBucket(d.acr_id);
        if (deleted && d.user_defined?.db_track_id) {
          await markAsRemoved(d.user_defined.db_track_id, 'duplicate');
        }
      }
    }

    // Remove released tracks
    for (const rel of result.released) {
      console.log(`   Removing released: ${rel.track.acr_id}`);
      const deleted = await deleteFromBucket(rel.track.acr_id);
      if (deleted && rel.track.user_defined?.db_track_id) {
        await markAsRemoved(rel.track.user_defined.db_track_id, `released on spotify: ${rel.spotifyUrl}`);
      }
    }

    console.log('   Cleanup complete!');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total tracks:     ${tracks.length}`);
  console.log(`Duplicate groups: ${result.duplicates.length}`);
  console.log(`Released tracks:  ${result.released.length}`);

  const duplicateCount = result.duplicates.reduce((sum, d) => sum + d.duplicates.length, 0);
  const toRemove = duplicateCount + result.released.length;

  if (toRemove > 0 && !options.cleanup) {
    console.log(`\n⚠️  ${toRemove} tracks should be removed`);
    console.log('   Run with --cleanup to remove them');
  }

  return result;
}

// CLI
async function main() {
  const args = process.argv.slice(2);

  const options = {
    checkDuplicates: !args.includes('--released'),
    checkReleased: !args.includes('--duplicates'),
    cleanup: args.includes('--cleanup'),
  };

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Bucket Validation Script

Usage:
  bun scripts/validate-bucket.ts              # Full validation
  bun scripts/validate-bucket.ts --duplicates # Check duplicates only
  bun scripts/validate-bucket.ts --released   # Check released only
  bun scripts/validate-bucket.ts --cleanup    # Remove duplicates/released

Environment variables:
  SPOTIFY_CLIENT_ID     - For release checking
  SPOTIFY_CLIENT_SECRET - For release checking
`);
    process.exit(0);
  }

  await validateBucket(options);
}

main().catch(console.error);
