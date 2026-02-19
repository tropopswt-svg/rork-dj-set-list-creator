#!/usr/bin/env bun
/**
 * YouTube Unreleased Track Scraper
 *
 * Scrapes YouTube channels and search results for unreleased/ID tracks,
 * downloads audio via yt-dlp, and uploads to ACRCloud custom bucket.
 *
 * Usage:
 *   bun scripts/youtube-scraper.ts --config ./scripts/scraper-config.json
 *   bun scripts/youtube-scraper.ts --channel "@Cloonee" --dry-run
 *   bun scripts/youtube-scraper.ts --search "unreleased techno" --dry-run
 *   bun scripts/youtube-scraper.ts --process-pending
 *
 * Prerequisites:
 *   - YOUTUBE_API_KEY environment variable set
 *   - ffmpeg installed (brew install ffmpeg)
 *   - yt-dlp installed (brew install yt-dlp)
 *   - Supabase and ACRCloud credentials configured
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  searchVideos,
  resolveChannelId,
  fetchChannelUploads,
  fetchVideoDetails,
  fetchVideoComments,
  parseDuration,
  YouTubeVideoInfo,
  YouTubeSearchResult,
  SearchOptions,
} from '../services/youtube';

import {
  ProcessedVideo,
  YouTubeFilters,
  ScraperConfig,
  PROJECT_ROOT,
  OUTPUT_DIR,
  getSupabaseClient,
  checkYtdlpAvailable,
  checkFfmpegAvailable,
  passesYouTubeFilters,
  normalizeYouTubeVideo,
  normalizeYouTubeSearchResult,
  downloadAudioYtdlp,
  uploadToACRCloud,
  parseTitle,
  processVideos,
} from '../lib/scraper-pipeline';

// ============================================
// Paths
// ============================================

const DEFAULT_CONFIG_PATH = path.join(__dirname, 'scraper-config.json');

// ============================================
// Dependency Checks
// ============================================

function checkDependencies(): boolean {
  let allGood = true;

  // Check YouTube API key
  const ytKey = process.env.YOUTUBE_API_KEY || process.env.EXPO_PUBLIC_YOUTUBE_API_KEY;
  if (!ytKey) {
    console.error('[Dependencies] ERROR: YOUTUBE_API_KEY not configured');
    allGood = false;
  } else {
    console.log('[Dependencies] YouTube API key configured');
  }

  // Check yt-dlp (required for YouTube audio download)
  if (checkYtdlpAvailable()) {
    console.log('[Dependencies] yt-dlp available');
  } else {
    console.error('[Dependencies] ERROR: yt-dlp not found. Install with: brew install yt-dlp');
    allGood = false;
  }

  // Check ffmpeg (required for audio extraction)
  if (checkFfmpegAvailable()) {
    console.log('[Dependencies] ffmpeg available');
  } else {
    console.error('[Dependencies] ERROR: ffmpeg not found. Install with: brew install ffmpeg');
    allGood = false;
  }

  return allGood;
}

// ============================================
// YouTube Channel Scraping
// ============================================

async function scrapeYouTubeChannels(
  channels: string[],
  filters: YouTubeFilters,
  scrapeOptions: { maxVideos?: number; includeComments?: boolean; maxComments?: number } = {}
): Promise<ProcessedVideo[]> {
  const allVideos: ProcessedVideo[] = [];
  const maxVideos = scrapeOptions.maxVideos || 30;
  const includeComments = scrapeOptions.includeComments ?? true;
  const maxComments = scrapeOptions.maxComments || 200;

  // Calculate publishedAfter date from maxAge filter
  const publishedAfter = filters.maxAge
    ? new Date(Date.now() - filters.maxAge * 24 * 60 * 60 * 1000).toISOString()
    : undefined;

  for (const channel of channels) {
    console.log(`\n[YouTube] Scraping channel: ${channel}`);

    try {
      // Resolve handle to channel ID
      const channelId = await resolveChannelId(channel);
      if (!channelId) {
        console.error(`  Could not resolve channel: ${channel}`);
        continue;
      }
      console.log(`  Resolved to channel ID: ${channelId}`);

      // Fetch recent uploads
      const uploads = await fetchChannelUploads(channelId, maxVideos, publishedAfter);
      console.log(`  Found ${uploads.length} recent uploads`);

      if (uploads.length === 0) continue;

      // Fetch full video details (needed for duration)
      const videoIds = uploads.map((u) => u.videoId);
      const details = await fetchVideoDetails(videoIds);
      const detailsMap = new Map(details.map((d) => [d.id, d]));

      for (const upload of uploads) {
        const detail = detailsMap.get(upload.videoId);
        if (!detail) continue;

        // Fetch comments if enabled
        let comments;
        if (includeComments && (detail.commentCount ?? 0) > 0) {
          try {
            comments = await fetchVideoComments(upload.videoId, maxComments);
          } catch {
            // Comments might be disabled
          }
        }

        const normalized = normalizeYouTubeSearchResult(upload, detail, comments);
        const filterResult = passesYouTubeFilters(normalized, filters);

        if (filterResult.passes) {
          allVideos.push(normalized);
          console.log(`  MATCH: ${normalized.title.substring(0, 60)}... (${normalized.duration}s)`);
        } else {
          console.log(`  SKIP: ${normalized.title.substring(0, 50)}... - ${filterResult.reason}`);
        }
      }
    } catch (error) {
      console.error(`[YouTube] Error scraping ${channel}:`, error);
    }
  }

  return allVideos;
}

// ============================================
// YouTube Search Scraping
// ============================================

async function scrapeYouTubeSearch(
  queries: string[],
  filters: YouTubeFilters,
  scrapeOptions: { maxResultsPerQuery?: number; includeComments?: boolean; maxComments?: number } = {}
): Promise<ProcessedVideo[]> {
  const allVideos: ProcessedVideo[] = [];
  const seenIds = new Set<string>();
  const maxPerQuery = scrapeOptions.maxResultsPerQuery || 25;
  const includeComments = scrapeOptions.includeComments ?? true;
  const maxComments = scrapeOptions.maxComments || 200;

  // Calculate publishedAfter date from maxAge filter
  const publishedAfter = filters.maxAge
    ? new Date(Date.now() - filters.maxAge * 24 * 60 * 60 * 1000).toISOString()
    : undefined;

  for (const query of queries) {
    console.log(`\n[YouTube Search] Query: "${query}"`);

    try {
      const searchOptions: SearchOptions = {
        maxResults: maxPerQuery,
        publishedAfter,
        order: 'relevance',
        videoDuration: 'short', // <4 minutes — good for previews/clips
      };

      const results = await searchVideos(query, searchOptions);
      console.log(`  Found ${results.length} results`);

      if (results.length === 0) continue;

      // Deduplicate across queries
      const newResults = results.filter((r) => !seenIds.has(r.videoId));
      for (const r of newResults) seenIds.add(r.videoId);

      if (newResults.length === 0) {
        console.log(`  All results already seen from previous queries`);
        continue;
      }

      // Fetch full video details
      const videoIds = newResults.map((r) => r.videoId);
      const details = await fetchVideoDetails(videoIds);
      const detailsMap = new Map(details.map((d) => [d.id, d]));

      for (const result of newResults) {
        const detail = detailsMap.get(result.videoId);
        if (!detail) continue;

        // Fetch comments if enabled
        let comments;
        if (includeComments && (detail.commentCount ?? 0) > 0) {
          try {
            comments = await fetchVideoComments(result.videoId, maxComments);
          } catch {
            // Comments might be disabled
          }
        }

        const normalized = normalizeYouTubeSearchResult(result, detail, comments);
        const filterResult = passesYouTubeFilters(normalized, filters);

        if (filterResult.passes) {
          allVideos.push(normalized);
          console.log(`  MATCH: ${normalized.title.substring(0, 60)}... (${normalized.duration}s)`);
        } else {
          console.log(`  SKIP: ${normalized.title.substring(0, 50)}... - ${filterResult.reason}`);
        }
      }
    } catch (error) {
      console.error(`[YouTube Search] Error for "${query}":`, error);
    }
  }

  return allVideos;
}

// ============================================
// Process Pending YouTube Tracks
// ============================================

async function processPending(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('Cannot proceed without Supabase connection');
    return;
  }

  console.log('='.repeat(60));
  console.log('Processing Pending / Failed YouTube Uploads');
  console.log('='.repeat(60));

  const { data: pendingTracks, error } = await supabase
    .from('unreleased_tracks')
    .select('*')
    .eq('is_active', true)
    .eq('source_platform', 'youtube')
    .in('acrcloud_status', ['pending', 'failed'])
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) {
    console.error('Error fetching pending tracks:', error);
    return;
  }

  if (!pendingTracks || pendingTracks.length === 0) {
    console.log('No pending YouTube tracks to process.');
    return;
  }

  console.log(`Found ${pendingTracks.length} pending/failed YouTube tracks\n`);

  const outputDir = path.join(OUTPUT_DIR, `yt_retry_${Date.now()}`);
  fs.mkdirSync(outputDir, { recursive: true });

  let retried = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  const MAX_RETRIES = 3;

  for (const track of pendingTracks) {
    const retryCount = track.metadata?.retryCount || 0;

    console.log(`\n[${retried + skipped + 1}/${pendingTracks.length}] ${track.artist} - ${track.title}`);
    console.log(`  Source: ${track.source_url}`);
    console.log(`  Status: ${track.acrcloud_status}, Retries: ${retryCount}/${MAX_RETRIES}`);

    if (retryCount >= MAX_RETRIES) {
      console.log(`  SKIP: Max retries (${MAX_RETRIES}) exceeded`);
      skipped++;
      continue;
    }

    retried++;

    const tracksDir = path.join(outputDir, 'tracks');
    fs.mkdirSync(tracksDir, { recursive: true });
    const outputPath = path.join(tracksDir, `youtube_${track.metadata?.platform_id || track.id}.mp3`);

    const audioPath = await downloadAudioYtdlp(track.source_url, outputPath);
    if (!audioPath) {
      console.log('  FAILED: Could not download audio');
      await supabase
        .from('unreleased_tracks')
        .update({
          acrcloud_status: 'failed',
          metadata: {
            ...track.metadata,
            retryCount: retryCount + 1,
            lastRetryAt: new Date().toISOString(),
            lastError: 'Download failed',
          },
        })
        .eq('id', track.id);
      failed++;
      continue;
    }

    const video: ProcessedVideo = {
      id: track.metadata?.platform_id || track.id,
      platform: 'youtube',
      url: track.source_url,
      title: track.title,
      description: track.title,
      duration: track.audio_duration_seconds || 0,
      uploadDate: new Date(track.source_post_date || track.created_at),
      username: track.source_user || '',
    };

    const uploadResult = await uploadToACRCloud(video, audioPath, track.id);
    if (uploadResult.success) {
      await supabase
        .from('unreleased_tracks')
        .update({
          acrcloud_acr_id: uploadResult.acrId,
          acrcloud_status: 'uploaded',
          fingerprint_created_at: new Date().toISOString(),
          metadata: {
            ...track.metadata,
            retryCount: retryCount + 1,
            lastRetryAt: new Date().toISOString(),
          },
        })
        .eq('id', track.id);

      console.log(`  UPLOADED: ACR ID = ${uploadResult.acrId}`);
      succeeded++;
    } else {
      await supabase
        .from('unreleased_tracks')
        .update({
          acrcloud_status: 'failed',
          metadata: {
            ...track.metadata,
            retryCount: retryCount + 1,
            lastRetryAt: new Date().toISOString(),
            lastError: uploadResult.error,
          },
        })
        .eq('id', track.id);

      console.log(`  UPLOAD FAILED: ${uploadResult.error}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('RETRY SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total found:  ${pendingTracks.length}`);
  console.log(`Retried:      ${retried}`);
  console.log(`Succeeded:    ${succeeded}`);
  console.log(`Failed:       ${failed}`);
  console.log(`Skipped:      ${skipped} (max retries exceeded)`);
}

// ============================================
// CLI Commands
// ============================================

async function runFromConfig(configPath: string, dryRun: boolean): Promise<void> {
  const configFile = fs.existsSync(configPath) ? configPath : DEFAULT_CONFIG_PATH;

  if (!fs.existsSync(configFile)) {
    console.error(`Config file not found: ${configFile}`);
    process.exit(1);
  }

  const config: ScraperConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));

  if (!config.youtube) {
    console.error('No youtube section in config file');
    process.exit(1);
  }

  const ytConfig = config.youtube;
  const allVideos: ProcessedVideo[] = [];

  console.log('='.repeat(60));
  console.log('YouTube Unreleased Track Scraper');
  console.log('='.repeat(60));
  console.log(`Config: ${configFile}`);
  console.log(`Dry run: ${dryRun}`);
  console.log('');

  // Scrape YouTube channels
  if (ytConfig.channels && ytConfig.channels.length > 0) {
    console.log(`\n${'='.repeat(40)}`);
    console.log(`YouTube Channels: ${ytConfig.channels.join(', ')}`);
    console.log('='.repeat(40));

    const channelVideos = await scrapeYouTubeChannels(
      ytConfig.channels,
      ytConfig.filters,
      ytConfig.scrapeOptions
    );
    allVideos.push(...channelVideos);
  }

  // Search YouTube
  if (ytConfig.searchQueries && ytConfig.searchQueries.length > 0) {
    console.log(`\n${'='.repeat(40)}`);
    console.log(`YouTube Search Queries: ${ytConfig.searchQueries.length} queries`);
    console.log('='.repeat(40));

    const searchVideos = await scrapeYouTubeSearch(
      ytConfig.searchQueries,
      ytConfig.filters,
      ytConfig.scrapeOptions
    );

    // Deduplicate against channel results
    const existingIds = new Set(allVideos.map((v) => v.id));
    const newSearchVideos = searchVideos.filter((v) => !existingIds.has(v.id));
    console.log(`\n  ${searchVideos.length} search results, ${newSearchVideos.length} new (after dedup)`);
    allVideos.push(...newSearchVideos);
  }

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Total videos to process: ${allVideos.length}`);
  console.log('='.repeat(40));

  if (allVideos.length === 0) {
    console.log('No videos found matching filters.');
    return;
  }

  // Process all videos through the shared pipeline
  const results = await processVideos(allVideos, dryRun, undefined, {
    checkSpotify: true,
    checkDuplicates: true,
  });

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('YOUTUBE SCRAPER SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total processed: ${results.processed}`);
  console.log(`Uploaded:        ${results.uploaded}`);
  console.log(`Failed:          ${results.failed}`);
  console.log(`ID hints found:  ${results.hintsFound}`);
  console.log('');
}

async function runForChannel(channel: string, dryRun: boolean): Promise<void> {
  console.log('='.repeat(60));
  console.log(`YouTube Channel Scraper: ${channel}`);
  console.log('='.repeat(60));
  console.log(`Dry run: ${dryRun}`);
  console.log('');

  const defaultFilters: YouTubeFilters = {
    minDuration: 30,
    maxDuration: 600,
    maxAge: 90,
    keywords: [],
    excludeKeywords: ['released', 'out now', 'spotify', 'beatport', 'buy', 'available'],
  };

  const videos = await scrapeYouTubeChannels([channel], defaultFilters, {
    maxVideos: 30,
    includeComments: true,
    maxComments: 200,
  });

  console.log(`\nFound ${videos.length} videos matching filters`);

  if (videos.length === 0) return;

  const results = await processVideos(videos, dryRun, undefined, {
    checkSpotify: true,
    checkDuplicates: true,
  });

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total processed: ${results.processed}`);
  console.log(`Uploaded:        ${results.uploaded}`);
  console.log(`Failed:          ${results.failed}`);
  console.log(`ID hints found:  ${results.hintsFound}`);
}

async function runForSearch(query: string, dryRun: boolean): Promise<void> {
  console.log('='.repeat(60));
  console.log(`YouTube Search Scraper: "${query}"`);
  console.log('='.repeat(60));
  console.log(`Dry run: ${dryRun}`);
  console.log('');

  const defaultFilters: YouTubeFilters = {
    minDuration: 30,
    maxDuration: 600,
    maxAge: 90,
    keywords: [],
    excludeKeywords: ['released', 'out now', 'spotify', 'beatport', 'buy', 'available'],
  };

  const videos = await scrapeYouTubeSearch([query], defaultFilters, {
    maxResultsPerQuery: 25,
    includeComments: true,
    maxComments: 200,
  });

  console.log(`\nFound ${videos.length} videos matching filters`);

  if (videos.length === 0) return;

  const results = await processVideos(videos, dryRun, undefined, {
    checkSpotify: true,
    checkDuplicates: true,
  });

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total processed: ${results.processed}`);
  console.log(`Uploaded:        ${results.uploaded}`);
  console.log(`Failed:          ${results.failed}`);
  console.log(`ID hints found:  ${results.hintsFound}`);
}

// ============================================
// CLI Entry Point
// ============================================

function printUsage(): void {
  console.log(`
YouTube Unreleased Track Scraper

Usage:
  bun scripts/youtube-scraper.ts --config <path-to-config.json>
  bun scripts/youtube-scraper.ts --channel <@handle>
  bun scripts/youtube-scraper.ts --search <query>
  bun scripts/youtube-scraper.ts --process-pending

Options:
  --config           Path to config JSON file (default: ./scripts/scraper-config.json)
  --channel          Scrape a specific YouTube channel (@handle or channel ID)
  --search           Search YouTube for videos matching a query
  --dry-run          Don't download or upload, just show what would be processed
  --process-pending  Retry pending/failed YouTube uploads

Examples:
  bun scripts/youtube-scraper.ts --config ./scripts/scraper-config.json
  bun scripts/youtube-scraper.ts --channel "@Cloonee" --dry-run
  bun scripts/youtube-scraper.ts --search "unreleased techno" --dry-run
  bun scripts/youtube-scraper.ts --process-pending

Prerequisites:
  - YOUTUBE_API_KEY environment variable set
  - yt-dlp installed (brew install yt-dlp)
  - ffmpeg installed (brew install ffmpeg)
  - Supabase and ACRCloud credentials configured
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(args.includes('--help') || args.includes('-h') ? 0 : 1);
  }

  // Check dependencies first
  if (!checkDependencies()) {
    process.exit(1);
  }

  const dryRun = args.includes('--dry-run');

  // Process pending
  if (args.includes('--process-pending')) {
    await processPending();
    return;
  }

  // Search mode
  const searchIdx = args.indexOf('--search');
  if (searchIdx !== -1) {
    const query = args[searchIdx + 1];
    if (!query) {
      console.error('No search query specified');
      process.exit(1);
    }
    await runForSearch(query, dryRun);
    return;
  }

  // Channel mode
  const channelIdx = args.indexOf('--channel');
  if (channelIdx !== -1) {
    const channel = args[channelIdx + 1];
    if (!channel) {
      console.error('No channel specified');
      process.exit(1);
    }
    await runForChannel(channel, dryRun);
    return;
  }

  // Config mode
  const configIdx = args.indexOf('--config');
  const configPath = configIdx !== -1 ? args[configIdx + 1] || DEFAULT_CONFIG_PATH : DEFAULT_CONFIG_PATH;
  await runFromConfig(configPath, dryRun);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
