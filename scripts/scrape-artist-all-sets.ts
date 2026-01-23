/**
 * Scrape all sets from an artist on 1001tracklists
 * 
 * Usage:
 *   bun run scripts/scrape-artist-all-sets.ts "Artist Name" [maxSets]
 * 
 * Example:
 *   bun run scripts/scrape-artist-all-sets.ts "Max Dean" 5
 */

import puppeteer from 'puppeteer';

interface ScrapedTrack {
  title: string;
  artist: string;
  timestamp: string;
}

interface ScrapedSet {
  title: string;
  artist: string;
  venue?: string;
  date?: string;
  url: string;
  tracks: ScrapedTrack[];
}

async function scrapeAllArtistSets(artistName: string, maxSets: number = 10): Promise<ScrapedSet[]> {
  console.error(`\n🎵 Scraping all sets for: ${artistName}\n`);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Search for the artist
    const searchQuery = encodeURIComponent(artistName);
    const searchUrl = `https://www.1001tracklists.com/search/result.php?search_selection=0&search_value=${searchQuery}`;
    
    console.error(`[Search] Navigating to: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Try to wait for content to load
    try {
      await page.waitForSelector('a[href*="/tracklist/"], .tlpItem, .tracklistItem', { timeout: 5000 });
    } catch (e) {
      console.error('[Warning] Content may not have loaded fully');
    }
    
    // Extract all tracklist URLs with multiple strategies
    const tracklistUrls = await page.evaluate(() => {
      const links: string[] = [];
      const seen = new Set<string>();
      
      // Strategy 1: Direct href matches
      const anchorElements = document.querySelectorAll('a[href*="/tracklist/"]');
      anchorElements.forEach((anchor) => {
        const href = anchor.getAttribute('href');
        if (href) {
          const cleanHref = href.startsWith('http') ? href : `https://www.1001tracklists.com${href}`;
          if (!seen.has(cleanHref)) {
            seen.add(cleanHref);
            links.push(href.startsWith('http') ? href : href);
          }
        }
      });
      
      // Strategy 2: Look in data attributes
      const dataElements = document.querySelectorAll('[data-url*="/tracklist/"], [data-href*="/tracklist/"]');
      dataElements.forEach((el) => {
        const url = el.getAttribute('data-url') || el.getAttribute('data-href');
        if (url && !seen.has(url)) {
          seen.add(url);
          links.push(url.startsWith('http') ? url : `https://www.1001tracklists.com${url}`);
        }
      });
      
      // Strategy 3: Check if we're on a DJ page - look for tracklist links in the page
      const allLinks = Array.from(document.querySelectorAll('a'));
      allLinks.forEach((link) => {
        const href = link.getAttribute('href');
        if (href && href.includes('/tracklist/') && !seen.has(href)) {
          seen.add(href);
          links.push(href.startsWith('http') ? href : `https://www.1001tracklists.com${href}`);
        }
      });
      
      return links;
    });
    
    // Debug: Check page content and try alternative extraction
    if (tracklistUrls.length === 0) {
      const pageContent = await page.content();
      const hasTracklist = pageContent.includes('tracklist') || pageContent.includes('tlp');
      console.error(`[Debug] Page loaded: ${pageContent.length} chars, contains 'tracklist': ${hasTracklist}`);
      
      // Try extracting from page source directly
      const regexUrls = pageContent.match(/\/tracklist\/[a-z0-9]+\/[^"'\s<>]+/gi);
      if (regexUrls) {
        const uniqueUrls = [...new Set(regexUrls)];
        tracklistUrls.push(...uniqueUrls.map(url => url.startsWith('http') ? url : `https://www.1001tracklists.com${url}`));
        console.error(`[Found] ${uniqueUrls.length} URLs via regex`);
      }
      
      // Try going to DJ page directly
      const djPageUrl = `https://www.1001tracklists.com/dj/${artistName.toLowerCase().replace(/\s+/g, '-')}/index.html`;
      console.error(`[Trying] DJ page: ${djPageUrl}`);
      try {
        await page.goto(djPageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const djPageUrls = await page.evaluate(() => {
          const links: string[] = [];
          const seen = new Set<string>();
          
          // Try multiple selectors
          const selectors = [
            'a[href*="/tracklist/"]',
            'a[href^="/tracklist/"]',
            '.tracklistLink',
            '[data-tracklist-url]',
          ];
          
          selectors.forEach(selector => {
            const anchors = document.querySelectorAll(selector);
            anchors.forEach((a) => {
              const href = a.getAttribute('href') || a.getAttribute('data-tracklist-url');
              if (href && href.includes('/tracklist/') && !seen.has(href)) {
                seen.add(href);
                links.push(href);
              }
            });
          });
          
          return links;
        });
        
        // Also try regex on DJ page
        const djPageContent = await page.content();
        const djRegexUrls = djPageContent.match(/\/tracklist\/[a-z0-9]+\/[^"'\s<>]+/gi);
        if (djRegexUrls) {
          djRegexUrls.forEach(url => {
            const fullUrl = url.startsWith('http') ? url : `https://www.1001tracklists.com${url}`;
            if (!tracklistUrls.includes(fullUrl) && !tracklistUrls.includes(url)) {
              tracklistUrls.push(url.startsWith('http') ? url : url);
            }
          });
        }
        
        if (djPageUrls.length > 0) {
          tracklistUrls.push(...djPageUrls);
          console.error(`[Found] ${djPageUrls.length} tracklist URLs from DJ page`);
        }
      } catch (e) {
        console.error(`[Error] Could not access DJ page: ${e instanceof Error ? e.message : 'Unknown'}`);
      }
    }
    
    console.error(`[Found] ${tracklistUrls.length} total tracklist URLs\n`);
    
    const allSets: ScrapedSet[] = [];
    const limit = Math.min(maxSets, tracklistUrls.length);
    
    for (let i = 0; i < limit; i++) {
      const relativeUrl = tracklistUrls[i];
      if (!relativeUrl) continue;
      
      const fullUrl = relativeUrl.startsWith('http') 
        ? relativeUrl 
        : `https://www.1001tracklists.com${relativeUrl}`;
      
      console.error(`[${i + 1}/${limit}] Scraping: ${fullUrl}`);
      
      try {
        await page.goto(fullUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Extract set data
        const setData = await page.evaluate((url) => {
          const data: ScrapedSet = {
            title: '',
            artist: '',
            url,
            tracks: [],
          };
          
          // Extract title
          const titleEl = document.querySelector('h1#pageTitle') || 
                         document.querySelector('h1') ||
                         document.querySelector('meta[property="og:title"]');
          if (titleEl) {
            data.title = (titleEl.textContent || titleEl.getAttribute('content') || '')
              .replace(/ \| 1001Tracklists$/i, '')
              .replace(/ \| 1001tracklists$/i, '')
              .trim();
          }
          
          // Extract artist/DJ
          const artistEl = document.querySelector('a.blueLinkColor[href*="/dj/"]') ||
                          document.querySelector('a.artistLink') ||
                          document.querySelector('meta[name="author"]');
          if (artistEl) {
            data.artist = (artistEl.textContent || artistEl.getAttribute('content') || '').trim();
          }
          
          // Extract venue from title
          if (data.title) {
            const venueMatch = data.title.match(/(?:@|at)\s+([^,\-–]+)/i) ||
                              data.title.match(/Boiler Room\s+([A-Z][a-z]+)/i);
            if (venueMatch) {
              data.venue = venueMatch[1].trim();
            }
          }
          
          // Extract date
          const dateMatch = document.body.textContent?.match(/(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            data.date = dateMatch[1];
          }
          
          // Extract tracks
          const trackItems = document.querySelectorAll('.tlpTog, .tlpItem');
          trackItems.forEach((item) => {
            const trackNameEl = item.querySelector('.trackValue, [itemprop="name"]');
            const artistEl = item.querySelector('a.blueLinkColor[href*="/artist/"], .artistValue, [itemprop="byArtist"] [itemprop="name"]');
            const timeEl = item.querySelector('.cueValueField');
            
            if (trackNameEl && artistEl) {
              const trackName = trackNameEl.textContent?.trim() || '';
              const artistName = artistEl.textContent?.trim() || '';
              const timestamp = timeEl?.textContent?.trim() || '0:00';
              
              if (trackName && artistName) {
                data.tracks.push({
                  title: trackName,
                  artist: artistName,
                  timestamp,
                });
              }
            }
          });
          
          // Fallback: Try JSON-LD
          if (data.tracks.length === 0) {
            const jsonLdScript = document.querySelector('script[type="application/ld+json"]');
            if (jsonLdScript) {
              try {
                const jsonLd = JSON.parse(jsonLdScript.textContent || '{}');
                if (jsonLd.track && Array.isArray(jsonLd.track)) {
                  jsonLd.track.forEach((t: { name?: string }) => {
                    if (t.name) {
                      const parts = t.name.split(' - ');
                      data.tracks.push({
                        title: parts.length > 1 ? parts.slice(1).join(' - ').trim() : t.name.trim(),
                        artist: parts[0]?.trim() || 'Unknown',
                        timestamp: '0:00',
                      });
                    }
                  });
                }
              } catch (e) {
                // JSON parse error
              }
            }
          }
          
          return data;
        }, fullUrl);
        
        if (setData.tracks.length > 0) {
          allSets.push(setData);
          console.error(`  ✓ Found ${setData.tracks.length} tracks in "${setData.title}"`);
        } else {
          console.error(`  ⚠ No tracks found`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        continue;
      }
    }
    
    return allSets;
  } finally {
    await browser.close();
  }
}

function setsToCSV(sets: ScrapedSet[]): string {
  const header = 'type,set_name,set_artist,set_venue,set_date,set_cover_url,set_source_url,track_title,track_artist,timestamp_seconds,duration_seconds,bpm,key,album,track_cover_url,track_source_url';
  const rows: string[] = [header];
  
  function escapeCSV(value: string): string {
    if (!value) return '';
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
  
  for (const set of sets) {
    // SET row
    rows.push([
      'SET',
      escapeCSV(set.title),
      escapeCSV(set.artist),
      escapeCSV(set.venue || ''),
      escapeCSV(set.date || ''),
      '', // cover_url
      escapeCSV(set.url),
      '', '', '', '', '', '', '', '', '' // empty track columns
    ].join(','));
    
    // TRACK rows
    for (const track of set.tracks) {
      // Convert timestamp to seconds
      let timestampSeconds = 0;
      if (track.timestamp) {
        const parts = track.timestamp.split(':').map(Number);
        if (parts.length === 3) {
          timestampSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
          timestampSeconds = parts[0] * 60 + parts[1];
        }
      }
      
      rows.push([
        'TRACK',
        '', '', '', '', '', '', // empty set columns
        escapeCSV(track.title),
        escapeCSV(track.artist),
        timestampSeconds.toString(),
        '', '', '', '', '', '' // empty optional columns
      ].join(','));
    }
  }
  
  return rows.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: bun run scripts/scrape-artist-all-sets.ts "Artist Name" [maxSets]');
    console.error('Example: bun run scripts/scrape-artist-all-sets.ts "Max Dean" 5');
    process.exit(1);
  }
  
  const artistName = args[0];
  const maxSets = args[1] ? parseInt(args[1], 10) : 10;
  
  if (isNaN(maxSets) || maxSets < 1) {
    console.error('Error: maxSets must be a positive number');
    process.exit(1);
  }
  
  const sets = await scrapeAllArtistSets(artistName, maxSets);
  
  if (sets.length === 0) {
    console.error(`\n❌ No sets found for "${artistName}"`);
    process.exit(1);
  }
  
  const totalTracks = sets.reduce((sum, s) => sum + s.tracks.length, 0);
  
  console.error(`\n✅ Successfully scraped ${sets.length} set(s) with ${totalTracks} total tracks\n`);
  
  // Display summary
  sets.forEach((set, i) => {
    console.error(`${i + 1}. "${set.title}" by ${set.artist}`);
    console.error(`   ${set.tracks.length} tracks${set.venue ? ` • ${set.venue}` : ''}${set.date ? ` • ${set.date}` : ''}`);
  });
  
  console.error('\n' + '─'.repeat(60));
  console.error('CSV output below (copy everything after this line):\n');
  console.error('---');
  
  // Output CSV
  console.log(setsToCSV(sets));
}

main().catch(console.error);
