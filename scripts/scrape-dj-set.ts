/**
 * Scrape a DJ set from 1001tracklists by searching for the DJ
 * 
 * Usage:
 *   bun run scripts/scrape-dj-set.ts "DJ Name"
 * 
 * Example:
 *   bun run scripts/scrape-dj-set.ts "Dixon"
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

async function search1001Tracklists(djName: string): Promise<string | null> {
  console.error(`[Search] Looking for sets by: ${djName}`);
  
  try {
    const searchQuery = encodeURIComponent(djName);
    const searchUrl = `https://www.1001tracklists.com/search/result.php?search_selection=0&search_value=${searchQuery}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    
    if (response.ok) {
      const html = await response.text();
      
      // Try multiple patterns to find tracklist links
      // Pattern 1: Direct href links
      const directLinkMatch = html.match(/href="(\/tracklist\/[^"]+)"/i);
      if (directLinkMatch) {
        const tracklistUrl = `https://www.1001tracklists.com${directLinkMatch[1]}`;
        console.error(`[Found] ${tracklistUrl}`);
        return tracklistUrl;
      }
      
      // Pattern 2: Links in anchor tags
      const anchorMatch = html.match(/<a[^>]*href="(\/tracklist\/[^"]+)"[^>]*>/i);
      if (anchorMatch) {
        const tracklistUrl = `https://www.1001tracklists.com${anchorMatch[1]}`;
        console.error(`[Found] ${tracklistUrl}`);
        return tracklistUrl;
      }
      
      // Pattern 3: Tracklist ID pattern (e.g., /tracklist/123456/artist-name-set-name/index.html)
      const idPattern = html.match(/\/tracklist\/(\d+\/[^"\/\s<>]+)/i);
      if (idPattern) {
        const tracklistUrl = `https://www.1001tracklists.com/tracklist/${idPattern[1]}`;
        console.error(`[Found] ${tracklistUrl}`);
        return tracklistUrl;
      }
      
      // Pattern 4: Full URL in the page
      const fullUrlMatch = html.match(/https?:\/\/www\.1001tracklists\.com\/tracklist\/([^"\s<>]+)/i);
      if (fullUrlMatch) {
        const tracklistUrl = `https://www.1001tracklists.com/tracklist/${fullUrlMatch[1]}`;
        console.error(`[Found] ${tracklistUrl}`);
        return tracklistUrl;
      }
      
      // Pattern 5: Look for tracklist in data attributes or JSON
      const jsonMatch = html.match(/"url":"([^"]*\/tracklist\/[^"]+)"/i);
      if (jsonMatch) {
        let url = jsonMatch[1];
        if (!url.startsWith('http')) {
          url = `https://www.1001tracklists.com${url}`;
        }
        console.error(`[Found] ${url}`);
        return url;
      }
      
      // Debug: Save a snippet to see what we're working with
      const snippet = html.substring(0, 2000);
      console.error(`[Debug] First 2000 chars of HTML:`, snippet);
      console.error(`[Debug] HTML length: ${html.length}`);
    }
  } catch (error) {
    console.error(`[Error] Search failed:`, error);
  }
  
  return null;
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
      
      // Extract track name
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

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: bun run scripts/scrape-dj-set.ts "DJ Name"');
    console.error('Example: bun run scripts/scrape-dj-set.ts "Dixon"');
    process.exit(1);
  }
  
  const djName = args.join(' ');
  console.error(`\n🎵 Searching for sets by: ${djName}\n`);
  
  // Search for the DJ
  const tracklistUrl = await search1001Tracklists(djName);
  
  if (!tracklistUrl) {
    console.error(`\n❌ No sets found for "${djName}"`);
    process.exit(1);
  }
  
  // Scrape the set
  const set = await scrape1001Tracklist(tracklistUrl);
  
  if (!set) {
    console.error(`\n❌ Failed to scrape set from ${tracklistUrl}`);
    process.exit(1);
  }
  
  // Display results
  console.error(`\n✅ Successfully scraped set!\n`);
  console.error(`📀 Set: "${set.title}"`);
  console.error(`🎤 Artist: ${set.artist}`);
  if (set.venue) console.error(`📍 Venue: ${set.venue}`);
  if (set.date) console.error(`📅 Date: ${set.date}`);
  console.error(`🎵 Tracks: ${set.tracks.length}`);
  console.error(`🔗 URL: ${set.url}\n`);
  
  console.error('Tracklist:');
  console.error('─'.repeat(60));
  set.tracks.forEach((track, index) => {
    console.error(`${String(index + 1).padStart(3, ' ')}. [${track.timestamp.padEnd(8, ' ')}] ${track.artist} - ${track.title}`);
  });
  console.error('─'.repeat(60));
  console.error(`\nTotal: ${set.tracks.length} tracks\n`);
  
  // Output JSON for easy copying
  console.log(JSON.stringify(set, null, 2));
}

main();
