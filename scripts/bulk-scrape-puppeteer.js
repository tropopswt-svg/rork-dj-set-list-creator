#!/usr/bin/env node
/**
 * Bulk Scraper for 1001Tracklists using Puppeteer
 * Uses headless Chrome to properly render dynamic content
 *
 * Run with: node scripts/bulk-scrape-puppeteer.js
 *
 * Options:
 *   --source=most-liked     Scrape most liked tracklists
 *   --source=premium        Scrape premium audio livesets
 *   --source=url:<url>      Scrape a specific index page URL
 *   --limit=10              Max number of sets to scrape
 *   --dry-run               Just list URLs, don't import
 */

const puppeteer = require('puppeteer-core');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

// Configuration
const API_BASE_URL = process.env.API_URL || 'https://rork-dj-set-list-creator.vercel.app';
const DELAY_BETWEEN_REQUESTS = 3000; // 3 seconds between page loads

// Find Chrome executable
function findChrome() {
  const paths = [
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];

  for (const p of paths) {
    try {
      require('fs').accessSync(p);
      return p;
    } catch (e) {
      // Not found, try next
    }
  }

  // Try to find via which command
  try {
    const result = execSync('which google-chrome || which chromium', { encoding: 'utf8' });
    return result.trim();
  } catch (e) {
    // Not found
  }

  return null;
}

// Parse command line args
const args = process.argv.slice(2);
const options = {
  source: 'most-liked',
  limit: 10,
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

// Send data to our API
function sendToApi(data) {
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

// Extract tracklist URLs from index page
async function extractTracklistUrls(page) {
  return await page.evaluate(() => {
    const urls = [];
    const links = document.querySelectorAll('a[href*="/tracklist/"]');
    links.forEach(link => {
      const href = link.href;
      if (href && !urls.includes(href)) {
        urls.push(href);
      }
    });
    return urls;
  });
}

// Extract set data from a tracklist page (runs in browser context)
async function extractSetData(page, sourceUrl) {
  // Wait for content to load
  await page.waitForSelector('.bItm, .tlpItem, #tlTab', { timeout: 10000 }).catch(() => {});

  // Give extra time for timestamps to load
  await sleep(2000);

  return await page.evaluate((sourceUrl) => {
    const result = {
      source: '1001tracklists',
      sourceUrl,
      pageType: 'tracklist',
      setInfo: {},
      tracks: [],
      artists: [],
    };

    try {
      // Get title
      const titleEl = document.querySelector('#pageTitle, h1');
      result.setInfo.title = titleEl?.textContent?.trim() ||
        document.title.replace(/ \| 1001Tracklists$/i, '').trim();

      // Get DJ name
      const djLink = document.querySelector('a[href*="/dj/"]');
      if (djLink) {
        result.setInfo.djName = djLink.textContent?.trim() || '';
      }
      if (!result.setInfo.djName && result.setInfo.title) {
        const parts = result.setInfo.title.split(/\s*[@\-–]\s*/);
        result.setInfo.djName = parts[0]?.trim() || 'Unknown';
      }

      // Get date
      const dateMatch = sourceUrl.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        result.setInfo.date = dateMatch[1];
      }

      // Get venue from title
      const venueMatch = result.setInfo.title?.match(/@\s*([^,\-–]+)/i);
      if (venueMatch) {
        result.setInfo.venue = venueMatch[1].trim();
      }

      // Get external links
      document.querySelectorAll('a[href]').forEach(link => {
        const href = link.href;
        if (href.includes('youtube.com/watch') || href.includes('youtu.be/')) {
          if (!result.setInfo.youtube_url) result.setInfo.youtube_url = href;
        } else if (href.includes('soundcloud.com/') && href.split('/').length > 4) {
          if (!result.setInfo.soundcloud_url) result.setInfo.soundcloud_url = href;
        } else if (href.includes('mixcloud.com/') && href.split('/').length > 4) {
          if (!result.setInfo.mixcloud_url) result.setInfo.mixcloud_url = href;
        }
      });

      // Extract tracks
      const trackItems = document.querySelectorAll('.bItm:not(.bItmH):not(.con), .tlpItem, #tlTab .bItm');

      trackItems.forEach((item, index) => {
        try {
          const artistEl = item.querySelector('.blueLinkColor, a[href*="/artist/"]');
          const trackEl = item.querySelector('.trackValue, span[itemprop="name"]');

          let trackArtist = artistEl?.textContent?.trim() || '';
          let trackName = trackEl?.textContent?.trim() || '';

          // Parse "Artist - Track" format
          if (!trackArtist && trackName && trackName.includes(' - ')) {
            const parts = trackName.split(' - ');
            trackArtist = parts[0].trim();
            trackName = parts.slice(1).join(' - ').trim();
          }

          // Get timestamp
          let timeStr = '';
          const cueEl = item.querySelector('div.cue[id^="cue_"], .cue.noWrap, [class*="cue"]');
          if (cueEl) {
            const text = cueEl.textContent?.trim() || '';
            const match = text.match(/^(\d{1,2}:\d{2}(:\d{2})?)$/);
            if (match) timeStr = match[1];
          }

          // Parse timestamp to seconds
          let secs = 0;
          if (timeStr) {
            const parts = timeStr.split(':').map(Number);
            if (parts.length === 3) {
              secs = parts[0] * 3600 + parts[1] * 60 + parts[2];
            } else if (parts.length === 2) {
              secs = parts[0] * 60 + parts[1];
            }
          }

          // Check if ID/unreleased
          const isUnreleased = trackName?.toLowerCase().includes(' id') ||
                              trackName?.toLowerCase().includes('unreleased') ||
                              trackName?.toLowerCase() === 'id';

          if (trackName || trackArtist) {
            result.tracks.push({
              title: trackName || 'Unknown',
              artist: trackArtist || result.setInfo.djName || 'Unknown',
              timestamp_seconds: secs,
              timestamp_str: timeStr || '0:00',
              position: index + 1,
              is_unreleased: isUnreleased,
            });
          }
        } catch (e) {
          // Skip problematic track
        }
      });

    } catch (e) {
      console.error('Extract error:', e);
    }

    return result;
  }, sourceUrl);
}

// Main function
async function main() {
  console.log('='.repeat(60));
  console.log('1001Tracklists Bulk Scraper (Puppeteer)');
  console.log('='.repeat(60));
  console.log(`Source: ${options.source}`);
  console.log(`Limit: ${options.limit}`);
  console.log(`Dry run: ${options.dryRun}`);
  console.log(`API: ${API_BASE_URL}`);
  console.log('');

  // Find Chrome
  const chromePath = findChrome();
  if (!chromePath) {
    console.error('❌ Could not find Chrome/Chromium installation');
    console.log('Please install Google Chrome or Chromium');
    process.exit(1);
  }
  console.log(`Using Chrome: ${chromePath}`);
  console.log('');

  // Get source URL
  let sourceUrl;
  if (options.source.startsWith('url:')) {
    sourceUrl = options.source.replace('url:', '');
  } else {
    sourceUrl = SOURCES[options.source];
  }

  if (!sourceUrl) {
    console.error(`Unknown source: ${options.source}`);
    console.log('Available sources: most-liked, premium, trending, url:<full-url>');
    process.exit(1);
  }

  let browser;
  try {
    // Launch browser
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    // Fetch index page
    console.log(`Fetching index page: ${sourceUrl}`);
    await page.goto(sourceUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait longer for dynamic content and potential cloudflare check
    console.log('Waiting for page to fully load...');
    await sleep(5000);

    // Check for cloudflare/turnstile challenge
    const pageContent = await page.content();
    if (pageContent.includes('turnstile') || pageContent.includes('challenge-platform')) {
      console.log('⚠️  Cloudflare challenge detected, waiting longer...');
      await sleep(10000);
    }

    // Debug: log page title
    const pageTitle = await page.title();
    console.log(`Page title: ${pageTitle}`);

    const tracklistUrls = await extractTracklistUrls(page);

    // If no URLs found, try scrolling to load more content
    if (tracklistUrls.length === 0) {
      console.log('No URLs found, trying to scroll...');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(3000);
    }

    const finalUrls = tracklistUrls.length > 0 ? tracklistUrls : await extractTracklistUrls(page);
    console.log(`Found ${finalUrls.length} tracklist URLs`);

    // Limit URLs
    const urlsToProcess = finalUrls.slice(0, options.limit);
    console.log(`Processing ${urlsToProcess.length} sets...`);
    console.log('');

    if (options.dryRun) {
      console.log('DRY RUN - URLs that would be processed:');
      urlsToProcess.forEach((url, i) => {
        console.log(`  ${i + 1}. ${url}`);
      });
      await browser.close();
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
        // Navigate to tracklist page
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Extract set data
        const setData = await extractSetData(page, url);

        if (!setData.setInfo.title || setData.setInfo.title.includes('1001Tracklists')) {
          console.log('  ⚠️  Skipped: Could not extract set info');
          results.skipped++;
          continue;
        }

        console.log(`  Title: ${setData.setInfo.title}`);
        console.log(`  DJ: ${setData.setInfo.djName}`);
        console.log(`  Tracks: ${setData.tracks.length}`);
        if (setData.setInfo.youtube_url) console.log(`  YouTube: ✓`);
        if (setData.setInfo.soundcloud_url) console.log(`  SoundCloud: ✓`);

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
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run
main().catch(console.error);
