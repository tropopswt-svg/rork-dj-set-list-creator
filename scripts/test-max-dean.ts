/**
 * Test scraping Max Dean set using direct URL approach
 */

// Let's try a direct approach - search for Max Dean tracklists manually
// or use a known URL pattern

async function findMaxDeanSet(): Promise<string | null> {
  // Try searching with different query formats
  const queries = [
    "Max Dean",
    "max+dean",
    "maxdean",
  ];
  
  for (const query of queries) {
    const searchUrl = `https://www.1001tracklists.com/search/result.php?search_selection=0&search_value=${encodeURIComponent(query)}`;
    
    console.error(`Trying search: ${searchUrl}`);
    
    try {
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
      });
      
      if (response.ok) {
        const html = await response.text();
        
        // Look for any tracklist reference
        const matches = [
          ...html.matchAll(/\/tracklist\/(\d+\/[^"\/\s<>]+)/gi),
          ...html.matchAll(/href="(\/tracklist\/[^"]+)"/gi),
          ...html.matchAll(/1001tracklists\.com\/tracklist\/([^"\s<>]+)/gi),
        ];
        
        if (matches.length > 0) {
          const firstMatch = matches[0];
          let url = firstMatch[1];
          if (!url.startsWith('http')) {
            if (!url.startsWith('/')) {
              url = `/tracklist/${url}`;
            }
            url = `https://www.1001tracklists.com${url}`;
          }
          console.error(`Found URL: ${url}`);
          return url;
        }
        
        // Check if we got redirected to a specific page
        const finalUrl = response.url;
        if (finalUrl.includes('/tracklist/')) {
          console.error(`Redirected to: ${finalUrl}`);
          return finalUrl;
        }
      }
    } catch (error) {
      console.error(`Error with query "${query}":`, error);
    }
  }
  
  return null;
}

// Alternative: Try to construct a known Max Dean URL or use DJ page
async function getMaxDeanFromDJPage(): Promise<string | null> {
  // Try accessing Max Dean's DJ page
  const djUrls = [
    'https://www.1001tracklists.com/dj/max-dean/index.html',
    'https://www.1001tracklists.com/dj/maxdean/index.html',
  ];
  
  for (const djUrl of djUrls) {
    try {
      const response = await fetch(djUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      
      if (response.ok) {
        const html = await response.text();
        const match = html.match(/\/tracklist\/(\d+\/[^"\/\s<>]+)/i);
        if (match) {
          const url = `https://www.1001tracklists.com/tracklist/${match[1]}`;
          console.error(`Found from DJ page: ${url}`);
          return url;
        }
      }
    } catch (error) {
      // Continue
    }
  }
  
  return null;
}

async function main() {
  console.error('Searching for Max Dean set...\n');
  
  // Try search first
  let url = await findMaxDeanSet();
  
  // If search fails, try DJ page
  if (!url) {
    console.error('Trying DJ page...');
    url = await getMaxDeanFromDJPage();
  }
  
  if (url) {
    console.error(`\n✅ Found set URL: ${url}`);
    console.error(`\nNow scraping the set...\n`);
    
    // Import and use the scrape function
    const { scrape1001Tracklist } = await import('./scrape-1001tracklists.ts');
    const set = await scrape1001Tracklist(url);
    
    if (set) {
      console.error(`\n✅ Successfully scraped!\n`);
      console.error(`📀 Set: "${set.title}"`);
      console.error(`🎤 Artist: ${set.artist}`);
      if (set.venue) console.error(`📍 Venue: ${set.venue}`);
      if (set.date) console.error(`📅 Date: ${set.date}`);
      console.error(`🎵 Tracks: ${set.tracks.length}\n`);
      
      console.error('Tracklist:');
      console.error('─'.repeat(70));
      set.tracks.slice(0, 20).forEach((track, index) => {
        console.error(`${String(index + 1).padStart(3, ' ')}. [${track.timestamp.padEnd(8, ' ')}] ${track.artist} - ${track.title}`);
      });
      if (set.tracks.length > 20) {
        console.error(`... and ${set.tracks.length - 20} more tracks`);
      }
      console.error('─'.repeat(70));
      
      console.log(JSON.stringify(set, null, 2));
    } else {
      console.error('❌ Failed to scrape set');
    }
  } else {
    console.error('❌ Could not find a Max Dean set URL');
    console.error('\nPlease provide a direct 1001tracklists URL, or try:');
    console.error('bun run scripts/scrape-1001tracklists.ts <url>');
  }
}

main();
