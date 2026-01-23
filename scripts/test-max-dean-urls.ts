/**
 * Test scraping with known Max Dean URLs
 */

import puppeteer from 'puppeteer';

const maxDeanUrls = [
  'https://www.1001tracklists.com/tracklist/14wrxfdt/max-dean-luke-dean-joss-dean-radio-1s-essential-mix-2025-12-20.html',
  'https://www.1001tracklists.com/tracklist/26b26jut/max-dean-luke-dean-wyld-lab11-birmingham-united-kingdom-2023-09-09.html',
];

async function scrapeSet(url: string) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  
  try {
    const page = await browser.newPage();
    
    // Better browser emulation
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });
    
    console.error(`\n[Scraping] ${url}`);
    
    // Navigate and wait for redirects
    const response = await page.goto(url, { 
      waitUntil: 'networkidle0', 
      timeout: 60000 
    });
    
    // Follow any redirects
    const finalUrl = page.url();
    if (finalUrl !== url && finalUrl.includes('tracklist')) {
      console.error(`[Redirected] to ${finalUrl}`);
      await page.goto(finalUrl, { waitUntil: 'networkidle0', timeout: 60000 });
    }
    
    // Wait for actual content - check for tracklist items
    let attempts = 0;
    while (attempts < 10) {
      const hasContent = await page.evaluate(() => {
        const title = document.querySelector('h1#pageTitle');
        const hasTracks = document.querySelector('.tlpTog, .tlpItem, [id^="tlp_"]');
        return title && title.textContent && 
               !title.textContent.includes('Please wait') && 
               !title.textContent.includes('forwarded') &&
               hasTracks;
      });
      
      if (hasContent) {
        console.error('[Content loaded]');
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const setData = await page.evaluate(() => {
      const data: {
        title: string;
        artist: string;
        venue?: string;
        date?: string;
        tracks: Array<{ title: string; artist: string; timestamp: string }>;
      } = {
        title: '',
        artist: '',
        tracks: [],
      };
      
      // Extract title
      const titleEl = document.querySelector('h1#pageTitle') || 
                     document.querySelector('h1') ||
                     document.querySelector('meta[property="og:title"]');
      if (titleEl) {
        data.title = (titleEl.textContent || titleEl.getAttribute('content') || '')
          .replace(/ \| 1001Tracklists$/i, '')
          .trim();
      }
      
      // Extract artist
      const artistEl = document.querySelector('a.blueLinkColor[href*="/dj/"]') ||
                      document.querySelector('a[href*="/dj/"]') ||
                      document.querySelector('meta[name="author"]');
      if (artistEl) {
        data.artist = (artistEl.textContent || artistEl.getAttribute('content') || '').trim();
      }
      
      // Extract tracks - try multiple selectors
      const trackSelectors = [
        '.tlpTog',
        '.tlpItem',
        '[id^="tlp_"]',
        '.trackItem',
      ];
      
      let trackItems: Element[] = [];
      for (const selector of trackSelectors) {
        const items = Array.from(document.querySelectorAll(selector));
        if (items.length > 0) {
          trackItems = items;
          console.log(`Found ${items.length} items with selector: ${selector}`);
          break;
        }
      }
      
      trackItems.forEach((item) => {
        const trackNameEl = item.querySelector('.trackValue, [itemprop="name"], .trackFormat');
        const artistEl = item.querySelector('a.blueLinkColor[href*="/artist/"], .artistValue, a[href*="/artist/"]');
        const timeEl = item.querySelector('.cueValueField, .cueValue');
        
        if (trackNameEl && artistEl) {
          const trackName = trackNameEl.textContent?.trim() || '';
          const artistName = artistEl.textContent?.trim() || '';
          const timestamp = timeEl?.textContent?.trim() || '0:00';
          
          if (trackName && artistName) {
            data.tracks.push({ title: trackName, artist: artistName, timestamp });
          }
        }
      });
      
      // Fallback: Look for any track/artist patterns in the page
      if (data.tracks.length === 0) {
        const allText = document.body.textContent || '';
        const trackMatches = allText.match(/\d+\.\s*([^-]+)\s*-\s*([^\n]+)/g);
        if (trackMatches) {
          trackMatches.slice(0, 20).forEach(match => {
            const parts = match.split(' - ');
            if (parts.length >= 2) {
              data.tracks.push({
                title: parts[1].trim(),
                artist: parts[0].replace(/^\d+\.\s*/, '').trim(),
                timestamp: '0:00',
              });
            }
          });
        }
      }
      
      return data;
    });
    
    console.error(`  Title: ${setData.title}`);
    console.error(`  Artist: ${setData.artist}`);
    console.error(`  Tracks: ${setData.tracks.length}`);
    
    if (setData.tracks.length > 0) {
      console.error('\n  First 5 tracks:');
      setData.tracks.slice(0, 5).forEach((t, i) => {
        console.error(`    ${i + 1}. [${t.timestamp}] ${t.artist} - ${t.title}`);
      });
    }
    
    return setData;
  } finally {
    await browser.close();
  }
}

async function main() {
  console.error('Testing Max Dean set scraping...\n');
  
  for (const url of maxDeanUrls.slice(0, 1)) {
    const result = await scrapeSet(url);
    console.error(`\n✅ Successfully scraped "${result.title}"`);
    console.error(`   ${result.tracks.length} tracks found\n`);
    
    if (result.tracks.length > 0) {
      console.log(JSON.stringify(result, null, 2));
    }
  }
}

main().catch(console.error);
