/**
 * Shared Scraper Pipeline Utilities
 *
 * Common functions used by both social-scraper.ts and discover-trending.ts:
 * - Video normalization (TikTok + Instagram)
 * - Filtering
 * - Audio download (CDN-first with yt-dlp fallback)
 * - ACRCloud upload
 * - Database operations
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { TikTokVideo, InstagramPost } from '../services/apifyClient';
import {
  YouTubeVideoInfo,
  YouTubeComment,
  YouTubeSearchResult,
  parseDuration,
} from '../services/youtube';
import commentParser, { CommentTrackHint } from './commentParser';
import * as spotify from './spotify';

// ============================================
// Configuration Types (exported)
// ============================================

export interface PlatformFilters {
  minDuration: number;
  maxAge: number;
  keywords: string[];
  excludeKeywords: string[];
  contentTypes?: string[]; // Instagram only
}

export interface ScrapeOptions {
  maxVideos?: number;
  maxPosts?: number;
  maxComments?: number;
  includeComments?: boolean;
  resultsType?: string;
}

export interface ProcessedVideo {
  id: string;
  platform: 'tiktok' | 'instagram' | 'youtube' | 'soundcloud';
  url: string;
  title: string;
  description: string;
  duration: number;
  uploadDate: Date;
  username: string;
  audioPath?: string;
  directVideoUrl?: string;
  directPlayUrl?: string;
  comments?: Array<{
    text: string;
    username?: string;
    replies?: Array<{ text: string; username?: string }>;
  }>;
}

export interface YouTubeFilters extends PlatformFilters {
  maxDuration?: number; // Filter out long DJ sets/mixes
  mixKeywords?: string[]; // Keywords that indicate a DJ set/mix (to exclude)
}

export interface ScraperConfig {
  tiktok?: {
    accounts: string[];
    filters: PlatformFilters;
    scrapeOptions?: ScrapeOptions;
  };
  instagram?: {
    accounts: string[];
    filters: PlatformFilters;
    scrapeOptions?: ScrapeOptions;
  };
  youtube?: {
    channels: string[]; // @handles or channel IDs
    searchQueries?: string[];
    filters: YouTubeFilters;
    scrapeOptions?: ScrapeOptions & {
      maxResultsPerQuery?: number;
    };
  };
  soundcloud?: {
    profiles: string[]; // SoundCloud profile URLs or usernames
    filters: PlatformFilters;
    scrapeOptions?: ScrapeOptions;
  };
  discovery?: {
    tiktok?: {
      hashtags: string[];
      filters: PlatformFilters;
      maxResultsPerHashtag?: number;
    };
    instagram?: {
      hashtags: string[];
      filters: PlatformFilters;
      maxResultsPerHashtag?: number;
    };
  };
}

// ============================================
// Paths and Constants
// ============================================

export const PROJECT_ROOT = path.resolve(__dirname, '..');
const LOCAL_YTDLP = path.join(PROJECT_ROOT, 'bin', 'yt-dlp');
const LOCAL_FFMPEG = path.join(PROJECT_ROOT, 'bin', 'ffmpeg');
export const YTDLP_PATH = fs.existsSync(LOCAL_YTDLP) ? LOCAL_YTDLP : 'yt-dlp';
export const FFMPEG_PATH = fs.existsSync(LOCAL_FFMPEG) ? LOCAL_FFMPEG : 'ffmpeg';
export const OUTPUT_DIR = path.join(PROJECT_ROOT, 'unreleased-downloads');

// ============================================
// Supabase Client
// ============================================

export type SupabaseClientType = SupabaseClient<any, 'public', any>;

export function getSupabaseClient(): SupabaseClientType | null {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Missing Supabase credentials');
    return null;
  }
  return createClient(url, key);
}

// ACRCloud bucket config
export function getBucketConfig() {
  return {
    bucketId: process.env.ACRCLOUD_BUCKET_NAME,
    bearerToken: process.env.ACRCLOUD_BEARER_TOKEN,
    consoleHost: 'api-v2.acrcloud.com',
  };
}

// ============================================
// Dependency Checks
// ============================================

export function checkYtdlpAvailable(): boolean {
  if (fs.existsSync(LOCAL_YTDLP)) return true;
  try {
    execSync('which yt-dlp', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function checkFfmpegAvailable(): boolean {
  if (fs.existsSync(LOCAL_FFMPEG)) return true;
  try {
    execSync('which ffmpeg', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// ============================================
// Video Filtering
// ============================================

export function passesFilters(
  video: ProcessedVideo,
  filters: PlatformFilters
): { passes: boolean; reason?: string } {
  // Duration filter
  if (video.duration < filters.minDuration) {
    return { passes: false, reason: `Too short (${video.duration}s < ${filters.minDuration}s)` };
  }

  // Age filter
  const daysSinceUpload = (Date.now() - video.uploadDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceUpload > filters.maxAge) {
    return { passes: false, reason: `Too old (${Math.floor(daysSinceUpload)} days > ${filters.maxAge} days)` };
  }

  const fullText = `${video.title} ${video.description}`.toLowerCase();

  // Exclude keywords - but handle "unreleased" vs "released" carefully
  for (const keyword of filters.excludeKeywords) {
    const keywordLower = keyword.toLowerCase();
    if (keywordLower === 'released') {
      // "released" should not match "unreleased"
      const releasedPattern = /(?<![un])released/i;
      if (releasedPattern.test(fullText)) {
        return { passes: false, reason: `Contains excluded keyword: "${keyword}"` };
      }
    } else if (fullText.includes(keywordLower)) {
      return { passes: false, reason: `Contains excluded keyword: "${keyword}"` };
    }
  }

  // Include keywords (if specified)
  if (filters.keywords.length > 0) {
    const hasKeyword = filters.keywords.some((kw) => fullText.includes(kw.toLowerCase()));
    if (!hasKeyword) {
      return { passes: false, reason: 'Missing required keyword' };
    }
  }

  return { passes: true };
}

// ============================================
// TikTok Normalization
// ============================================

export function normalizeTikTokVideo(video: any): ProcessedVideo | null {
  // Handle different data structures from Apify actors
  const authorUsername = video.author?.uniqueId || video.authorMeta?.name || video.authorName || 'unknown';
  const videoId = video.id || video.videoId || '';

  if (!videoId) {
    console.log('  SKIP: Video missing ID');
    return null;
  }

  const webUrl =
    video.webVideoUrl ||
    video.videoUrl ||
    `https://www.tiktok.com/@${authorUsername}/video/${videoId}`;

  // Convert comments to standard format
  const comments = video.comments?.map((c: any) => ({
    text: c.text || c.comment || '',
    username: c.user?.uniqueId || c.uniqueId || c.username,
    replies: c.replies?.map((r: any) => ({
      text: r.text || r.comment || '',
      username: r.user?.uniqueId || r.uniqueId || r.username,
    })),
  }));

  // Duration can be in different places
  const duration = video.video?.duration || video.videoMeta?.duration || video.duration || 0;

  // Timestamp can be seconds or milliseconds
  const createTime = video.createTime || video.createTimeISO || video.createdAt;
  const uploadDate = typeof createTime === 'number'
    ? new Date(createTime * (createTime > 1e12 ? 1 : 1000))
    : new Date(createTime || Date.now());

  // Extract direct CDN URLs for reliable downloads
  const directVideoUrl = video.video?.downloadAddr || video.videoMeta?.downloadAddr || video.downloadAddr || undefined;
  const directPlayUrl = video.video?.playAddr || video.videoMeta?.playAddr || video.playAddr || undefined;

  return {
    id: videoId,
    platform: 'tiktok',
    url: webUrl,
    title: video.desc || video.text || video.description || '',
    description: video.desc || video.text || video.description || '',
    duration,
    uploadDate,
    username: authorUsername,
    directVideoUrl,
    directPlayUrl,
    comments,
  };
}

// ============================================
// Instagram Normalization
// ============================================

export function normalizeInstagramPost(post: InstagramPost): ProcessedVideo {
  // Convert comments to standard format
  const comments = post.comments?.map((c) => ({
    text: c.text,
    username: c.ownerUsername,
    replies: c.replies?.map((r) => ({
      text: r.text,
      username: r.ownerUsername,
    })),
  }));

  return {
    id: post.id,
    platform: 'instagram',
    url: post.url || `https://www.instagram.com/p/${post.shortCode}/`,
    title: post.caption?.substring(0, 100) || '',
    description: post.caption || '',
    duration: post.videoDuration || 0,
    uploadDate: new Date(post.timestamp),
    username: post.ownerUsername,
    directVideoUrl: post.videoUrl || undefined,
    comments,
  };
}

// ============================================
// YouTube Normalization
// ============================================

/**
 * Normalize a YouTube video (from fetchVideoDetails) to ProcessedVideo format
 */
export function normalizeYouTubeVideo(
  video: YouTubeVideoInfo,
  comments?: YouTubeComment[]
): ProcessedVideo {
  const durationSeconds = video.durationSeconds ?? parseDuration(video.duration);

  return {
    id: video.id,
    platform: 'youtube',
    url: `https://www.youtube.com/watch?v=${video.id}`,
    title: video.title,
    description: video.description,
    duration: durationSeconds,
    uploadDate: new Date(video.publishedAt),
    username: video.channelTitle,
    comments: comments?.map((c) => ({
      text: c.text,
      username: c.authorName,
    })),
  };
}

/**
 * Normalize a YouTube search result to ProcessedVideo (partial — needs fetchVideoDetails for duration)
 */
export function normalizeYouTubeSearchResult(
  result: YouTubeSearchResult,
  details?: YouTubeVideoInfo,
  comments?: YouTubeComment[]
): ProcessedVideo {
  const durationSeconds = details?.durationSeconds ?? (details ? parseDuration(details.duration) : 0);

  return {
    id: result.videoId,
    platform: 'youtube',
    url: `https://www.youtube.com/watch?v=${result.videoId}`,
    title: details?.title || result.title,
    description: details?.description || result.description,
    duration: durationSeconds,
    uploadDate: new Date(result.publishedAt),
    username: result.channelTitle,
    comments: comments?.map((c) => ({
      text: c.text,
      username: c.authorName,
    })),
  };
}

// ============================================
// YouTube-Specific Filtering
// ============================================

const DEFAULT_MIX_KEYWORDS = [
  'dj set', 'dj mix', 'live set', 'live mix',
  'b2b', 'boiler room', 'essential mix',
  'full set', 'closing set', 'opening set',
  'radio show', 'podcast', 'mix of the',
  'hour mix', 'hr mix', 'minute mix', 'min mix',
];

/**
 * Check if a YouTube video passes YouTube-specific filters
 * (extends standard passesFilters with max duration and mix detection)
 */
export function passesYouTubeFilters(
  video: ProcessedVideo,
  filters: YouTubeFilters
): { passes: boolean; reason?: string } {
  // Standard filters first
  const baseResult = passesFilters(video, filters);
  if (!baseResult.passes) return baseResult;

  // Max duration filter (to exclude full DJ sets/mixes)
  if (filters.maxDuration && video.duration > filters.maxDuration) {
    return { passes: false, reason: `Too long (${video.duration}s > ${filters.maxDuration}s max) — likely a full set/mix` };
  }

  // Mix/set keyword detection
  const mixKeywords = filters.mixKeywords || DEFAULT_MIX_KEYWORDS;
  const fullText = `${video.title} ${video.description}`.toLowerCase();

  for (const keyword of mixKeywords) {
    if (fullText.includes(keyword.toLowerCase())) {
      return { passes: false, reason: `Likely a DJ set/mix (matched: "${keyword}")` };
    }
  }

  return { passes: true };
}

// ============================================
// Title Parsing
// ============================================

export function parseTitle(fullTitle: string, uploader: string): { artist: string; title: string } {
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
    title: fullTitle || 'Untitled',
  };
}

// ============================================
// Audio Download — CDN Direct
// ============================================

export async function downloadAudioDirect(
  cdnUrl: string,
  outputPath: string
): Promise<string | null> {
  const tracksDir = path.dirname(outputPath);
  fs.mkdirSync(tracksDir, { recursive: true });

  // Skip if already downloaded
  if (fs.existsSync(outputPath)) {
    console.log(`  Audio already exists: ${outputPath}`);
    return outputPath;
  }

  const tempMp4 = outputPath.replace(/\.mp3$/, '.tmp.mp4');

  try {
    // Fetch the video from CDN
    console.log(`  Downloading from CDN...`);
    const response = await fetch(cdnUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://www.tiktok.com/',
      },
    });

    if (!response.ok) {
      console.log(`  CDN download failed: HTTP ${response.status}`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 1000) {
      console.log(`  CDN download too small (${buffer.length} bytes), likely expired`);
      return null;
    }

    fs.writeFileSync(tempMp4, buffer);
    console.log(`  Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)}MB from CDN`);

    // Extract audio with ffmpeg
    return new Promise((resolve) => {
      const ffmpegArgs = [
        '-i', tempMp4,
        '-vn',
        '-acodec', 'libmp3lame',
        '-ab', '192k',
        '-y',
        outputPath,
      ];

      const proc = spawn(FFMPEG_PATH, ffmpegArgs, { stdio: 'pipe' });

      let stderr = '';
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        // Clean up temp file
        try { fs.unlinkSync(tempMp4); } catch {}

        if (code === 0 && fs.existsSync(outputPath)) {
          console.log(`  Extracted audio: ${outputPath}`);
          resolve(outputPath);
        } else {
          console.log(`  ffmpeg extraction failed (code ${code})`);
          resolve(null);
        }
      });

      proc.on('error', (err) => {
        try { fs.unlinkSync(tempMp4); } catch {}
        console.log(`  ffmpeg error: ${err.message}`);
        resolve(null);
      });
    });
  } catch (err) {
    try { fs.unlinkSync(tempMp4); } catch {}
    console.log(`  CDN download error: ${err instanceof Error ? err.message : 'Unknown'}`);
    return null;
  }
}

// ============================================
// Audio Download — yt-dlp (Fallback)
// ============================================

export async function downloadAudioYtdlp(
  videoUrl: string,
  outputPath: string
): Promise<string | null> {
  const tracksDir = path.dirname(outputPath);
  fs.mkdirSync(tracksDir, { recursive: true });

  // Skip if already downloaded
  if (fs.existsSync(outputPath)) {
    console.log(`  Audio already exists: ${outputPath}`);
    return outputPath;
  }

  if (!checkYtdlpAvailable()) {
    console.log(`  yt-dlp not available, skipping fallback`);
    return null;
  }

  console.log(`  Downloading audio via yt-dlp from: ${videoUrl}`);

  return new Promise((resolve) => {
    const ytdlpArgs = [
      videoUrl,
      '--extract-audio',
      '--audio-format',
      'mp3',
      '--audio-quality',
      '0',
      '--output',
      outputPath,
      '--no-playlist',
      '--ffmpeg-location',
      path.dirname(FFMPEG_PATH),
    ];

    const proc = spawn(YTDLP_PATH, ytdlpArgs, { stdio: 'pipe' });

    let stderr = '';
    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        console.log(`  Downloaded via yt-dlp: ${outputPath}`);
        resolve(outputPath);
      } else {
        console.error(`  yt-dlp download failed: ${stderr.substring(0, 200)}`);
        resolve(null);
      }
    });

    proc.on('error', (err) => {
      console.error(`  yt-dlp error: ${err.message}`);
      resolve(null);
    });
  });
}

// ============================================
// Audio Download — CDN first, yt-dlp fallback
// ============================================

export async function downloadAudioWithFallback(
  video: ProcessedVideo,
  outputDir: string
): Promise<string | null> {
  const tracksDir = path.join(outputDir, 'tracks');
  fs.mkdirSync(tracksDir, { recursive: true });

  const outputPath = path.join(tracksDir, `${video.platform}_${video.id}.mp3`);

  // Skip if already downloaded
  if (fs.existsSync(outputPath)) {
    console.log(`  Audio already exists: ${outputPath}`);
    return outputPath;
  }

  // YouTube and SoundCloud: skip CDN, go straight to yt-dlp (which handles these natively)
  if (video.platform === 'youtube' || video.platform === 'soundcloud') {
    console.log(`  Downloading via yt-dlp (${video.platform})...`);
    return downloadAudioYtdlp(video.url, outputPath);
  }

  // TikTok/Instagram: try CDN URL first (downloadAddr preferred, then playAddr, then videoUrl)
  const cdnUrl = video.directVideoUrl || video.directPlayUrl;
  if (cdnUrl) {
    console.log(`  Trying CDN download...`);
    const result = await downloadAudioDirect(cdnUrl, outputPath);
    if (result) return result;
    console.log(`  CDN failed, falling back to yt-dlp...`);
  }

  // Fallback to yt-dlp
  return downloadAudioYtdlp(video.url, outputPath);
}

// ============================================
// ACRCloud Upload
// ============================================

export async function uploadToACRCloud(
  video: ProcessedVideo,
  audioPath: string,
  dbTrackId: string
): Promise<{ success: boolean; acrId?: string; error?: string }> {
  const config = getBucketConfig();

  if (!config.bucketId || !config.bearerToken) {
    return {
      success: false,
      error: 'ACRCloud bucket credentials not configured',
    };
  }

  if (!fs.existsSync(audioPath)) {
    return { success: false, error: 'Audio file not found' };
  }

  const audioBuffer = fs.readFileSync(audioPath);
  const { artist, title } = parseTitle(video.title, video.username);

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
  addField(
    'user_defined',
    JSON.stringify({
      artist: artist,
      source_platform: video.platform,
      source_url: video.url,
      source_id: video.id,
      db_track_id: dbTrackId,
    })
  );

  formParts.push(`--${boundary}\r\n`);
  formParts.push(`Content-Disposition: form-data; name="file"; filename="track.mp3"\r\n`);
  formParts.push(`Content-Type: audio/mp3\r\n\r\n`);
  formParts.push(audioBuffer);
  formParts.push(`\r\n--${boundary}--\r\n`);

  const bodyParts = formParts.map((p) => (typeof p === 'string' ? Buffer.from(p) : p)) as Uint8Array[];
  const bodyBuffer = Buffer.concat(bodyParts);

  try {
    const url = `https://${config.consoleHost}/api/buckets/${config.bucketId}/files`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.bearerToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: bodyBuffer as unknown as BodyInit,
    });

    const result = await response.json();

    if (response.ok && result.data?.acr_id) {
      return { success: true, acrId: result.data.acr_id };
    }

    return {
      success: false,
      error: result.message || result.error || `HTTP ${response.status}`,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ============================================
// Database Operations
// ============================================

export async function saveTrackToDatabase(
  supabase: SupabaseClientType,
  video: ProcessedVideo,
  acrId?: string,
  extraMetadata?: Record<string, any>
): Promise<string | null> {
  const { artist, title } = parseTitle(video.title, video.username);

  // Check if already exists
  const { data: existing } = await supabase
    .from('unreleased_tracks')
    .select('id')
    .eq('source_url', video.url)
    .single();

  if (existing) {
    console.log(`  Already in database: ${(existing as any).id}`);
    return (existing as any).id;
  }

  // Insert new track
  const { data: newTrack, error } = await supabase
    .from('unreleased_tracks')
    .insert({
      title,
      artist,
      source_platform: video.platform,
      source_url: video.url,
      source_user: video.username,
      source_post_date: video.uploadDate.toISOString(),
      audio_duration_seconds: Math.round(video.duration),
      audio_quality: video.duration >= 180 ? 'high' : video.duration >= 60 ? 'medium' : 'clip',
      acrcloud_status: acrId ? 'uploaded' : 'pending',
      acrcloud_acr_id: acrId || null,
      fingerprint_created_at: acrId ? new Date().toISOString() : null,
      metadata: {
        platform_id: video.id,
        ...extraMetadata,
      },
    })
    .select()
    .single();

  if (error || !newTrack) {
    console.error(`  Database insert error: ${error?.message || 'No data returned'}`);
    return null;
  }

  return (newTrack as any).id;
}

export async function saveCommentsToDatabase(
  supabase: SupabaseClientType,
  trackId: string,
  video: ProcessedVideo,
  hints: CommentTrackHint[]
): Promise<number> {
  if (hints.length === 0) return 0;

  // Only save ID-related hints
  const idHints = commentParser.filterIdRelatedHints(hints);
  if (idHints.length === 0) return 0;

  const records = idHints.map((hint) => ({
    unreleased_track_id: trackId,
    platform: video.platform,
    hint_type: hint.hintType,
    original_comment: hint.sourceComment,
    commenter_username: hint.commenterUsername || null,
    parsed_artist: hint.possibleArtist || null,
    parsed_title: hint.possibleTitle || null,
    extracted_links: hint.extractedLinks || null,
    timestamp_reference: hint.timestamp || null,
    confidence: hint.confidence,
    is_reply_to_id_request: hint.isReplyToIdRequest,
  }));

  const { error } = await supabase.from('track_id_hints').insert(records);

  if (error) {
    console.error(`  Error saving hints: ${error.message}`);
    return 0;
  }

  return idHints.length;
}

// ============================================
// Main Processing Pipeline
// ============================================

export async function processVideos(
  videos: ProcessedVideo[],
  dryRun: boolean = false,
  extraMetadata?: Record<string, any>,
  options?: { checkSpotify?: boolean; checkDuplicates?: boolean }
): Promise<{
  processed: number;
  uploaded: number;
  failed: number;
  hintsFound: number;
}> {
  const supabase = getSupabaseClient();
  if (!supabase && !dryRun) {
    console.error('Cannot proceed without Supabase connection');
    return { processed: 0, uploaded: 0, failed: 0, hintsFound: 0 };
  }

  const outputDir = path.join(OUTPUT_DIR, `scrape_${Date.now()}`);
  fs.mkdirSync(outputDir, { recursive: true });

  let processed = 0;
  let uploaded = 0;
  let failed = 0;
  let hintsFound = 0;

  for (const video of videos) {
    processed++;
    console.log(`\n[${processed}/${videos.length}] ${video.platform}: ${video.title.substring(0, 60)}...`);
    console.log(`  URL: ${video.url}`);
    console.log(`  Duration: ${video.duration}s, Username: @${video.username}`);

    // Parse comments for track hints
    if (video.comments && video.comments.length > 0) {
      const hints = commentParser.parsePostComments(video.comments);
      const idHints = commentParser.filterIdRelatedHints(hints);
      if (idHints.length > 0) {
        console.log(`  Found ${idHints.length} ID hints in comments`);
        hintsFound += idHints.length;
      }
    }

    // Spotify release check + bucket dedup (before expensive download)
    const { artist: parsedArtist, title: parsedTitle } = parseTitle(video.title, video.username);

    if (options?.checkSpotify) {
      const spotifyCheck = await spotify.isOnSpotify(parsedArtist, parsedTitle);
      if (spotifyCheck.found) {
        console.log(`  SKIP: Already released on Spotify`);
        if (spotifyCheck.url) console.log(`        ${spotifyCheck.url}`);
        continue;
      }
    }

    if (options?.checkDuplicates && supabase) {
      const dupCheck = await spotify.isDuplicateInBucket(parsedArtist, parsedTitle, video.duration, supabase);
      if (dupCheck.isDuplicate) {
        console.log(`  SKIP: Similar track already in bucket (ID: ${dupCheck.existingId})`);
        continue;
      }
    }

    if (dryRun) {
      console.log('  [DRY RUN] Would download and process');
      continue;
    }

    // Download audio (CDN-first, yt-dlp fallback)
    const audioPath = await downloadAudioWithFallback(video, outputDir);
    if (!audioPath) {
      console.log('  FAILED: Could not download audio');
      failed++;
      continue;
    }

    // Save to database first
    const trackId = await saveTrackToDatabase(supabase!, video, undefined, extraMetadata);
    if (!trackId) {
      console.log('  FAILED: Could not save to database');
      failed++;
      continue;
    }

    // Upload to ACRCloud
    const uploadResult = await uploadToACRCloud(video, audioPath, trackId);
    if (uploadResult.success) {
      // Update track with ACR ID
      await supabase!
        .from('unreleased_tracks')
        .update({
          acrcloud_acr_id: uploadResult.acrId,
          acrcloud_status: 'uploaded',
          fingerprint_created_at: new Date().toISOString(),
        })
        .eq('id', trackId);

      console.log(`  UPLOADED: ACR ID = ${uploadResult.acrId}`);
      uploaded++;
    } else {
      await supabase!
        .from('unreleased_tracks')
        .update({
          acrcloud_status: 'failed',
          metadata: {
            platform_id: video.id,
            lastError: uploadResult.error,
            lastErrorAt: new Date().toISOString(),
            ...extraMetadata,
          },
        })
        .eq('id', trackId);

      console.log(`  UPLOAD FAILED: ${uploadResult.error}`);
      failed++;
    }

    // Save comment hints
    if (video.comments && video.comments.length > 0) {
      const hints = commentParser.parsePostComments(video.comments);
      const savedHints = await saveCommentsToDatabase(supabase!, trackId, video, hints);
      if (savedHints > 0) {
        console.log(`  Saved ${savedHints} ID hints to database`);
      }
    }
  }

  return { processed, uploaded, failed, hintsFound };
}
