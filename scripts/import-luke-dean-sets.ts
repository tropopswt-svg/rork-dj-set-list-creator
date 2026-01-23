/**
 * Script to scrape all Luke Dean sets and add them to the app library
 * 
 * Usage:
 *   bun run scripts/import-luke-dean-sets.ts
 */

import { SetList, Track } from '../types';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function searchArtist(artistName: string): Promise<{ name: string; url: string } | null> {
  try {
    const searchQuery = encodeURIComponent(artistName);
    const searchUrl = `https://www.1001tracklists.com/search/result.php?search_selection=6&search_value=${searchQuery}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    const djLinkPattern = /<a[^>]*href="(\/dj\/[^"]+\/index\.html)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*main[^"]*"[^>]*>([^<]+)<\/span>/gi;
    const simplePattern = /<a[^>]*href="(\/dj\/([^"]+)\/)"[^>]*>/gi;
    
    let match = djLinkPattern.exec(html);
    if (match) {
      const url = `https://www.1001tracklists.com${match[1].replace('/index.html', '/')}`;
      const name = match[2].trim();
      return { name, url };
    }
    
    match = simplePattern.exec(html);
    if (match) {
      const url = `https://www.1001tracklists.com${match[1]}`;
      const name = match[2].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return { name, url };
    }
    
    // Try direct URL
    const directUrl = `https://www.1001tracklists.com/dj/${artistName.toLowerCase().replace(/\s+/g, '')}/index.html`;
    const directResponse = await fetch(directUrl, {
      headers: { 'User-Agent': USER_AGENT },
    });
    
    if (directResponse.ok) {
      return { name: artistName, url: directUrl.replace('/index.html', '/') };
    }
    
    return null;
  } catch (error) {
    console.error('[Import] Error searching artist:', error);
    return null;
  }
}

async function getArtistSetUrls(artistUrl: string, limit?: number): Promise<string[]> {
  const setUrls: string[] = [];
  
  try {
    const response = await fetch(artistUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    
    if (!response.ok) return [];
    
    const html = await response.text();
    const tracklistPattern = /href="(\/tracklist\/[^"]+)"/gi;
    const seen = new Set<string>();
    let match;
    
    while ((match = tracklistPattern.exec(html)) !== null) {
      const path = match[1];
      if (!seen.has(path)) {
        seen.add(path);
        setUrls.push(`https://www.1001tracklists.com${path}`);
        if (limit && setUrls.length >= limit) break;
      }
    }
    
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
      }
    }
  } catch (error) {
    console.error('[Import] Error getting set URLs:', error);
  }
  
  return setUrls;
}

async function scrapeSet(url: string): Promise<{
  title: string;
  artist: string;
  venue?: string;
  date?: string;
  url: string;
  thumbnail?: string;
  tracks: Array<{ title: string; artist: string; timestamp: string }>;
  audioLinks: { youtube?: string; soundcloud?: string; mixcloud?: string };
} | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    
    if (!response.ok) return null;
    
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
    
    // Extract audio links
    const audioLinks: { youtube?: string; soundcloud?: string; mixcloud?: string } = {};
    
    const youtubePatterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/i,
      /data-yt(?:video)?id=["']([a-zA-Z0-9_-]{11})["']/i,
    ];
    
    for (const pattern of youtubePatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        audioLinks.youtube = `https://www.youtube.com/watch?v=${match[1]}`;
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
          audioLinks.soundcloud = scUrl.split('?')[0];
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
          audioLinks.mixcloud = mcUrl.split('?')[0];
          break;
        }
      }
    }
    
    // Extract tracks
    const tracks: Array<{ title: string; artist: string; timestamp: string }> = [];
    
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
    console.error(`[Import] Error scraping set:`, error);
    return null;
  }
}

function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

async function main() {
  const artistName = 'Luke Dean';
  
  console.log(`\n========================================`);
  console.log(`Importing all sets for: ${artistName}`);
  console.log(`========================================\n`);
  
  // Step 1: Find artist
  const artist = await searchArtist(artistName);
  if (!artist) {
    console.error(`❌ Could not find artist: ${artistName}`);
    process.exit(1);
  }
  
  console.log(`✓ Found artist: ${artist.name}`);
  console.log(`  URL: ${artist.url}\n`);
  
  await delay(1000);
  
  // Step 2: Get all set URLs
  const setUrls = await getArtistSetUrls(artist.url);
  if (setUrls.length === 0) {
    console.error(`❌ No sets found for artist: ${artist.name}`);
    process.exit(1);
  }
  
  console.log(`✓ Found ${setUrls.length} sets to scrape\n`);
  
  // Step 3: Scrape each set
  const allSets: SetList[] = [];
  let successCount = 0;
  let totalTracks = 0;
  
  for (let i = 0; i < setUrls.length; i++) {
    const url = setUrls[i];
    console.log(`[${i + 1}/${setUrls.length}] Scraping: ${url}`);
    
    const scrapedSet = await scrapeSet(url);
    
    if (scrapedSet && scrapedSet.tracks.length > 0) {
      const sourceLinks: SetList['sourceLinks'] = [];
      
      // Add 1001tracklists URL
      if (scrapedSet.url) {
        sourceLinks.push({ platform: '1001tracklists', url: scrapedSet.url });
      }
      
      // Add audio links
      if (scrapedSet.audioLinks.youtube) {
        sourceLinks.push({ platform: 'youtube', url: scrapedSet.audioLinks.youtube });
      }
      if (scrapedSet.audioLinks.soundcloud) {
        sourceLinks.push({ platform: 'soundcloud', url: scrapedSet.audioLinks.soundcloud });
      }
      if (scrapedSet.audioLinks.mixcloud) {
        sourceLinks.push({ platform: 'mixcloud', url: scrapedSet.audioLinks.mixcloud });
      }
      
      // If no links, add placeholder
      if (sourceLinks.length === 0) {
        sourceLinks.push({ platform: '1001tracklists', url: scrapedSet.url || 'https://www.1001tracklists.com' });
      }
      
      const tracks: Track[] = scrapedSet.tracks.map((t, index) => ({
        id: `luke-dean-${Date.now()}-${i}-${index}`,
        title: t.title,
        artist: t.artist,
        timestamp: parseTimestamp(t.timestamp),
        duration: 0,
        coverUrl: scrapedSet.thumbnail || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
        addedAt: new Date(),
        source: 'link' as const,
        verified: false,
      }));
      
      const newSet: SetList = {
        id: `luke-dean-${Date.now()}-${i}`,
        name: scrapedSet.title,
        artist: scrapedSet.artist,
        venue: scrapedSet.venue,
        date: scrapedSet.date ? new Date(scrapedSet.date) : new Date(),
        tracks,
        coverUrl: scrapedSet.thumbnail,
        sourceLinks,
        totalDuration: 0,
        aiProcessed: false,
        commentsScraped: 0,
        tracksIdentified: tracks.length,
        plays: 0,
      };
      
      allSets.push(newSet);
      successCount++;
      totalTracks += tracks.length;
      
      console.log(`  ✓ Extracted ${tracks.length} tracks`);
    }
    
    // Delay between requests
    if (i < setUrls.length - 1) {
      await delay(1000);
    }
  }
  
  console.log(`\n========================================`);
  console.log(`Import Complete!`);
  console.log(`========================================`);
  console.log(`Artist: ${artist.name}`);
  console.log(`Sets scraped: ${successCount}/${setUrls.length}`);
  console.log(`Total tracks: ${totalTracks}`);
  console.log(`========================================\n`);
  
  // Output as JSON for import
  console.log('\n--- Sets JSON (copy this to add to mocks) ---\n');
  console.log(JSON.stringify(allSets, null, 2));
  
  // Also save to file
  const fs = await import('fs');
  const path = await import('path');
  const outputPath = path.join(process.cwd(), 'scripts', 'luke-dean-sets.json');
  fs.writeFileSync(outputPath, JSON.stringify(allSets, null, 2));
  console.log(`\n✓ Saved to: ${outputPath}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
