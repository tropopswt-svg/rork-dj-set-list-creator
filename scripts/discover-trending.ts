#!/usr/bin/env bun
/**
 * Hashtag Auto-Discovery Script
 *
 * Searches TikTok and Instagram hashtags for trending unreleased tracks,
 * downloads audio immediately (CDN URLs expire in ~1-2 hours), and
 * uploads to ACRCloud for fingerprinting.
 *
 * Usage:
 *   bun scripts/discover-trending.ts
 *   bun scripts/discover-trending.ts --hashtags "#unreleased,#ID"
 *   bun scripts/discover-trending.ts --platform tiktok
 *   bun scripts/discover-trending.ts --dry-run
 *
 * Prerequisites:
 *   - APIFY_API_TOKEN environment variable set
 *   - ffmpeg installed (brew install ffmpeg)
 *   - yt-dlp optional as fallback (brew install yt-dlp)
 *   - Supabase and ACRCloud credentials configured
 */

import * as fs from 'fs';
import * as path from 'path';

import apifyClient, {
  TikTokHashtagSearchOptions,
  InstagramHashtagSearchOptions,
} from '../services/apifyClient';

import {
  ProcessedVideo,
  PlatformFilters,
  ScraperConfig,
  getSupabaseClient,
  checkFfmpegAvailable,
  passesFilters,
  normalizeTikTokVideo,
  normalizeInstagramPost,
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

  if (!checkFfmpegAvailable()) {
    console.error('[Dependencies] ERROR: ffmpeg not found. Install with: brew install ffmpeg');
    allGood = false;
  }

  if (!apifyClient.isApifyConfigured()) {
    console.error('[Dependencies] ERROR: APIFY_API_TOKEN not configured');
    allGood = false;
  }

  return allGood;
}

// ============================================
// Deduplication
// ============================================

async function getExistingSourceUrls(): Promise<Set<string>> {
  const supabase = getSupabaseClient();
  if (!supabase) return new Set();

  const { data } = await supabase
    .from('unreleased_tracks')
    .select('source_url')
    .in('source_platform', ['tiktok', 'instagram']);

  if (!data) return new Set();
  return new Set(data.map((row: any) => row.source_url));
}

// ============================================
// TikTok Hashtag Discovery
// ============================================

async function discoverTikTokHashtags(
  hashtags: string[],
  filters: PlatformFilters,
  maxResultsPerHashtag: number
): Promise<ProcessedVideo[]> {
  const allVideos: ProcessedVideo[] = [];

  for (const hashtag of hashtags) {
    console.log(`\n[TikTok Discovery] Searching hashtag: ${hashtag}`);

    try {
      const options: TikTokHashtagSearchOptions = {
        maxVideos: maxResultsPerHashtag,
        includeComments: false, // Skip comments for discovery (speed)
      };

      const videos = await apifyClient.searchTikTokHashtag(hashtag, options);
      console.log(`[TikTok Discovery] Found ${videos.length} videos for ${hashtag}`);

      for (const video of videos) {
        const normalized = normalizeTikTokVideo(video);
        if (!normalized) continue;

        const filterResult = passesFilters(normalized, filters);

        if (filterResult.passes) {
          allVideos.push(normalized);
          console.log(`  MATCH: @${normalized.username} - ${normalized.title.substring(0, 50)}...`);
        } else {
          console.log(`  SKIP: ${normalized.title.substring(0, 40)}... - ${filterResult.reason}`);
        }
      }
    } catch (error) {
      console.error(`[TikTok Discovery] Error searching ${hashtag}:`, error);
    }
  }

  return allVideos;
}

// ============================================
// Instagram Hashtag Discovery
// ============================================

async function discoverInstagramHashtags(
  hashtags: string[],
  filters: PlatformFilters,
  maxResultsPerHashtag: number
): Promise<ProcessedVideo[]> {
  const allVideos: ProcessedVideo[] = [];

  for (const hashtag of hashtags) {
    console.log(`\n[Instagram Discovery] Searching hashtag: ${hashtag}`);

    try {
      const options: InstagramHashtagSearchOptions = {
        maxPosts: maxResultsPerHashtag,
        includeComments: false,
      };

      const posts = await apifyClient.searchInstagramHashtag(hashtag, options);
      console.log(`[Instagram Discovery] Found ${posts.length} posts for ${hashtag}`);

      // Filter to videos only
      const videoPosts = posts.filter(
        (p) => p.type === 'Video' || p.videoUrl || p.videoDuration
      );
      console.log(`[Instagram Discovery] ${videoPosts.length} are videos`);

      for (const post of videoPosts) {
        const normalized = normalizeInstagramPost(post);
        const filterResult = passesFilters(normalized, filters);

        if (filterResult.passes) {
          allVideos.push(normalized);
          console.log(`  MATCH: @${normalized.username} - ${normalized.title.substring(0, 50)}...`);
        } else {
          console.log(`  SKIP: ${normalized.title.substring(0, 40)}... - ${filterResult.reason}`);
        }
      }
    } catch (error) {
      console.error(`[Instagram Discovery] Error searching ${hashtag}:`, error);
    }
  }

  return allVideos;
}

// ============================================
// Main Discovery Pipeline
// ============================================

async function runDiscovery(options: {
  hashtags?: string[];
  platform?: 'tiktok' | 'instagram';
  dryRun: boolean;
  configPath: string;
}): Promise<void> {
  console.log('='.repeat(60));
  console.log('Hashtag Auto-Discovery');
  console.log('='.repeat(60));
  console.log(`Dry run: ${options.dryRun}`);
  console.log('');

  // Load config
  const configFile = fs.existsSync(options.configPath) ? options.configPath : DEFAULT_CONFIG_PATH;
  if (!fs.existsSync(configFile)) {
    console.error(`Config file not found: ${configFile}`);
    process.exit(1);
  }

  const config: ScraperConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));

  if (!config.discovery) {
    console.error('No discovery section in config. Add "discovery" with hashtag lists.');
    process.exit(1);
  }

  let allVideos: ProcessedVideo[] = [];

  // Determine hashtags to search
  const customHashtags = options.hashtags;

  // TikTok discovery
  if ((!options.platform || options.platform === 'tiktok') && config.discovery.tiktok) {
    const tiktokHashtags = customHashtags || config.discovery.tiktok.hashtags;
    const tiktokFilters = config.discovery.tiktok.filters;
    const maxResults = config.discovery.tiktok.maxResultsPerHashtag || 50;

    console.log(`\n${'='.repeat(40)}`);
    console.log(`TikTok Hashtags: ${tiktokHashtags.join(', ')}`);
    console.log('='.repeat(40));

    const tiktokVideos = await discoverTikTokHashtags(tiktokHashtags, tiktokFilters, maxResults);
    allVideos.push(...tiktokVideos);
  }

  // Instagram discovery
  if ((!options.platform || options.platform === 'instagram') && config.discovery.instagram) {
    const igHashtags = customHashtags || config.discovery.instagram.hashtags;
    const igFilters = config.discovery.instagram.filters;
    const maxResults = config.discovery.instagram.maxResultsPerHashtag || 50;

    console.log(`\n${'='.repeat(40)}`);
    console.log(`Instagram Hashtags: ${igHashtags.join(', ')}`);
    console.log('='.repeat(40));

    const igVideos = await discoverInstagramHashtags(igHashtags, igFilters, maxResults);
    allVideos.push(...igVideos);
  }

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Total candidates found: ${allVideos.length}`);

  // Deduplicate by URL within this batch
  const seenUrls = new Set<string>();
  allVideos = allVideos.filter((v) => {
    if (seenUrls.has(v.url)) return false;
    seenUrls.add(v.url);
    return true;
  });
  console.log(`After dedup (batch): ${allVideos.length}`);

  // Deduplicate against existing database entries
  if (!options.dryRun) {
    const existingUrls = await getExistingSourceUrls();
    const beforeCount = allVideos.length;
    allVideos = allVideos.filter((v) => !existingUrls.has(v.url));
    const dupeCount = beforeCount - allVideos.length;
    if (dupeCount > 0) {
      console.log(`Removed ${dupeCount} already in database`);
    }
  }

  console.log(`Videos to process: ${allVideos.length}`);
  console.log('='.repeat(40));

  if (allVideos.length === 0) {
    console.log('No new videos found matching filters.');
    return;
  }

  // Process all videos (download + ACRCloud + DB)
  const results = await processVideos(allVideos, options.dryRun, {
    discoverySource: 'hashtag',
  }, { checkSpotify: true, checkDuplicates: true });

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('DISCOVERY SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total processed: ${results.processed}`);
  console.log(`Uploaded:        ${results.uploaded}`);
  console.log(`Failed:          ${results.failed}`);
  console.log(`ID hints found:  ${results.hintsFound}`);
  console.log('');
}

// ============================================
// CLI Entry Point
// ============================================

function printUsage(): void {
  console.log(`
Hashtag Auto-Discovery

Searches TikTok and Instagram hashtags for trending unreleased tracks.

Usage:
  bun scripts/discover-trending.ts
  bun scripts/discover-trending.ts --hashtags "#unreleased,#ID"
  bun scripts/discover-trending.ts --platform tiktok
  bun scripts/discover-trending.ts --dry-run

Options:
  --hashtags    Comma-separated hashtags to search (overrides config)
  --platform    Only search one platform (tiktok or instagram)
  --config      Path to config JSON file (default: ./scripts/scraper-config.json)
  --dry-run     Don't download or upload, just show what would be processed

Examples:
  bun scripts/discover-trending.ts
  bun scripts/discover-trending.ts --hashtags "#unreleased,#ID,#dubplate"
  bun scripts/discover-trending.ts --platform tiktok --dry-run
  bun scripts/discover-trending.ts --config ./my-config.json
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  // Check dependencies
  if (!checkDependencies()) {
    process.exit(1);
  }

  const dryRun = args.includes('--dry-run');

  // Parse --hashtags
  let hashtags: string[] | undefined;
  const hashtagIdx = args.indexOf('--hashtags');
  if (hashtagIdx !== -1 && args[hashtagIdx + 1]) {
    hashtags = args[hashtagIdx + 1]
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean);
  }

  // Parse --platform
  let platform: 'tiktok' | 'instagram' | undefined;
  const platformIdx = args.indexOf('--platform');
  if (platformIdx !== -1 && args[platformIdx + 1]) {
    const p = args[platformIdx + 1];
    if (p === 'tiktok' || p === 'instagram') {
      platform = p;
    } else {
      console.error('Invalid platform. Use: tiktok or instagram');
      process.exit(1);
    }
  }

  // Parse --config
  let configPath = DEFAULT_CONFIG_PATH;
  const configIdx = args.indexOf('--config');
  if (configIdx !== -1 && args[configIdx + 1]) {
    configPath = args[configIdx + 1];
  }

  await runDiscovery({ hashtags, platform, dryRun, configPath });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
