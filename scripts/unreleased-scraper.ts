#!/usr/bin/env bun
/**
 * Unreleased Track Scraper
 *
 * Scrapes SoundCloud profiles for unreleased/ID tracks and uploads them
 * to ACRCloud custom bucket for fingerprinting.
 *
 * Usage:
 *   bun scripts/unreleased-scraper.ts <soundcloud-url>
 *   bun scripts/unreleased-scraper.ts https://soundcloud.com/username
 *   bun scripts/unreleased-scraper.ts --process-pending
 *
 * Prerequisites:
 *   brew install yt-dlp ffmpeg
 *   Set environment variables for ACRCloud bucket and Supabase
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as spotify from '../lib/spotify';

// Configuration
interface ScraperConfig {
  platform: 'soundcloud' | 'instagram' | 'tiktok';
  targetProfiles: string[];
  filters: {
    minDuration: number; // seconds, skip clips shorter than this
    maxAge: number; // days, skip tracks older than this
    keywords: string[]; // title must contain one of these (optional)
    excludeKeywords: string[]; // skip if title contains any of these
  };
}

const defaultSoundcloudConfig: ScraperConfig = {
  platform: 'soundcloud',
  targetProfiles: [],
  filters: {
    minDuration: 60, // Skip tracks < 1 minute
    maxAge: 365, // Skip tracks > 1 year old
    keywords: [], // Empty = accept all
    excludeKeywords: ['released', 'out now', 'spotify', 'beatport', 'buy', 'available now', 'stream now'],
  },
};

// Paths
const PROJECT_ROOT = path.resolve(__dirname, '..');
const LOCAL_YTDLP = path.join(PROJECT_ROOT, 'bin', 'yt-dlp');
const LOCAL_FFMPEG = path.join(PROJECT_ROOT, 'bin', 'ffmpeg');
const YTDLP_PATH = fs.existsSync(LOCAL_YTDLP) ? LOCAL_YTDLP : 'yt-dlp';
const FFMPEG_PATH = fs.existsSync(LOCAL_FFMPEG) ? LOCAL_FFMPEG : 'ffmpeg';
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'unreleased-downloads');

// Supabase client
function getSupabaseClient() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Missing Supabase credentials');
    return null;
  }
  return createClient(url, key);
}

// ACRCloud bucket config (Console API v2)
function getBucketConfig() {
  return {
    bucketId: process.env.ACRCLOUD_BUCKET_NAME,
    bearerToken: process.env.ACRCLOUD_BEARER_TOKEN,
    consoleHost: 'api-v2.acrcloud.com',
  };
}

// Track metadata from SoundCloud
interface TrackMetadata {
  id: string;
  title: string;
  artist: string;
  duration: number;
  uploadDate: string;
  description: string;
  genre: string;
  tags: string[];
  soundcloudUrl: string;
  uploader: string;
  uploaderUrl: string;
  filename?: string;
  filepath?: string;
}

// Check dependencies
function checkDependencies(): void {
  if (fs.existsSync(LOCAL_YTDLP)) {
    console.log(`Using local yt-dlp: ${LOCAL_YTDLP}`);
  } else {
    try {
      execSync('which yt-dlp', { stdio: 'ignore' });
      console.log('Using system yt-dlp');
    } catch {
      console.error('Error: yt-dlp not found. Install with: brew install yt-dlp');
      process.exit(1);
    }
  }

  if (fs.existsSync(LOCAL_FFMPEG)) {
    console.log(`Using local ffmpeg: ${LOCAL_FFMPEG}`);
  } else {
    try {
      execSync('which ffmpeg', { stdio: 'ignore' });
      console.log('Using system ffmpeg');
    } catch {
      console.error('Error: ffmpeg not found. Install with: brew install ffmpeg');
      process.exit(1);
    }
  }
}

// Extract username from SoundCloud URL
function extractUsername(url: string): string {
  const match = url.match(/soundcloud\.com\/([^\/\?]+)/);
  return match ? match[1] : 'unknown';
}

// Parse "Artist - Title" format commonly used on SoundCloud
function parseTrackTitle(fullTitle: string, uploader: string): { artist: string; title: string } {
  // Common patterns: "Artist - Track Name", "Artist - Track (Edit)", etc.
  const separators = [' - ', ' – ', ' — ', ' | '];

  for (const sep of separators) {
    if (fullTitle.includes(sep)) {
      const [artist, ...rest] = fullTitle.split(sep);
      return {
        artist: artist.trim(),
        title: rest.join(sep).trim(),
      };
    }
  }

  // No separator found - use uploader as artist
  return {
    artist: uploader,
    title: fullTitle,
  };
}

// Check if track matches unreleased filters
function matchesUnreleasedFilters(
  track: TrackMetadata,
  config: ScraperConfig
): { matches: boolean; reason?: string } {
  // Duration filter
  if (track.duration < config.filters.minDuration) {
    return { matches: false, reason: `Too short (${track.duration}s < ${config.filters.minDuration}s)` };
  }

  // Age filter
  if (track.uploadDate) {
    const uploadDate = new Date(
      track.uploadDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
    );
    const daysSinceUpload = (Date.now() - uploadDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpload > config.filters.maxAge) {
      return { matches: false, reason: `Too old (${Math.floor(daysSinceUpload)} days)` };
    }
  }

  const titleLower = track.title.toLowerCase();
  const fullTextLower = `${track.title} ${track.description}`.toLowerCase();

  // Exclude keywords - but handle "unreleased" vs "released" carefully
  for (const keyword of config.filters.excludeKeywords) {
    const keywordLower = keyword.toLowerCase();

    // Special case: "released" should not match "unreleased"
    if (keywordLower === 'released') {
      // Use word boundary check - "released" but not "unreleased"
      const releasedPattern = /(?<![un])released/i;
      if (releasedPattern.test(fullTextLower)) {
        return { matches: false, reason: `Contains excluded keyword: "${keyword}"` };
      }
    } else if (fullTextLower.includes(keywordLower)) {
      return { matches: false, reason: `Contains excluded keyword: "${keyword}"` };
    }
  }

  // Include keywords (if specified)
  if (config.filters.keywords.length > 0) {
    const hasKeyword = config.filters.keywords.some((kw) =>
      titleLower.includes(kw.toLowerCase())
    );
    if (!hasKeyword) {
      return { matches: false, reason: 'Missing required keyword' };
    }
  }

  return { matches: true };
}

// Download tracks from SoundCloud using yt-dlp
async function downloadTracks(
  url: string,
  outputDir: string
): Promise<TrackMetadata[]> {
  const tracksDir = path.join(outputDir, 'tracks');
  fs.mkdirSync(tracksDir, { recursive: true });

  console.log(`\nDownloading tracks from: ${url}`);
  console.log(`Output directory: ${tracksDir}\n`);

  // yt-dlp arguments
  const ytdlpArgs = [
    url,
    '--extract-audio',
    '--audio-format', 'mp3',
    '--audio-quality', '0',
    '--output', path.join(tracksDir, '%(id)s.%(ext)s'),
    '--write-info-json',
    '--no-playlist-reverse',
    '--ignore-errors',
    '--no-overwrites',
    '--ffmpeg-location', path.dirname(FFMPEG_PATH),
  ];

  return new Promise((resolve) => {
    const proc = spawn(YTDLP_PATH, ytdlpArgs, { stdio: 'inherit' });

    proc.on('close', () => {
      // Parse downloaded metadata
      const files = fs.readdirSync(tracksDir);
      const jsonFiles = files.filter((f) => f.endsWith('.info.json'));
      const tracks: TrackMetadata[] = [];

      for (const jsonFile of jsonFiles) {
        try {
          const data = JSON.parse(
            fs.readFileSync(path.join(tracksDir, jsonFile), 'utf8')
          );

          const baseName = jsonFile.replace('.info.json', '');
          const audioFile = files.find(
            (f) => f.startsWith(baseName) && f.endsWith('.mp3')
          );

          if (audioFile) {
            tracks.push({
              id: data.id,
              title: data.title || data.fulltitle || 'Unknown',
              artist: data.artist || data.uploader || 'Unknown',
              duration: data.duration || 0,
              uploadDate: data.upload_date || '',
              description: data.description?.substring(0, 1000) || '',
              genre: data.genre || '',
              tags: data.tags || [],
              soundcloudUrl: data.webpage_url,
              uploader: data.uploader || '',
              uploaderUrl: data.uploader_url || '',
              filename: audioFile,
              filepath: path.join(tracksDir, audioFile),
            });
          }
        } catch (err) {
          console.error(`Error parsing ${jsonFile}:`, err);
        }
      }

      resolve(tracks);
    });

    proc.on('error', (err) => {
      console.error('yt-dlp error:', err);
      resolve([]);
    });
  });
}

// Upload track to ACRCloud bucket using Console API v2
async function uploadToACRCloud(
  track: TrackMetadata,
  dbTrackId: string
): Promise<{ success: boolean; acrId?: string; error?: string }> {
  const config = getBucketConfig();

  if (!config.bucketId || !config.bearerToken) {
    return { success: false, error: 'ACRCloud bucket credentials not configured (need ACRCLOUD_BUCKET_NAME and ACRCLOUD_BEARER_TOKEN)' };
  }

  if (!track.filepath || !fs.existsSync(track.filepath)) {
    return { success: false, error: 'Audio file not found' };
  }

  const audioBuffer = fs.readFileSync(track.filepath);
  const { artist, title } = parseTrackTitle(track.title, track.uploader);

  // Build form data for Console API v2
  const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
  const formParts: (string | Buffer)[] = [];

  const addField = (name: string, value: string) => {
    formParts.push(`--${boundary}\r\n`);
    formParts.push(`Content-Disposition: form-data; name="${name}"\r\n\r\n`);
    formParts.push(`${value}\r\n`);
  };

  addField('title', title);
  addField('data_type', 'audio');
  addField('user_defined', JSON.stringify({
    artist: artist,
    source_platform: 'soundcloud',
    source_url: track.soundcloudUrl,
    source_id: track.id,
    db_track_id: dbTrackId,
  }));

  formParts.push(`--${boundary}\r\n`);
  formParts.push(`Content-Disposition: form-data; name="file"; filename="track.mp3"\r\n`);
  formParts.push(`Content-Type: audio/mp3\r\n\r\n`);
  formParts.push(audioBuffer);
  formParts.push(`\r\n--${boundary}--\r\n`);

  const bodyParts = formParts.map((p) => (typeof p === 'string' ? Buffer.from(p) : p));
  const bodyBuffer = Buffer.concat(bodyParts);

  try {
    const url = `https://${config.consoleHost}/api/buckets/${config.bucketId}/files`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.bearerToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: bodyBuffer,
    });

    const result = await response.json();

    if (response.ok && result.data?.acr_id) {
      return { success: true, acrId: result.data.acr_id };
    }

    return { success: false, error: result.message || result.error || `HTTP ${response.status}` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// Main scraper function
async function scrapeAndUpload(url: string, config: ScraperConfig): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('Cannot proceed without Supabase connection');
    return;
  }

  const username = extractUsername(url);
  const outputDir = path.join(OUTPUT_DIR, username);
  fs.mkdirSync(outputDir, { recursive: true });

  console.log('='.repeat(60));
  console.log('Unreleased Track Scraper');
  console.log('='.repeat(60));
  console.log(`Target: ${url}`);
  console.log(`Output: ${outputDir}`);
  console.log('');

  // Download tracks
  const tracks = await downloadTracks(url, outputDir);
  console.log(`\nDownloaded ${tracks.length} tracks`);

  if (tracks.length === 0) {
    console.log('No tracks found.');
    return;
  }

  // Process each track
  let processed = 0;
  let skipped = 0;
  let uploaded = 0;
  let failed = 0;

  for (const track of tracks) {
    console.log(`\n[${processed + 1}/${tracks.length}] ${track.title}`);

    // Check filters
    const filterResult = matchesUnreleasedFilters(track, config);
    if (!filterResult.matches) {
      console.log(`  SKIP: ${filterResult.reason}`);
      skipped++;
      processed++;
      continue;
    }

    // Check if already exists
    const { data: existing } = await supabase
      .from('unreleased_tracks')
      .select('id, acrcloud_status')
      .eq('source_url', track.soundcloudUrl)
      .single();

    if (existing) {
      console.log(`  SKIP: Already in database (status: ${existing.acrcloud_status})`);
      skipped++;
      processed++;
      continue;
    }

    // Parse title to get clean artist/title
    const { artist, title } = parseTrackTitle(track.title, track.uploader);

    // Check for duplicate in bucket (fuzzy match)
    const dupCheck = await spotify.isDuplicateInBucket(artist, title, track.duration, supabase);
    if (dupCheck.isDuplicate) {
      console.log(`  SKIP: Similar track already in bucket (ID: ${dupCheck.existingId})`);
      skipped++;
      processed++;
      continue;
    }

    // Check if released on Spotify
    const spotifyCheck = await spotify.isOnSpotify(artist, title);
    if (spotifyCheck.found) {
      console.log(`  SKIP: Already released on Spotify`);
      console.log(`        ${spotifyCheck.url}`);
      skipped++;
      processed++;
      continue;
    }

    // Create database entry
    const { data: dbTrack, error: insertError } = await supabase
      .from('unreleased_tracks')
      .insert({
        title,
        artist,
        source_platform: 'soundcloud',
        source_url: track.soundcloudUrl,
        source_user: track.uploader,
        source_post_date: track.uploadDate
          ? new Date(track.uploadDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')).toISOString()
          : null,
        audio_duration_seconds: Math.round(track.duration),
        audio_quality: track.duration >= 180 ? 'high' : track.duration >= 60 ? 'medium' : 'clip',
        acrcloud_status: 'pending',
        metadata: {
          genre: track.genre,
          tags: track.tags,
          description: track.description?.substring(0, 500),
          soundcloudId: track.id,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.log(`  ERROR: Database insert failed - ${insertError.message}`);
      failed++;
      processed++;
      continue;
    }

    console.log(`  Created DB entry: ${dbTrack.id}`);

    // Upload to ACRCloud
    const uploadResult = await uploadToACRCloud(track, dbTrack.id);

    if (uploadResult.success) {
      // Update DB with ACRCloud ID
      await supabase
        .from('unreleased_tracks')
        .update({
          acrcloud_acr_id: uploadResult.acrId,
          acrcloud_status: 'uploaded',
          fingerprint_created_at: new Date().toISOString(),
        })
        .eq('id', dbTrack.id);

      console.log(`  UPLOADED: ACR ID = ${uploadResult.acrId}`);
      uploaded++;
    } else {
      // Mark as failed
      await supabase
        .from('unreleased_tracks')
        .update({
          acrcloud_status: 'failed',
          metadata: {
            ...dbTrack.metadata,
            lastError: uploadResult.error,
            lastErrorAt: new Date().toISOString(),
          },
        })
        .eq('id', dbTrack.id);

      console.log(`  FAILED: ${uploadResult.error}`);
      failed++;
    }

    processed++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total tracks: ${tracks.length}`);
  console.log(`Uploaded:     ${uploaded}`);
  console.log(`Skipped:      ${skipped}`);
  console.log(`Failed:       ${failed}`);
  console.log('');

  // Clean up downloaded files if desired
  // fs.rmSync(outputDir, { recursive: true, force: true });
}

// Process pending uploads from database
async function processPendingUploads(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('Cannot proceed without Supabase connection');
    return;
  }

  console.log('='.repeat(60));
  console.log('Processing Pending Uploads');
  console.log('='.repeat(60));

  // Get pending tracks
  const { data: pendingTracks, error } = await supabase
    .from('unreleased_tracks')
    .select('*')
    .eq('acrcloud_status', 'pending')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) {
    console.error('Error fetching pending tracks:', error);
    return;
  }

  if (!pendingTracks || pendingTracks.length === 0) {
    console.log('No pending tracks to process.');
    return;
  }

  console.log(`Found ${pendingTracks.length} pending tracks`);

  // These tracks need audio downloaded before upload
  // For now, just list them - actual processing requires downloading
  for (const track of pendingTracks) {
    console.log(`\n- ${track.artist} - ${track.title}`);
    console.log(`  Source: ${track.source_url}`);
    console.log(`  Created: ${track.created_at}`);
  }

  console.log('\nTo process these tracks, run:');
  console.log('  bun scripts/unreleased-scraper.ts <soundcloud-url>');
  console.log('\nOr implement audio download for pending tracks.');
}

// CLI entry point
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Unreleased Track Scraper

Usage:
  bun scripts/unreleased-scraper.ts <soundcloud-url>
  bun scripts/unreleased-scraper.ts --process-pending

Examples:
  bun scripts/unreleased-scraper.ts https://soundcloud.com/username
  bun scripts/unreleased-scraper.ts https://soundcloud.com/username/sets/playlist

Options:
  --process-pending    Check and list pending uploads in database

Prerequisites:
  - yt-dlp (brew install yt-dlp)
  - ffmpeg (brew install ffmpeg)
  - Environment variables set for Supabase and ACRCloud bucket
`);
    process.exit(1);
  }

  checkDependencies();

  if (args[0] === '--process-pending') {
    await processPendingUploads();
  } else {
    const url = args[0];
    if (!url.includes('soundcloud.com')) {
      console.error('Currently only SoundCloud URLs are supported');
      process.exit(1);
    }
    await scrapeAndUpload(url, defaultSoundcloudConfig);
  }
}

main().catch(console.error);
