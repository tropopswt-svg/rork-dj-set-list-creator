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
 *   --seeds                 Scrape all categories from 1001-seeds.json
 *   --seeds=venues          Scrape only specific categories (comma-separated)
 *   --pages=1               Number of listing pages to scrape per seed (default 1)
 *   --limit=50              Max number of sets to scrape per seed
 *   --delay=1500            Delay between requests in ms (default 1500)
 *   --dry-run               Just list URLs, don't import
 *   --headful               Run with visible browser (useful for solving captchas)
 */

// Try puppeteer (bundled Chrome) first, fall back to puppeteer-core
let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (e) {
  puppeteer = require('puppeteer-core');
}
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const API_BASE_URL = process.env.API_URL || 'https://trakthat.app';
const DEFAULT_DELAY = 1500;

// Find Chrome executable (only needed for puppeteer-core)
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
      fs.accessSync(p);
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

// Apply stealth patches to a page to avoid bot detection
async function applyStealthPatches(page) {
  // Override navigator.webdriver
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    // Override chrome.runtime to look like a real browser
    window.chrome = { runtime: {} };
    // Override permissions query
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);
    // Override plugins to look non-empty
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
  });
}

// Parse command line args
const args = process.argv.slice(2);
const options = {
  source: null,
  seeds: null,       // null = not using seeds, '' = all categories, 'venues,labels' = specific
  limit: 50,
  pages: 1,
  delay: DEFAULT_DELAY,
  dryRun: false,
  headful: false,
};

args.forEach(arg => {
  if (arg.startsWith('--source=')) {
    options.source = arg.replace('--source=', '');
  } else if (arg === '--seeds') {
    options.seeds = '';  // All categories
  } else if (arg.startsWith('--seeds=')) {
    options.seeds = arg.replace('--seeds=', '');
  } else if (arg.startsWith('--limit=')) {
    options.limit = parseInt(arg.replace('--limit=', ''));
  } else if (arg.startsWith('--pages=')) {
    options.pages = parseInt(arg.replace('--pages=', ''));
  } else if (arg.startsWith('--delay=')) {
    options.delay = parseInt(arg.replace('--delay=', ''));
  } else if (arg === '--dry-run') {
    options.dryRun = true;
  } else if (arg === '--headful') {
    options.headful = true;
  }
});

// Default to seeds mode if nothing specified
if (options.source === null && options.seeds === null) {
  options.seeds = '';
}

// Source URLs (legacy presets)
const SOURCES = {
  'most-liked': 'https://www.1001tracklists.com/specials/most_liked_tracklists.html',
  'premium': 'https://www.1001tracklists.com/specials/premium_audio_livesets/index.html',
  'trending': 'https://www.1001tracklists.com/charts/trending/index.html',
};

// Load seeds from 1001-seeds.json
function loadSeeds(categories) {
  const seedPath = path.join(__dirname, '1001-seeds.json');
  if (!fs.existsSync(seedPath)) {
    console.error('Seed file not found:', seedPath);
    process.exit(1);
  }

  const seeds = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  const cats = categories ? categories.split(',').map(c => c.trim()) : Object.keys(seeds);

  const entries = [];
  for (const cat of cats) {
    if (!seeds[cat]) {
      console.warn(`Unknown category: ${cat} (available: ${Object.keys(seeds).join(', ')})`);
      continue;
    }
    for (const entry of seeds[cat]) {
      entries.push({ ...entry, category: cat });
    }
  }
  return entries;
}

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

          // Strip unreleased indicators from track title
          if (isUnreleased && trackName) {
            trackName = trackName
              .replace(/\s*\(?\s*unreleased\s*\??\s*\)?\s*/gi, ' ')
              .replace(/\s*\(?\s*forthcoming\s*\)?\s*/gi, ' ')
              .replace(/\s+/g, ' ')
              .replace(/\(\s*$/, '')
              .trim();
          }

          if (trackName || trackArtist) {
            result.tracks.push({
              title: trackName || 'Unknown',
              artist: trackArtist || result.setInfo.djName || 'Unknown',
              timestamp_seconds: secs,
              timestamp_str: timeStr || null,
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

// Scrape tracklist URLs from a listing page, with pagination
async function scrapeListingPage(page, baseUrl, maxPages) {
  const allUrls = [];

  for (let p = 1; p <= maxPages; p++) {
    // Build paginated URL
    const pageUrl = p === 1 ? baseUrl : appendPage(baseUrl, p);

    console.log(`  Page ${p}: ${pageUrl}`);
    await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for dynamic content
    await sleep(3000);

    // Check for IP block or cloudflare challenge
    const pageContent = await page.content();
    const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 300) || '');

    if (bodyText.includes('has been limited due to overuse') || bodyText.includes('captcha to unblock')) {
      console.log('  ⛔ IP is rate-limited by 1001tracklists!');
      if (options.headful) {
        console.log('  Solve the captcha in the browser window, then press Enter...');
        await new Promise(r => process.stdin.once('data', r));
        await sleep(2000);
      } else {
        console.log('  Run with --headful to solve captcha, or wait and try later');
        return [];
      }
    } else if (pageContent.includes('turnstile') || pageContent.includes('challenge-platform')) {
      console.log('  ⚠️  Cloudflare challenge detected, waiting...');
      await sleep(10000);
    }

    const urls = await extractTracklistUrls(page);
    if (urls.length === 0) {
      if (p === 1) {
        // First page empty — try scrolling
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await sleep(3000);
        const retryUrls = await extractTracklistUrls(page);
        if (retryUrls.length > 0) {
          allUrls.push(...retryUrls);
        }
      }
      break; // No more pages
    }

    // Only add URLs we haven't seen
    const before = allUrls.length;
    for (const url of urls) {
      if (!allUrls.includes(url)) allUrls.push(url);
    }
    const newCount = allUrls.length - before;
    console.log(`  Found ${urls.length} URLs (${newCount} new, ${allUrls.length} total)`);

    if (newCount === 0) break; // All duplicates = no more new content
  }

  return allUrls;
}

// Append page number to a URL
function appendPage(url, pageNum) {
  // Handle URLs that already have query params
  if (url.includes('?')) {
    return `${url}&p=${pageNum}`;
  }
  // Handle URLs ending in /index.html
  if (url.endsWith('/index.html')) {
    return url.replace('/index.html', `/index${pageNum}.html`);
  }
  // Handle URLs ending in .html
  if (url.endsWith('.html')) {
    return url.replace('.html', `${pageNum}.html`);
  }
  // Default: add query param
  return `${url}?p=${pageNum}`;
}

// Process a batch of tracklist URLs
async function processTracklistUrls(page, urls, results, delay) {
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`  [${i + 1}/${urls.length}] ${url}`);

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      const setData = await extractSetData(page, url);

      if (!setData.setInfo.title || setData.setInfo.title.includes('1001Tracklists')) {
        console.log('    ⚠️  Skipped: Could not extract set info');
        results.skipped++;
        continue;
      }

      console.log(`    ${setData.setInfo.djName} — ${setData.setInfo.title} (${setData.tracks.length} tracks)`);

      const apiResult = await sendToApi(setData);

      if (apiResult.success) {
        if (apiResult.setsCreated > 0) {
          console.log('    ✅ Imported');
          results.success++;
        } else {
          console.log('    ⏭️  Already exists');
          results.skipped++;
        }
      } else {
        console.log(`    ❌ Error: ${apiResult.error || 'Unknown'}`);
        results.failed++;
      }

    } catch (e) {
      console.log(`    ❌ Error: ${e.message}`);
      results.failed++;
    }

    if (i < urls.length - 1) {
      await sleep(delay);
    }
  }
}

// Main function
async function main() {
  const isSeedMode = options.seeds !== null;

  console.log('='.repeat(60));
  console.log('1001Tracklists Bulk Scraper (Puppeteer)');
  console.log('='.repeat(60));

  if (isSeedMode) {
    console.log(`Mode: Seeds ${options.seeds || '(all categories)'}`);
  } else {
    console.log(`Source: ${options.source}`);
  }
  console.log(`Limit per seed: ${options.limit}`);
  console.log(`Pages per seed: ${options.pages}`);
  console.log(`Delay: ${options.delay}ms`);
  console.log(`Dry run: ${options.dryRun}`);
  console.log(`Headful: ${options.headful}`);
  console.log(`API: ${API_BASE_URL}`);
  console.log('');

  // Find Chrome (only needed if puppeteer doesn't bundle one)
  const chromePath = findChrome();
  if (chromePath) {
    console.log(`Using Chrome: ${chromePath}`);
  } else {
    console.log('Using Puppeteer bundled Chrome');
  }
  console.log('');

  // Build list of sources to scrape
  let sources = [];
  if (isSeedMode) {
    const seeds = loadSeeds(options.seeds || null);
    sources = seeds.map(s => ({ name: `[${s.category}] ${s.name}`, url: s.url }));
    console.log(`Loaded ${sources.length} seeds`);
  } else {
    let sourceUrl;
    if (options.source.startsWith('url:')) {
      sourceUrl = options.source.replace('url:', '');
    } else {
      sourceUrl = SOURCES[options.source];
    }
    if (!sourceUrl) {
      console.error(`Unknown source: ${options.source}`);
      console.log('Available: most-liked, premium, trending, url:<full-url>, --seeds');
      process.exit(1);
    }
    sources = [{ name: options.source, url: sourceUrl }];
  }

  console.log('');

  let browser;
  try {
    console.log(`Launching browser (${options.headful ? 'headful' : 'headless'})...`);
    const launchOpts = {
      headless: options.headful ? false : 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--window-size=1920,1080',
      ],
    };
    // Only set executablePath if we found a local Chrome (puppeteer may bundle its own)
    if (chromePath) {
      launchOpts.executablePath = chromePath;
    }
    browser = await puppeteer.launch(launchOpts);

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    await applyStealthPatches(page);

    // Grand totals
    const grandTotal = { success: 0, skipped: 0, failed: 0, urlsFound: 0 };

    for (let si = 0; si < sources.length; si++) {
      const src = sources[si];
      console.log('');
      console.log('-'.repeat(60));
      console.log(`[${si + 1}/${sources.length}] ${src.name}`);
      console.log(`  ${src.url}`);
      console.log('-'.repeat(60));

      // Scrape listing page(s) for tracklist URLs
      const tracklistUrls = await scrapeListingPage(page, src.url, options.pages);

      if (tracklistUrls.length === 0) {
        console.log('  No tracklist URLs found, skipping');
        continue;
      }

      // Limit
      const urlsToProcess = tracklistUrls.slice(0, options.limit);
      grandTotal.urlsFound += urlsToProcess.length;
      console.log(`  Processing ${urlsToProcess.length} of ${tracklistUrls.length} tracklists`);

      if (options.dryRun) {
        console.log('  DRY RUN — URLs:');
        urlsToProcess.forEach((url, i) => {
          console.log(`    ${i + 1}. ${url}`);
        });
        continue;
      }

      // Process each tracklist
      const results = { success: 0, skipped: 0, failed: 0 };
      await processTracklistUrls(page, urlsToProcess, results, options.delay);

      // Per-seed summary
      console.log(`  Summary: ✅ ${results.success} imported, ⏭️ ${results.skipped} skipped, ❌ ${results.failed} failed`);

      grandTotal.success += results.success;
      grandTotal.skipped += results.skipped;
      grandTotal.failed += results.failed;
    }

    // Grand summary
    console.log('');
    console.log('='.repeat(60));
    console.log('Grand Total');
    console.log('='.repeat(60));
    console.log(`Seeds processed: ${sources.length}`);
    console.log(`URLs found: ${grandTotal.urlsFound}`);
    if (!options.dryRun) {
      console.log(`✅ Imported: ${grandTotal.success}`);
      console.log(`⏭️  Skipped: ${grandTotal.skipped}`);
      console.log(`❌ Failed: ${grandTotal.failed}`);
    }

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
