/**
 * Scrape all sets and tracks for an artist from 1001tracklists
 * 
 * Usage:
 *   bun run scripts/scrape-artist.ts "Artist Name"
 *   bun run scripts/scrape-artist.ts "Charlotte de Witte" --limit 10
 *   bun run scripts/scrape-artist.ts "Solomun" --output json
 * 
 * Options:
 *   --limit <n>     Limit number of sets to scrape (default: all)
 *   --output <fmt>  Output format: csv or json (default: csv)
 *   --delay <ms>    Delay between requests in ms (default: 1000)
 */

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
  sourceUrl?: string;
  thumbnail?: string;
  tracks: ScrapedTrack[];
  audioLinks: {
    youtube?: string;
    soundcloud?: string;
    mixcloud?: string;
  };
}

interface ArtistData {
  name: string;
  url: string;
  imageUrl?: string;
  sets: ScrapedSet[];
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function searchArtist(artistName: string): Promise<{ name: string; url: string; imageUrl?: string } | null> {
  console.error(`[Search] Searching for artist: ${artistName}`);
  
  try {
    const searchQuery = encodeURIComponent(artistName);
    const searchUrl = `https://www.1001tracklists.com/search/result.php?search_selection=6&search_value=${searchQuery}`;
    
    console.error(`[Search] URL: ${searchUrl}`);
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    
    if (!response.ok) {
      console.error(`[Search] Failed with status: ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    const djLinkPattern = /<a[^>]*href="(\/dj\/[^"]+\/index\.html)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*main[^"]*"[^>]*>([^<]+)<\/span>/gi;
    const simplePattern = /<a[^>]*href="(\/dj\/([^"]+)\/)"[^>]*>/gi;
    
    let match = djLinkPattern.exec(html);
    if (match) {
      const url = `https://www.1001tracklists.com${match[1].replace('/index.html', '/')}`;
      const name = match[2].trim();
      console.error(`[Search] Found artist: ${name} at ${url}`);
      return { name, url };
    }
    
    match = simplePattern.exec(html);
    if (match) {
      const url = `https://www.1001tracklists.com${match[1]}`;
      const name = match[2].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      console.error(`[Search] Found artist (simple): ${name} at ${url}`);
      return { name, url };
    }
    
    const directUrl = `https://www.1001tracklists.com/dj/${artistName.toLowerCase().replace(/\s+/g, '')}/index.html`;
    console.error(`[Search] Trying direct URL: ${directUrl}`);
    
    const directResponse = await fetch(directUrl, {
      headers: { 'User-Agent': USER_AGENT },
    });
    
    if (directResponse.ok) {
      console.error(`[Search] Direct URL worked!`);
      return { name: artistName, url: directUrl.replace('/index.html', '/') };
    }
    
    console.error(`[Search] No artist found for: ${artistName}`);
    return null;
  } catch (error) {
    console.error(`[Search] Error:`, error);
    return null;
  }
}

async function getArtistSetUrls(artistUrl: string, limit?: number): Promise<string[]> {
  console.error(`[Sets] Fetching set list from: ${artistUrl}`);
  
  const setUrls: string[] = [];
  
  try {
    const response = await fetch(artistUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    
    if (!response.ok) {
      console.error(`[Sets] Failed with status: ${response.status}`);
      return [];
    }
    
    const html = await response.text();
    
    const tracklistPattern = /href="(\/tracklist\/[^"]+)"/gi;
    const seen = new Set<string>();
    let match;
    
    while ((match = tracklistPattern.exec(html)) !== null) {
      const path = match[1];
      if (!seen.has(path)) {
        seen.add(path);
        setUrls.push(`https://www.1001tracklists.com${path}`);
        
        if (limit && setUrls.length >= limit) {
          break;
        }
      }
    }
    
    console.error(`[Sets] Found ${setUrls.length} set URLs`);
    
    if (setUrls.length === 0) {
      const pageListResponse = await fetch(`${artistUrl}index.html`, {
        headers: { 'User-Agent': USER_AGENT },
      });
      
      if (pageListResponse.ok) {
        const pageHtml = await pageListResponse.text();
        let pageMatch;
        while ((pageMatch = tracklistPattern.exec(pageHtml)) !== null) {
          const path = pageMatch[1];
          if (!seen.has(path)) {
            seen.add(path);
            setUrls.push(`https://www.1001tracklists.com${path}`);
            if (limit && setUrls.length >= limit) break;
          }
        }
        console.error(`[Sets] After index page: ${setUrls.length} set URLs`);
      }
    }
  } catch (error) {
    console.error(`[Sets] Error:`, error);
  }
  
  return setUrls;
}

function extractAudioLinks(html: string): ScrapedSet['audioLinks'] {
  const links: ScrapedSet['audioLinks'] = {};
  
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/i,
    /data-yt(?:video)?id=["']([a-zA-Z0-9_-]{11})["']/i,
  ];
  
  for (const pattern of youtubePatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      links.youtube = `https://www.youtube.com/watch?v=${match[1]}`;
      break;
    }
  }
  
  const soundcloudPatterns = [
    /href=["'](https?:\/\/soundcloud\.com\/[^"'\s]+)["']/i,
    /soundcloud\.com\/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)/i,
  ];
  
  for (const pattern of soundcloudPatterns) {
    const match = html.match(pattern);
    if (match) {
      const scUrl = match[1].startsWith('http') ? match[1] : `https://soundcloud.com/${match[1]}`;
      if (!scUrl.includes('/search') && !scUrl.includes('/explore')) {
        links.soundcloud = scUrl.split('?')[0];
        break;
      }
    }
  }
  
  const mixcloudPatterns = [
    /href=["'](https?:\/\/(?:www\.)?mixcloud\.com\/[^"'\s]+)["']/i,
    /mixcloud\.com\/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)/i,
  ];
  
  for (const pattern of mixcloudPatterns) {
    const match = html.match(pattern);
    if (match) {
      const mcUrl = match[1].startsWith('http') ? match[1] : `https://www.mixcloud.com/${match[1]}`;
      if (!mcUrl.includes('/search') && !mcUrl.includes('/explore')) {
        links.mixcloud = mcUrl.split('?')[0];
        break;
      }
    }
  }
  
  const iframePatterns = [
    /<iframe[^>]*src=["']([^"']*youtube[^"']*)["']/gi,
    /<iframe[^>]*src=["']([^"']*soundcloud[^"']*)["']/gi,
  ];
  
  for (const pattern of iframePatterns) {
    const match = pattern.exec(html);
    if (match && match[1]) {
      const src = match[1];
      if (src.includes('youtube') && !links.youtube) {
        const ytMatch = src.match(/embed\/([a-zA-Z0-9_-]{11})/);
        if (ytMatch) {
          links.youtube = `https://www.youtube.com/watch?v=${ytMatch[1]}`;
        }
      } else if (src.includes('soundcloud') && !links.soundcloud) {
        const scUrlMatch = src.match(/url=([^&]+)/);
        if (scUrlMatch) {
          links.soundcloud = decodeURIComponent(scUrlMatch[1]);
        }
      }
    }
  }
  
  return links;
}

async function scrapeSet(url: string): Promise<ScrapedSet | null> {
  console.error(`[Scrape] Scraping set: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    
    if (!response.ok) {
      console.error(`[Scrape] Failed with status: ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    const titleMatch = html.match(/<h1[^>]*id="pageTitle"[^>]*>([^<]+)<\/h1>/i) ||
                       html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i) ||
                       html.match(/<title>([^<]+)<\/title>/i);
    
    let setTitle = titleMatch ? titleMatch[1].replace(/ \| 1001Tracklists$/i, '').trim() : 'Unknown Set';
    
    const djPatterns = [
      /<a[^>]*class="[^"]*blue[^"]*"[^>]*href="\/dj\/[^"]*"[^>]*>([^<]+)<\/a>/i,
      /<meta[^>]*name="author"[^>]*content="([^"]+)"/i,
    ];
    
    let djName = '';
    for (const pattern of djPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        djName = match[1].trim();
        break;
      }
    }
    
    if (!djName && setTitle) {
      const parts = setTitle.split(/\s*[-–@]\s*/);
      if (parts.length >= 2) {
        djName = parts[0].trim();
      }
    }
    
    let venue = '';
    const venuePatterns = [
      /(?:@|at)\s+([^,\-–\n<]+)/i,
      /(?:live|set)\s+(?:at|@|from)\s+([^,\-–\n<]+)/i,
    ];
    for (const pattern of venuePatterns) {
      const match = setTitle.match(pattern);
      if (match) {
        venue = match[1].trim();
        break;
      }
    }
    
    const dateMatch = html.match(/<time[^>]*datetime="([^"]+)"[^>]*>/i) ||
                      html.match(/(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : '';
    
    const thumbnailMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    const thumbnail = thumbnailMatch ? thumbnailMatch[1] : undefined;
    
    const audioLinks = extractAudioLinks(html);
    
    const tracks: ScrapedTrack[] = [];
    
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        if (jsonLd.track && Array.isArray(jsonLd.track)) {
          for (const t of jsonLd.track) {
            if (t.name) {
              const parts = t.name.split(' - ');
              tracks.push({
                title: parts.length > 1 ? parts.slice(1).join(' - ').trim() : t.name,
                artist: parts[0]?.trim() || 'Unknown',
                timestamp: '0:00',
              });
            }
          }
        }
      } catch {
        // JSON parse error, continue with other methods
      }
    }
    
    if (tracks.length === 0) {
      const trackRowPattern = /<div[^>]*class="[^"]*tlpItem[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
      const rows = html.match(trackRowPattern) || [];
      
      for (const row of rows) {
        const trackNameMatch = row.match(/<span[^>]*class="[^"]*trackFormat[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
        const timeMatch = row.match(/<span[^>]*class="[^"]*cueValueField[^"]*"[^>]*>([^<]+)<\/span>/i);
        
        if (trackNameMatch) {
          const fullTrack = trackNameMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          const parts = fullTrack.split(' - ');
          
          if (parts.length >= 2) {
            tracks.push({
              title: parts.slice(1).join(' - ').trim(),
              artist: parts[0].trim(),
              timestamp: timeMatch ? timeMatch[1].trim() : '0:00',
            });
          }
        }
      }
    }
    
    console.error(`[Scrape] Found ${tracks.length} tracks, title: "${setTitle}", artist: "${djName}"`);
    console.error(`[Scrape] Audio links:`, Object.entries(audioLinks).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ') || 'none');
    
    return {
      title: setTitle,
      artist: djName || 'Unknown Artist',
      venue: venue || undefined,
      date: date || undefined,
      url,
      thumbnail,
      tracks,
      audioLinks,
    };
  } catch (error) {
    console.error(`[Scrape] Error:`, error);
    return null;
  }
}

function escapeCSV(value: string): string {
  if (!value) return '';
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCSV(artistData: ArtistData): string {
  const header = 'type,set_name,set_artist,set_venue,set_date,set_cover_url,set_source_url,set_youtube,set_soundcloud,set_mixcloud,track_title,track_artist,timestamp_seconds,tracklist_url';
  
  const rows: string[] = [header];
  
  for (const set of artistData.sets) {
    rows.push([
      'SET',
      escapeCSV(set.title),
      escapeCSV(set.artist),
      escapeCSV(set.venue || ''),
      escapeCSV(set.date || ''),
      escapeCSV(set.thumbnail || ''),
      escapeCSV(set.audioLinks.youtube || set.audioLinks.soundcloud || set.audioLinks.mixcloud || ''),
      escapeCSV(set.audioLinks.youtube || ''),
      escapeCSV(set.audioLinks.soundcloud || ''),
      escapeCSV(set.audioLinks.mixcloud || ''),
      '', '', '',
      escapeCSV(set.url),
    ].join(','));
    
    for (const track of set.tracks) {
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
        '', '', '', '', '', '', '', '', '',
        escapeCSV(track.title),
        escapeCSV(track.artist),
        timestampSeconds.toString(),
        '',
      ].join(','));
    }
  }
  
  return rows.join('\n');
}

function toJSON(artistData: ArtistData): string {
  return JSON.stringify(artistData, null, 2);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.error(`
Scrape all sets and tracks for an artist from 1001tracklists

Usage:
  bun run scripts/scrape-artist.ts "Artist Name" [options]

Options:
  --limit <n>     Limit number of sets to scrape (default: all)
  --output <fmt>  Output format: csv or json (default: csv)
  --delay <ms>    Delay between requests in ms (default: 1000)
  --help, -h      Show this help message

Examples:
  bun run scripts/scrape-artist.ts "Charlotte de Witte"
  bun run scripts/scrape-artist.ts "Solomun" --limit 5
  bun run scripts/scrape-artist.ts "Tale Of Us" --output json
  bun run scripts/scrape-artist.ts "Dixon" --limit 10 --delay 2000
`);
    process.exit(0);
  }
  
  const artistName = args[0];
  let limit: number | undefined;
  let outputFormat = 'csv';
  let delayMs = 1000;
  
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      outputFormat = args[i + 1].toLowerCase();
      i++;
    } else if (args[i] === '--delay' && args[i + 1]) {
      delayMs = parseInt(args[i + 1], 10);
      i++;
    }
  }
  
  console.error(`\n========================================`);
  console.error(`Artist Scraper for 1001tracklists`);
  console.error(`========================================`);
  console.error(`Artist: ${artistName}`);
  console.error(`Limit: ${limit || 'none'}`);
  console.error(`Output: ${outputFormat}`);
  console.error(`Delay: ${delayMs}ms`);
  console.error(`========================================\n`);
  
  const artist = await searchArtist(artistName);
  
  if (!artist) {
    console.error(`\n❌ Could not find artist: ${artistName}`);
    console.error(`Try using the exact name as it appears on 1001tracklists.com`);
    process.exit(1);
  }
  
  console.error(`\n✓ Found artist: ${artist.name}`);
  console.error(`  URL: ${artist.url}\n`);
  
  await delay(delayMs);
  
  const setUrls = await getArtistSetUrls(artist.url, limit);
  
  if (setUrls.length === 0) {
    console.error(`\n❌ No sets found for artist: ${artist.name}`);
    process.exit(1);
  }
  
  console.error(`\n✓ Found ${setUrls.length} sets to scrape\n`);
  
  const artistData: ArtistData = {
    name: artist.name,
    url: artist.url,
    imageUrl: artist.imageUrl,
    sets: [],
  };
  
  let successCount = 0;
  let trackCount = 0;
  
  for (let i = 0; i < setUrls.length; i++) {
    const url = setUrls[i];
    console.error(`[${i + 1}/${setUrls.length}] Scraping: ${url}`);
    
    const set = await scrapeSet(url);
    
    if (set) {
      artistData.sets.push(set);
      successCount++;
      trackCount += set.tracks.length;
    }
    
    if (i < setUrls.length - 1) {
      await delay(delayMs);
    }
  }
  
  console.error(`\n========================================`);
  console.error(`Scraping Complete!`);
  console.error(`========================================`);
  console.error(`Artist: ${artist.name}`);
  console.error(`Sets scraped: ${successCount}/${setUrls.length}`);
  console.error(`Total tracks: ${trackCount}`);
  console.error(`Sets with YouTube: ${artistData.sets.filter(s => s.audioLinks.youtube).length}`);
  console.error(`Sets with SoundCloud: ${artistData.sets.filter(s => s.audioLinks.soundcloud).length}`);
  console.error(`Sets with Mixcloud: ${artistData.sets.filter(s => s.audioLinks.mixcloud).length}`);
  console.error(`========================================\n`);
  
  if (outputFormat === 'json') {
    console.log(toJSON(artistData));
  } else {
    console.log(toCSV(artistData));
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
