/**
 * Test the improved scraper function
 */

const url = "https://www.1001tracklists.com/tracklist/14wrxfdt/max-dean-luke-dean-joss-dean-radio-1s-essential-mix-2025-12-20.html";

async function testScraper() {
  console.error(`Testing scraper with: ${url}\n`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    
    if (response.ok) {
      const html = await response.text();
      console.error(`HTML length: ${html.length}\n`);
      
      // Extract set title
      const titleMatch = html.match(/<h1[^>]*id="pageTitle"[^>]*>([^<]+)<\/h1>/i) ||
                         html.match(/<title>([^<]+)<\/title>/i) ||
                         html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
      
      let setTitle = titleMatch ? titleMatch[1].replace(/ \| 1001Tracklists$/i, '').replace(/ \| 1001tracklists$/i, '').trim() : 'Unknown Set';
      console.error(`Set Title: ${setTitle}\n`);
      
      // Extract DJ/artist
      const djMatch = html.match(/<a[^>]*class="[^"]*blueLinkColor[^"]*"[^>]*href="\/dj\/[^"]*"[^>]*>([^<]+)<\/a>/i) ||
                      html.match(/<meta[^>]*name="author"[^>]*content="([^"]+)"/i) ||
                      html.match(/<a[^>]*class="[^"]*artistLink[^"]*"[^>]*>([^<]+)<\/a>/i);
      
      let djName = djMatch ? djMatch[1].trim() : '';
      console.error(`DJ Name: ${djName || 'Not found'}\n`);
      
      // Try to find tracks using the improved method
      const tracks: Array<{title: string; artist: string; timestamp: string}> = [];
      
      // Method 1: tlpTog pattern
      const trackItemPattern = /<div[^>]*class="[^"]*tlpTog[^"]*"[^>]*id="tlp_(\d+)"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi;
      const trackMatches = Array.from(html.matchAll(trackItemPattern));
      console.error(`Found ${trackMatches.length} track items with tlpTog pattern\n`);
      
      for (const match of trackMatches) {
        const trackHtml = match[0];
        
        const trackNameMatch = trackHtml.match(/<span[^>]*class="[^"]*trackValue[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                                trackHtml.match(/<meta[^>]*itemprop="name"[^>]*content="([^"]+)"/i) ||
                                trackHtml.match(/<span[^>]*itemprop="name"[^>]*>([^<]+)<\/span>/i);
        
        const artistMatch = trackHtml.match(/<a[^>]*class="[^"]*blueLinkColor[^"]*"[^>]*href="\/artist\/[^"]*"[^>]*>([^<]+)<\/a>/i) ||
                           trackHtml.match(/<span[^>]*class="[^"]*artistValue[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                           trackHtml.match(/<span[^>]*itemprop="byArtist"[^>]*>[\s\S]*?<span[^>]*itemprop="name"[^>]*>([^<]+)<\/span>/i);
        
        const timeMatch = trackHtml.match(/<span[^>]*class="[^"]*cueValueField[^"]*"[^>]*>([^<]+)<\/span>/i);
        
        if (trackNameMatch && artistMatch) {
          const trackName = trackNameMatch[1].replace(/<[^>]+>/g, '').trim();
          const artistName = artistMatch[1].replace(/<[^>]+>/g, '').trim();
          const timestamp = timeMatch ? timeMatch[1].trim() : '0:00';
          
          tracks.push({ title: trackName, artist: artistName, timestamp });
        }
      }
      
      // Method 2: Try other patterns
      if (tracks.length === 0) {
        console.error('Trying alternative patterns...\n');
        
        // Try tlpItem pattern
        const tlpItemPattern = /<div[^>]*class="[^"]*tlpItem[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
        const items = Array.from(html.matchAll(tlpItemPattern));
        console.error(`Found ${items.length} tlpItem divs\n`);
        
        // Try finding track names and artists separately
        const allTrackValues = html.matchAll(/<span[^>]*class="[^"]*trackValue[^"]*"[^>]*>([^<]+)<\/span>/gi);
        const allArtistValues = html.matchAll(/<span[^>]*class="[^"]*artistValue[^"]*"[^>]*>([^<]+)<\/span>/gi);
        const allTimeValues = html.matchAll(/<span[^>]*class="[^"]*cueValueField[^"]*"[^>]*>([^<]+)<\/span>/gi);
        
        const trackValues = Array.from(allTrackValues).map(m => m[1].trim());
        const artistValues = Array.from(allArtistValues).map(m => m[1].trim());
        const timeValues = Array.from(allTimeValues).map(m => m[1].trim());
        
        console.error(`Found ${trackValues.length} track values, ${artistValues.length} artist values, ${timeValues.length} time values\n`);
        
        for (let i = 0; i < Math.min(trackValues.length, artistValues.length); i++) {
          tracks.push({
            title: trackValues[i],
            artist: artistValues[i],
            timestamp: timeValues[i] || '0:00',
          });
        }
      }
      
      console.error(`\n✅ Extracted ${tracks.length} tracks\n`);
      
      if (tracks.length > 0) {
        console.error('First 10 tracks:');
        tracks.slice(0, 10).forEach((track, i) => {
          console.error(`${i + 1}. [${track.timestamp}] ${track.artist} - ${track.title}`);
        });
        
        console.log(JSON.stringify({
          title: setTitle,
          artist: djName || 'Unknown',
          url,
          tracks,
        }, null, 2));
      } else {
        console.error('❌ No tracks found. HTML structure might be different.');
        // Save a sample of the HTML for debugging
        const sample = html.substring(html.indexOf('tlp'), html.indexOf('tlp') + 5000);
        console.error('\nSample HTML around "tlp":');
        console.error(sample);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testScraper();
