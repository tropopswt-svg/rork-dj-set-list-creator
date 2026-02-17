#!/usr/bin/env bun
/**
 * Batch Unreleased Track Scraper
 *
 * Scrape multiple SoundCloud URLs (profiles, playlists, stations) for unreleased tracks
 * and upload to ACRCloud bucket.
 *
 * Usage:
 *   bun scripts/batch-scrape-unreleased.ts urls.txt
 *   bun scripts/batch-scrape-unreleased.ts --url "https://soundcloud.com/..."
 *   bun scripts/batch-scrape-unreleased.ts --interactive
 *
 * Supports:
 *   - Profile URLs: https://soundcloud.com/username
 *   - Playlist URLs: https://soundcloud.com/username/sets/playlist-name
 *   - Station URLs: https://soundcloud.com/discover/sets/track-stations:xxx
 *   - Track URLs: https://soundcloud.com/username/track-name
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { createClient } from '@supabase/supabase-js';

// Paths
const PROJECT_ROOT = path.resolve(__dirname, '..');
const LOCAL_YTDLP = path.join(PROJECT_ROOT, 'bin', 'yt-dlp');
const LOCAL_FFMPEG = path.join(PROJECT_ROOT, 'bin', 'ffmpeg');
const YTDLP_PATH = fs.existsSync(LOCAL_YTDLP) ? LOCAL_YTDLP : 'yt-dlp';
const FFMPEG_PATH = fs.existsSync(LOCAL_FFMPEG) ? LOCAL_FFMPEG : 'ffmpeg';
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'unreleased-downloads');
const URLS_FILE = path.join(PROJECT_ROOT, 'scripts', 'scrape-urls.txt');

// Config
const FILTERS = {
  minDuration: 60,  // Skip tracks < 1 minute
  maxDuration: 540, // Skip tracks > 9 minutes (likely mixes) - most tracks are under 7min
  // Keywords that indicate it's a DJ set/mix (skip these)
  mixKeywords: [
    'dj set', 'dj-set', 'djset', 'set live', 'live set', 'live @', 'live at',
    'b2b', 'back to back', 'mix', 'podcast', 'radio show', 'radio edit',
    'session', 'hour', 'hrs', 'h mix', 'hr mix', 'minute mix', 'min mix',
    'boiler room', 'essential mix', 'recorded live', 'live recording',
    'club set', 'festival set', 'closing set', 'opening set',
  ],
  excludeKeywords: [
    'released', 'out now', 'spotify', 'beatport', 'buy',
    'available now', 'stream now', 'itunes', 'apple music',
    'bandcamp', 'juno', 'traxsource'
  ],
  includeKeywords: [
    'unreleased', 'id', 'forthcoming', 'preview', 'clip',
    'wip', 'demo', 'dub', 'exclusive', 'unfinished'
  ],
};

// Track metadata
interface TrackMeta {
  id: string;
  title: string;
  artist: string;
  duration: number;
  uploadDate: string;
  description: string;
  url: string;
  uploader: string;
  filepath?: string;
}

// Supabase
function getSupabase() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ACRCloud config
function getBucketConfig() {
  return {
    bucketId: process.env.ACRCLOUD_BUCKET_NAME,
    bearerToken: process.env.ACRCLOUD_BEARER_TOKEN,
    consoleHost: 'api-v2.acrcloud.com',
  };
}

// Normalize for comparison
function normalize(str: string): string {
  return str.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(unreleased|free download|clip|preview|edit|remix|original mix)\b/gi, '')
    .trim();
}

// Parse "Artist - Title" format
function parseTrackTitle(fullTitle: string, uploader: string): { artist: string; title: string } {
  const separators = [' - ', ' – ', ' — ', ' | '];
  for (const sep of separators) {
    if (fullTitle.includes(sep)) {
      const [artist, ...rest] = fullTitle.split(sep);
      return { artist: artist.trim(), title: rest.join(sep).trim() };
    }
  }
  return { artist: uploader, title: fullTitle };
}

// Check if track looks like a DJ set/mix
function looksLikeMix(title: string, description: string, duration: number): { isMix: boolean; reason: string } {
  const text = `${title} ${description}`.toLowerCase();

  // Check mix keywords
  for (const kw of FILTERS.mixKeywords) {
    if (text.includes(kw.toLowerCase())) {
      return { isMix: true, reason: `Contains "${kw}"` };
    }
  }

  // Long tracks with certain patterns are likely mixes
  if (duration > 420) { // > 7 minutes
    // Check for time patterns like "1hr", "2 hours", "30 min"
    if (/\d+\s*h(ou)?r|min(ute)?s?\s*mix|\d{1,2}:\d{2}:\d{2}/.test(text)) {
      return { isMix: true, reason: 'Time pattern detected' };
    }
  }

  // Very long tracks (> 12 min) are almost certainly mixes even without keywords
  if (duration > 720) {
    return { isMix: true, reason: `Very long duration (${Math.round(duration / 60)} min)` };
  }

  return { isMix: false, reason: '' };
}

// Check if track looks unreleased
function looksUnreleased(title: string, description: string): { likely: boolean; reason: string } {
  const text = `${title} ${description}`.toLowerCase();

  // Check exclude keywords (likely released)
  for (const kw of FILTERS.excludeKeywords) {
    // Special case: "released" should not match "unreleased"
    if (kw === 'released') {
      if (/(?<![un])released/i.test(text)) {
        return { likely: false, reason: `Contains "${kw}"` };
      }
    } else if (text.includes(kw.toLowerCase())) {
      return { likely: false, reason: `Contains "${kw}"` };
    }
  }

  // Check include keywords (likely unreleased)
  for (const kw of FILTERS.includeKeywords) {
    if (text.includes(kw.toLowerCase())) {
      return { likely: true, reason: `Contains "${kw}"` };
    }
  }

  // No strong signal - accept but note it
  return { likely: true, reason: 'No release indicators found' };
}

// Check for duplicate in database
async function isDuplicate(artist: string, title: string, duration: number, supabase: any): Promise<boolean> {
  const { data: existing } = await supabase
    .from('unreleased_tracks')
    .select('id, artist, title, audio_duration_seconds')
    .eq('is_active', true);

  if (!existing) return false;

  const na = normalize(artist);
  const nt = normalize(title);

  for (const track of existing) {
    const ea = normalize(track.artist || '');
    const et = normalize(track.title || '');
    const durationMatch = Math.abs((track.audio_duration_seconds || 0) - duration) < 30;

    if ((et === nt || et.includes(nt) || nt.includes(et)) &&
        (ea === na || ea.includes(na) || na.includes(ea)) &&
        durationMatch) {
      return true;
    }
  }
  return false;
}

// Check if URL already scraped
async function isUrlScraped(url: string, supabase: any): Promise<boolean> {
  const { data } = await supabase
    .from('unreleased_tracks')
    .select('id')
    .eq('source_url', url)
    .single();
  return !!data;
}

// Download tracks from URL using yt-dlp
async function downloadFromUrl(url: string, outputDir: string): Promise<TrackMeta[]> {
  const tracksDir = path.join(outputDir, 'tracks');
  fs.mkdirSync(tracksDir, { recursive: true });

  console.log(`\n📥 Downloading from: ${url}`);

  const args = [
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
    '--max-downloads', '50', // Limit per URL to avoid huge downloads
  ];

  return new Promise((resolve) => {
    const proc = spawn(YTDLP_PATH, args, { stdio: 'inherit' });

    proc.on('close', () => {
      const files = fs.readdirSync(tracksDir);
      const jsonFiles = files.filter(f => f.endsWith('.info.json'));
      const tracks: TrackMeta[] = [];

      for (const jsonFile of jsonFiles) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(tracksDir, jsonFile), 'utf8'));
          const baseName = jsonFile.replace('.info.json', '');
          const audioFile = files.find(f => f.startsWith(baseName) && f.endsWith('.mp3'));

          if (audioFile) {
            tracks.push({
              id: data.id,
              title: data.title || data.fulltitle || 'Unknown',
              artist: data.artist || data.uploader || 'Unknown',
              duration: data.duration || 0,
              uploadDate: data.upload_date || '',
              description: data.description?.substring(0, 1000) || '',
              url: data.webpage_url,
              uploader: data.uploader || '',
              filepath: path.join(tracksDir, audioFile),
            });
          }
        } catch (err) {
          // Skip bad JSON
        }
      }
      resolve(tracks);
    });

    proc.on('error', () => resolve([]));
  });
}

// Upload to ACRCloud bucket
async function uploadToBucket(track: TrackMeta, dbTrackId: string): Promise<{ success: boolean; acrId?: string; error?: string }> {
  const config = getBucketConfig();
  if (!config.bucketId || !config.bearerToken || !track.filepath) {
    return { success: false, error: 'Missing config or file' };
  }

  const audioBuffer = fs.readFileSync(track.filepath);
  const { artist, title } = parseTrackTitle(track.title, track.uploader);

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
    artist,
    source_platform: 'soundcloud',
    source_url: track.url,
    source_id: track.id,
    db_track_id: dbTrackId,
  }));

  formParts.push(`--${boundary}\r\n`);
  formParts.push(`Content-Disposition: form-data; name="file"; filename="track.mp3"\r\n`);
  formParts.push(`Content-Type: audio/mp3\r\n\r\n`);
  formParts.push(audioBuffer);
  formParts.push(`\r\n--${boundary}--\r\n`);

  const bodyParts = formParts.map(p => typeof p === 'string' ? Buffer.from(p) : p);
  const bodyBuffer = Buffer.concat(bodyParts);

  try {
    const response = await fetch(`https://${config.consoleHost}/api/buckets/${config.bucketId}/files`, {
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
    return { success: false, error: result.message || `HTTP ${response.status}` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// Process a single URL
async function processUrl(url: string, supabase: any, stats: { uploaded: number; skipped: number; failed: number }) {
  const sessionId = Date.now().toString();
  const outputDir = path.join(OUTPUT_DIR, `batch_${sessionId}`);

  const tracks = await downloadFromUrl(url, outputDir);
  console.log(`   Downloaded ${tracks.length} tracks\n`);

  for (const track of tracks) {
    const { artist, title } = parseTrackTitle(track.title, track.uploader);
    console.log(`   [${artist} - ${title}]`);

    // Duration filter
    if (track.duration < FILTERS.minDuration) {
      console.log(`      SKIP: Too short (${track.duration}s)`);
      stats.skipped++;
      continue;
    }
    if (track.duration > FILTERS.maxDuration) {
      console.log(`      SKIP: Too long (${Math.round(track.duration / 60)}min) - likely a mix`);
      stats.skipped++;
      continue;
    }

    // Check if it looks like a DJ set/mix
    const mixCheck = looksLikeMix(track.title, track.description, track.duration);
    if (mixCheck.isMix) {
      console.log(`      SKIP: Looks like a mix/set - ${mixCheck.reason}`);
      stats.skipped++;
      continue;
    }

    // Check if looks unreleased
    const unreleasedCheck = looksUnreleased(track.title, track.description);
    if (!unreleasedCheck.likely) {
      console.log(`      SKIP: ${unreleasedCheck.reason}`);
      stats.skipped++;
      continue;
    }

    // Check if URL already scraped
    if (await isUrlScraped(track.url, supabase)) {
      console.log(`      SKIP: Already in database`);
      stats.skipped++;
      continue;
    }

    // Check for duplicate
    if (await isDuplicate(artist, title, track.duration, supabase)) {
      console.log(`      SKIP: Similar track exists`);
      stats.skipped++;
      continue;
    }

    // Insert to database
    const { data: dbTrack, error: insertError } = await supabase
      .from('unreleased_tracks')
      .insert({
        title,
        artist,
        source_platform: 'soundcloud',
        source_url: track.url,
        source_user: track.uploader,
        source_post_date: track.uploadDate
          ? new Date(track.uploadDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')).toISOString()
          : null,
        audio_duration_seconds: Math.round(track.duration),
        audio_quality: track.duration >= 180 ? 'high' : track.duration >= 60 ? 'medium' : 'clip',
        acrcloud_status: 'pending',
        metadata: { description: track.description?.substring(0, 500), soundcloudId: track.id },
      })
      .select()
      .single();

    if (insertError) {
      console.log(`      ERROR: DB insert failed`);
      stats.failed++;
      continue;
    }

    // Upload to ACRCloud
    const uploadResult = await uploadToBucket(track, dbTrack.id);
    if (uploadResult.success) {
      await supabase
        .from('unreleased_tracks')
        .update({
          acrcloud_acr_id: uploadResult.acrId,
          acrcloud_status: 'uploaded',
          fingerprint_created_at: new Date().toISOString(),
        })
        .eq('id', dbTrack.id);

      console.log(`      ✅ UPLOADED: ${uploadResult.acrId}`);
      stats.uploaded++;
    } else {
      await supabase
        .from('unreleased_tracks')
        .update({ acrcloud_status: 'failed' })
        .eq('id', dbTrack.id);

      console.log(`      ❌ FAILED: ${uploadResult.error}`);
      stats.failed++;
    }
  }

  // Cleanup downloaded files
  try {
    fs.rmSync(outputDir, { recursive: true, force: true });
  } catch {}
}

// Read URLs from file or stdin
async function getUrls(source: string): Promise<string[]> {
  if (source === '--interactive') {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('\nPaste SoundCloud URLs (one per line). Enter empty line when done:\n');

    const urls: string[] = [];
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) break;
      if (trimmed.includes('soundcloud.com')) {
        urls.push(trimmed);
        console.log(`  Added: ${trimmed}`);
      }
    }
    rl.close();
    return urls;
  }

  if (source.startsWith('--url')) {
    return [];
  }

  // Read from file
  if (fs.existsSync(source)) {
    const content = fs.readFileSync(source, 'utf8');
    return content.split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#') && l.includes('soundcloud.com'));
  }

  return [];
}

// Main
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Batch Unreleased Track Scraper

Usage:
  bun scripts/batch-scrape-unreleased.ts urls.txt          # From file
  bun scripts/batch-scrape-unreleased.ts --interactive     # Paste URLs
  bun scripts/batch-scrape-unreleased.ts --url "URL1" --url "URL2"

Supports:
  - Profile URLs: https://soundcloud.com/username
  - Playlist URLs: https://soundcloud.com/username/sets/playlist-name
  - Station URLs: https://soundcloud.com/discover/sets/track-stations:xxx
  - Track URLs: https://soundcloud.com/username/track-name

Example urls.txt:
  # House artists
  https://soundcloud.com/robbiedoherty
  https://soundcloud.com/maxdeanmusic

  # Stations
  https://soundcloud.com/discover/sets/track-stations:2222241374
`);
    process.exit(0);
  }

  // Check dependencies
  try {
    execSync(`${YTDLP_PATH} --version`, { stdio: 'ignore' });
  } catch {
    console.error('Error: yt-dlp not found. Install with: brew install yt-dlp');
    process.exit(1);
  }

  const supabase = getSupabase();
  if (!supabase) {
    console.error('Error: Supabase not configured');
    process.exit(1);
  }

  // Get URLs
  let urls: string[] = [];

  if (args.includes('--interactive')) {
    urls = await getUrls('--interactive');
  } else if (args.includes('--url')) {
    // Extract all --url values
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--url' && args[i + 1]) {
        urls.push(args[i + 1]);
      }
    }
  } else {
    urls = await getUrls(args[0]);
  }

  if (urls.length === 0) {
    console.error('No valid SoundCloud URLs provided');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('Batch Unreleased Track Scraper');
  console.log('='.repeat(60));
  console.log(`\nProcessing ${urls.length} URLs...\n`);

  const stats = { uploaded: 0, skipped: 0, failed: 0 };

  for (let i = 0; i < urls.length; i++) {
    console.log(`\n[${i + 1}/${urls.length}] ${urls[i]}`);
    await processUrl(urls[i], supabase, stats);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`URLs processed: ${urls.length}`);
  console.log(`Tracks uploaded: ${stats.uploaded}`);
  console.log(`Tracks skipped:  ${stats.skipped}`);
  console.log(`Tracks failed:   ${stats.failed}`);
}

main().catch(console.error);
