#!/usr/bin/env node
/**
 * Bulk Scraper for 1001Tracklists
 *
 * Scrapes index pages to get tracklist URLs, then processes each one.
 * Run with: node scripts/bulk-scrape-1001.js
 *
 * Options:
 *   --source=most-liked     Scrape most liked tracklists
 *   --source=premium        Scrape premium audio livesets
 *   --source=group:<id>     Scrape a specific group (e.g., group:tomorrowland)
 *   --limit=50              Max number of sets to scrape
 *   --dry-run               Just list URLs, don't import
 */

const https = require('https');
const http = require('http');

// Configuration
const API_BASE_URL = process.env.API_URL || 'https://rork-dj-set-list-creator.vercel.app';
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds to be respectful

// Parse command line args
const args = process.argv.slice(2);
const options = {
  source: 'most-liked',
  limit: 50,
  dryRun: false,
};

args.forEach(arg => {
  if (arg.startsWith('--source=')) {
    options.source = arg.replace('--source=', '');
  } else if (arg.startsWith('--limit=')) {
    options.limit = parseInt(arg.replace('--limit=', ''));
  } else if (arg === '--dry-run') {
    options.dryRun = true;
  }
});

// Source URLs
const SOURCES = {
  'most-liked': 'https://www.1001tracklists.com/specials/most_liked_tracklists.html',
  'premium': 'https://www.1001tracklists.com/specials/premium_audio_livesets/index.html',
  'trending': 'https://www.1001tracklists.com/charts/trending/index.html',
};

// Helper to fetch a URL
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const req = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    }, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve).catch(reject);
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Extract tracklist URLs from an index page
function extractTracklistUrls(html) {
  const urls = [];

  // Match href="/tracklist/xxxxx/..." patterns
  const regex = /href="(\/tracklist\/[a-z0-9]+\/[^"]+)"/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const path = match[1];
    // Clean up the URL
    const fullUrl = `https://www.1001tracklists.com${path}`;

    // Avoid duplicates
    if (!urls.includes(fullUrl)) {
      urls.push(fullUrl);
    }
  }

  return urls;
}

// Extract set info from a tracklist page (simplified version)
function extractSetInfo(html, sourceUrl) {
  const result = {
    source: '1001tracklists',
    sourceUrl,
    pageType: 'tracklist',
    setInfo: {},
    tracks: [],
    artists: [],
  };

  try {
    // Extract title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      result.setInfo.title = titleMatch[1].replace(/ \| 1001Tracklists$/i, '').trim();
    }

    // Extract DJ name from URL or title
    const djMatch = html.match(/href="\/dj\/[^"]+">([^<]+)<\/a>/i);
    if (djMatch) {
      result.setInfo.djName = djMatch[1].trim();
    } else if (result.setInfo.title) {
      const parts = result.setInfo.title.split(/\s*[@\-–]\s*/);
      if (parts.length > 0) {
        result.setInfo.djName = parts[0].trim();
      }
    }

    // Extract date from URL or page
    const dateMatch = sourceUrl.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      result.setInfo.date = dateMatch[1];
    }

    // Extract venue from title
    const venueMatch = result.setInfo.title?.match(/@\s*([^,\-–]+)/i);
    if (venueMatch) {
      result.setInfo.venue = venueMatch[1].trim();
    }

    // Extract external links
    const youtubeMatch = html.match(/href="(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[^"]+)"/i);
    if (youtubeMatch) {
      result.setInfo.youtube_url = youtubeMatch[1];
    }

    const soundcloudMatch = html.match(/href="(https?:\/\/(?:www\.)?soundcloud\.com\/[^"]+\/[^"]+)"/i);
    if (soundcloudMatch) {
      result.setInfo.soundcloud_url = soundcloudMatch[1];
    }

    // Extract tracks (simplified - looks for track items)
    // This is a basic extraction - the Chrome extension does this better with DOM access
    const trackRegex = /<span[^>]*class="[^"]*trackValue[^"]*"[^>]*>([^<]+)<\/span>/gi;
    let trackMatch;
    let position = 1;

    while ((trackMatch = trackRegex.exec(html)) !== null) {
      const trackName = trackMatch[1].trim();
      if (trackName && trackName !== 'ID' && trackName.length > 2) {
        result.tracks.push({
          title: trackName,
          artist: result.setInfo.djName || 'Unknown',
          timestamp_seconds: 0,
          position: position++,
          is_unreleased: trackName.toLowerCase().includes('unreleased') || trackName.toLowerCase().includes(' id'),
        });
      }
    }

    // If no tracks found with that method, try JSON-LD
    if (result.tracks.length === 0) {
      const jsonLdMatch = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/i);
      if (jsonLdMatch) {
        try {
          const jsonLd = JSON.parse(jsonLdMatch[1]);
          if (jsonLd.track && Array.isArray(jsonLd.track)) {
            jsonLd.track.forEach((t, i) => {
              if (t.name) {
                const parts = t.name.split(' - ');
                result.tracks.push({
                  title: parts.length > 1 ? parts.slice(1).join(' - ') : t.name,
                  artist: parts[0] || 'Unknown',
                  timestamp_seconds: 0,
                  position: i + 1,
                });
              }
            });
          }
        } catch (e) {
          // JSON parse error, skip
        }
      }
    }

  } catch (e) {
    console.error('  Error extracting set info:', e.message);
  }

  return result;
}

// Send data to our API
async function sendToApi(data) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE_URL}/api/chrome-import`);
    const postData = JSON.stringify(data);

    const protocol = url.protocol === 'https:' ? https : http;

    const req = protocol.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ success: false, error: 'Invalid JSON response' });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main function
async function main() {
  console.log('='.repeat(60));
  console.log('1001Tracklists Bulk Scraper');
  console.log('='.repeat(60));
  console.log(`Source: ${options.source}`);
  console.log(`Limit: ${options.limit}`);
  console.log(`Dry run: ${options.dryRun}`);
  console.log(`API: ${API_BASE_URL}`);
  console.log('');

  // Get source URL
  let sourceUrl;
  if (options.source.startsWith('group:')) {
    const groupId = options.source.replace('group:', '');
    sourceUrl = `https://www.1001tracklists.com/groups/${groupId}/index.html`;
  } else {
    sourceUrl = SOURCES[options.source];
  }

  if (!sourceUrl) {
    console.error(`Unknown source: ${options.source}`);
    console.log('Available sources: most-liked, premium, trending, group:<id>');
    process.exit(1);
  }

  console.log(`Fetching index page: ${sourceUrl}`);

  try {
    const indexHtml = await fetchUrl(sourceUrl);
    const tracklistUrls = extractTracklistUrls(indexHtml);

    console.log(`Found ${tracklistUrls.length} tracklist URLs`);

    // Limit the URLs
    const urlsToProcess = tracklistUrls.slice(0, options.limit);
    console.log(`Processing ${urlsToProcess.length} sets...`);
    console.log('');

    if (options.dryRun) {
      console.log('DRY RUN - URLs that would be processed:');
      urlsToProcess.forEach((url, i) => {
        console.log(`  ${i + 1}. ${url}`);
      });
      return;
    }

    // Process each tracklist
    const results = {
      success: 0,
      skipped: 0,
      failed: 0,
    };

    for (let i = 0; i < urlsToProcess.length; i++) {
      const url = urlsToProcess[i];
      console.log(`[${i + 1}/${urlsToProcess.length}] ${url}`);

      try {
        // Fetch the tracklist page
        const html = await fetchUrl(url);

        // Extract set info
        const setData = extractSetInfo(html, url);

        if (!setData.setInfo.title || !setData.setInfo.djName) {
          console.log('  Skipped: Could not extract set info');
          results.skipped++;
          continue;
        }

        console.log(`  Title: ${setData.setInfo.title}`);
        console.log(`  DJ: ${setData.setInfo.djName}`);
        console.log(`  Tracks: ${setData.tracks.length}`);

        // Send to API
        const apiResult = await sendToApi(setData);

        if (apiResult.success) {
          if (apiResult.setsCreated > 0) {
            console.log(`  ✅ Imported!`);
            results.success++;
          } else {
            console.log(`  ⏭️  Already exists`);
            results.skipped++;
          }
        } else {
          console.log(`  ❌ Error: ${apiResult.error || 'Unknown'}`);
          results.failed++;
        }

      } catch (e) {
        console.log(`  ❌ Error: ${e.message}`);
        results.failed++;
      }

      // Delay between requests
      if (i < urlsToProcess.length - 1) {
        await sleep(DELAY_BETWEEN_REQUESTS);
      }
    }

    // Summary
    console.log('');
    console.log('='.repeat(60));
    console.log('Summary');
    console.log('='.repeat(60));
    console.log(`✅ Imported: ${results.success}`);
    console.log(`⏭️  Skipped: ${results.skipped}`);
    console.log(`❌ Failed: ${results.failed}`);

  } catch (e) {
    console.error('Fatal error:', e.message);
    process.exit(1);
  }
}

// Run
main().catch(console.error);
