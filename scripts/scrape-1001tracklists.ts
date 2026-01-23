/**
 * Scrape 1001tracklists URLs and output CSV for bulk import
 * 
 * Usage:
 *   bun run scripts/scrape-1001tracklists.ts <url1> <url2> ...
 * 
 * Example:
 *   bun run scripts/scrape-1001tracklists.ts https://www.1001tracklists.com/tracklist/abc123 https://www.1001tracklists.com/tracklist/xyz456
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
  tracks: ScrapedTrack[];
}

async function scrape1001Tracklist(url: string): Promise<ScrapedSet | null> {
  console.error(`[Scraping] ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    
    if (!response.ok) {
      console.error(`[Error] Failed to fetch ${url}: ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // Extract set title
    const titleMatch = html.match(/<h1[^>]*id="pageTitle"[^>]*>([^<]+)<\/h1>/i) ||
                       html.match(/<title>([^<]+)<\/title>/i) ||
                       html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    
    let setTitle = titleMatch ? titleMatch[1].replace(/ \| 1001Tracklists$/i, '').trim() : 'Unknown Set';
    
    // Extract DJ/artist
    const djMatch = html.match(/<a[^>]*class="[^"]*blueLinkColor[^"]*"[^>]*href="\/dj\/[^"]*"[^>]*>([^<]+)<\/a>/i) ||
                    html.match(/<meta[^>]*name="author"[^>]*content="([^"]+)"/i);
    
    let djName = djMatch ? djMatch[1].trim() : '';
    
    // Try to extract artist from title if not found
    if (!djName && setTitle) {
      const parts = setTitle.split(/\s*[-–@]\s*/);
      if (parts.length >= 2) {
        djName = parts[0].trim();
      }
    }
    
    // Extract venue from title
    let venue = '';
    const venuePatterns = [
      /(?:@|at)\s+([^,\-–]+)/i,
      /(?:live|set)\s+(?:at|@|from)\s+([^,\-–]+)/i,
      /Boiler Room\s+([A-Z][a-z]+)/i,
    ];
    for (const pattern of venuePatterns) {
      const match = setTitle.match(pattern);
      if (match) {
        venue = match[1].trim();
        break;
      }
    }
    
    // Extract date
    const dateMatch = html.match(/<td[^>]*class="[^"]*leftInfo[^"]*"[^>]*>.*?(\d{4}-\d{2}-\d{2}).*?<\/td>/is) ||
                      html.match(/(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : '';
    
    // Extract tracks
    const tracks: ScrapedTrack[] = [];
    
    // Method 1: Look for track items in the tracklist
    const trackItemPattern = /<div[^>]*class="[^"]*tlpTog[^"]*"[^>]*id="tlp_(\d+)"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi;
    const trackMatches = html.matchAll(trackItemPattern);
    
    for (const match of trackMatches) {
      const trackHtml = match[0];
      
      // Extract track name - look for the track value span
      const trackNameMatch = trackHtml.match(/<span[^>]*class="[^"]*trackValue[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                             trackHtml.match(/<meta[^>]*itemprop="name"[^>]*content="([^"]+)"/i);
      
      // Extract artist
      const artistMatch = trackHtml.match(/<a[^>]*class="[^"]*blueLinkColor[^"]*"[^>]*>([^<]+)<\/a>/i);
      
      // Extract timestamp
      const timeMatch = trackHtml.match(/<span[^>]*class="[^"]*cueValueField[^"]*"[^>]*>([^<]+)<\/span>/i);
      
      if (trackNameMatch || artistMatch) {
        const trackName = trackNameMatch ? trackNameMatch[1].trim() : '';
        const artistName = artistMatch ? artistMatch[1].trim() : '';
        const timestamp = timeMatch ? timeMatch[1].trim() : '0:00';
        
        if (trackName && artistName) {
          tracks.push({
            title: trackName,
            artist: artistName,
            timestamp,
          });
        }
      }
    }
    
    // Method 2: Try JSON-LD structured data if no tracks found
    if (tracks.length === 0) {
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
        } catch (e) {
          // JSON parse error, continue
        }
      }
    }
    
    // Method 3: Look for simpler track format
    if (tracks.length === 0) {
      const simpleTrackPattern = /<span[^>]*itemprop="name"[^>]*>([^<]+)<\/span>[\s\S]*?<span[^>]*itemprop="byArtist"[^>]*>[\s\S]*?<span[^>]*itemprop="name"[^>]*>([^<]+)<\/span>/gi;
      let simpleMatch;
      while ((simpleMatch = simpleTrackPattern.exec(html)) !== null) {
        tracks.push({
          title: simpleMatch[1].trim(),
          artist: simpleMatch[2].trim(),
          timestamp: '0:00',
        });
      }
    }
    
    console.error(`[Found] ${tracks.length} tracks in "${setTitle}" by ${djName || 'Unknown'}`);
    
    return {
      title: setTitle,
      artist: djName || 'Unknown Artist',
      venue: venue || undefined,
      date: date || undefined,
      url,
      tracks,
    };
  } catch (error) {
    console.error(`[Error] Failed to scrape ${url}:`, error);
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

function setsToCSV(sets: ScrapedSet[]): string {
  const header = 'type,set_name,set_artist,set_venue,set_date,set_cover_url,set_source_url,track_title,track_artist,timestamp_seconds,duration_seconds,bpm,key,album,track_cover_url,track_source_url';
  
  const rows: string[] = [header];
  
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
    console.error('Usage: bun run scripts/scrape-1001tracklists.ts <url1> [url2] ...');
    console.error('Example: bun run scripts/scrape-1001tracklists.ts https://www.1001tracklists.com/tracklist/abc123');
    process.exit(1);
  }
  
  const urls = args.filter(arg => arg.includes('1001tracklists.com'));
  
  if (urls.length === 0) {
    console.error('No valid 1001tracklists URLs provided');
    process.exit(1);
  }
  
  console.error(`\nScraping ${urls.length} URL(s)...\n`);
  
  const sets: ScrapedSet[] = [];
  
  for (const url of urls) {
    const set = await scrape1001Tracklist(url);
    if (set) {
      sets.push(set);
    }
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  if (sets.length === 0) {
    console.error('\nNo sets were successfully scraped');
    process.exit(1);
  }
  
  console.error(`\n✓ Scraped ${sets.length} set(s) with ${sets.reduce((sum, s) => sum + s.tracks.length, 0)} total tracks\n`);
  console.error('CSV output below (copy everything after this line):\n');
  console.error('---');
  
  // Output CSV to stdout
  console.log(setsToCSV(sets));
}

main();
