/**
 * Script to scrape all Luke Dean sets and add them directly to the app library (mocks)
 * 
 * Usage:
 *   bun run scripts/add-luke-dean-to-library.ts
 */

import { SetList, Track } from '../types';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Import the backend scraper function directly
async function scrapeAllArtistSets(artistName: string, maxSets: number = 50) {
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
      
      const directUrl = `https://www.1001tracklists.com/dj/${artistName.toLowerCase().replace(/\s+/g, '')}/index.html`;
      const directResponse = await fetch(directUrl, {
        headers: { 'User-Agent': USER_AGENT },
      });
      
      if (directResponse.ok) {
        return { name: artistName, url: directUrl.replace('/index.html', '/') };
      }
      
      return null;
    } catch (error) {
      console.error('[Scraper] Error searching artist:', error);
      return null;
    }
  }
  
  async function getArtistSetUrls(artistUrl: string, limit?: number): Promise<string[]> {
    const setUrls: string[] = [];
    
    try {
      // Try multiple page variations
      const urlsToTry = [
        artistUrl,
        `${artistUrl}index.html`,
        `${artistUrl}tracklists/`,
      ];
      
      for (const urlToTry of urlsToTry) {
        const response = await fetch(urlToTry, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        
        if (response.ok) {
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
          
          if (setUrls.length > 0) break;
        }
      }
    } catch (error) {
      console.error('[Scraper] Error getting set URLs:', error);
    }
    
    return setUrls;
  }
  
  async function fetch1001TracklistDirect(url: string): Promise<{
    tracks: Array<{ title: string; artist: string; timestamp: string }>;
    title?: string;
    artist?: string;
    venue?: string;
    date?: string;
    thumbnail?: string;
    duration?: string;
    links: { youtube?: string; soundcloud?: string; mixcloud?: string };
  }> {
    const result: any = {
      tracks: [],
      links: {},
    };
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      
      if (response.ok) {
        const html = await response.text();
        
        // Extract title
        const titleMatch = html.match(/<h1[^>]*id="pageTitle"[^>]*>([^<]+)<\/h1>/i) ||
                           html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i) ||
                           html.match(/<title>([^<]+)<\/title>/i);
        
        if (titleMatch) {
          result.title = titleMatch[1]
            .replace(/ \| 1001Tracklists$/i, '')
            .replace(/ Tracklist$/i, '')
            .trim();
        }
        
        // Extract artist
        const djPatterns = [
          /<a[^>]*class="[^"]*blue[^"]*"[^>]*href="\/dj\/[^"]*"[^>]*>([^<]+)<\/a>/i,
          /<meta[^>]*name="author"[^>]*content="([^"]+)"/i,
        ];
        
        for (const pattern of djPatterns) {
          const match = html.match(pattern);
          if (match && match[1]) {
            result.artist = match[1].trim();
            break;
          }
        }
        
        // Extract tracks
        const trackRowPattern = /<div[^>]*class="[^"]*tlpItem[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
        const rows = html.match(trackRowPattern) || [];
        
        for (const row of rows) {
          const trackNameMatch = row.match(/<span[^>]*class="[^"]*trackFormat[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
          const timeMatch = row.match(/<span[^>]*class="[^"]*cueValueField[^"]*"[^>]*>([^<]+)<\/span>/i);
          
          if (trackNameMatch) {
            const fullTrack = trackNameMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            const parts = fullTrack.split(' - ');
            
            if (parts.length >= 2) {
              result.tracks.push({
                title: parts.slice(1).join(' - ').trim(),
                artist: parts[0].trim(),
                timestamp: timeMatch ? timeMatch[1].trim() : '0:00',
              });
            }
          }
        }
        
        // Try JSON-LD if no tracks
        if (result.tracks.length === 0) {
          const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
          if (jsonLdMatch) {
            try {
              const jsonLd = JSON.parse(jsonLdMatch[1]);
              if (jsonLd.track && Array.isArray(jsonLd.track)) {
                for (const t of jsonLd.track) {
                  if (t.name) {
                    const parts = t.name.split(' - ');
                    result.tracks.push({
                      title: parts.length > 1 ? parts.slice(1).join(' - ') : t.name,
                      artist: parts[0] || 'Unknown',
                      timestamp: '0:00',
                    });
                  }
                }
              }
            } catch (e) {
              // JSON parse error
            }
          }
        }
      }
    } catch (error) {
      console.error('[Scraper] Error fetching tracklist:', error);
    }
    
    return result;
  }
  
  // Main scraping logic
  const artist = await searchArtist(artistName);
  if (!artist) {
    throw new Error(`Could not find artist: ${artistName}`);
  }
  
  console.log(`✓ Found artist: ${artist.name}`);
  await delay(1000);
  
  const setUrls = await getArtistSetUrls(artist.url, maxSets);
  if (setUrls.length === 0) {
    throw new Error(`No sets found for artist: ${artist.name}`);
  }
  
  console.log(`✓ Found ${setUrls.length} sets to scrape`);
  
  const allSets: SetList[] = [];
  
  for (let i = 0; i < setUrls.length; i++) {
    const url = setUrls[i];
    console.log(`[${i + 1}/${setUrls.length}] Scraping: ${url}`);
    
    try {
      const result = await fetch1001TracklistDirect(url);
      
      if (result.tracks.length > 0 || result.title) {
        const sourceLinks: SetList['sourceLinks'] = [
          { platform: '1001tracklists', url }
        ];
        
        const tracks: Track[] = result.tracks.map((t, index) => ({
          id: `luke-dean-${Date.now()}-${i}-${index}`,
          title: t.title,
          artist: t.artist,
          timestamp: parseTimestamp(t.timestamp),
          duration: 0,
          coverUrl: result.thumbnail || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
          addedAt: new Date(),
          source: 'link' as const,
          verified: false,
        }));
        
        const newSet: SetList = {
          id: `luke-dean-${Date.now()}-${i}`,
          name: result.title || `Set ${i + 1}`,
          artist: result.artist || artist.name,
          venue: result.venue,
          date: result.date ? new Date(result.date) : new Date(),
          tracks,
          coverUrl: result.thumbnail,
          sourceLinks,
          totalDuration: 0,
          aiProcessed: false,
          commentsScraped: 0,
          tracksIdentified: tracks.length,
          plays: 0,
        };
        
        allSets.push(newSet);
        console.log(`  ✓ Extracted ${tracks.length} tracks`);
      }
      
      if (i < setUrls.length - 1) {
        await delay(1000);
      }
    } catch (error) {
      console.error(`  ✗ Error:`, error);
      continue;
    }
  }
  
  return { sets: allSets, artist: artist.name };
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
  console.log(`\n========================================`);
  console.log(`Adding Luke Dean sets to app library`);
  console.log(`========================================\n`);
  
  try {
    const { sets, artist } = await scrapeAllArtistSets('Luke Dean', 50);
    
    console.log(`\n✓ Scraped ${sets.length} sets with ${sets.reduce((sum, s) => sum + s.tracks.length, 0)} total tracks\n`);
    
    // Read current mocks file
    const mocksPath = join(process.cwd(), 'mocks', 'tracks.ts');
    let mocksContent = readFileSync(mocksPath, 'utf-8');
    
    // Find the export statement for mockSetLists
    const exportMatch = mocksContent.match(/export const mockSetLists[^=]*=\s*\[/);
    if (!exportMatch) {
      throw new Error('Could not find mockSetLists export in mocks/tracks.ts');
    }
    
    const exportIndex = mocksContent.indexOf(exportMatch[0]);
    const arrayStartIndex = mocksContent.indexOf('[', exportIndex);
    
    // Find the closing bracket of the array (before the last export or end of file)
    let bracketCount = 0;
    let arrayEndIndex = arrayStartIndex;
    for (let i = arrayStartIndex; i < mocksContent.length; i++) {
      if (mocksContent[i] === '[') bracketCount++;
      if (mocksContent[i] === ']') {
        bracketCount--;
        if (bracketCount === 0) {
          arrayEndIndex = i;
          break;
        }
      }
    }
    
    // Convert sets to TypeScript format
    const setsCode = sets.map(set => {
      const tracksCode = set.tracks.map(track => {
        return `    {
      id: "${track.id}",
      title: "${track.title.replace(/"/g, '\\"')}",
      artist: "${track.artist.replace(/"/g, '\\"')}",
      timestamp: ${track.timestamp || 0},
      duration: ${track.duration || 0},
      coverUrl: "${track.coverUrl || ''}",
      addedAt: new Date("${track.addedAt.toISOString()}"),
      source: "${track.source}",
      verified: ${track.verified || false},
    }`;
      }).join(',\n');
      
      return `  {
    id: "${set.id}",
    name: "${set.name.replace(/"/g, '\\"')}",
    artist: "${set.artist.replace(/"/g, '\\"')}",
    ${set.venue ? `venue: "${set.venue.replace(/"/g, '\\"')}",` : ''}
    date: new Date("${set.date.toISOString()}"),
    tracks: [
${tracksCode}
    ],
    ${set.coverUrl ? `coverUrl: "${set.coverUrl}",` : ''}
    sourceLinks: ${JSON.stringify(set.sourceLinks)},
    totalDuration: ${set.totalDuration || 0},
    aiProcessed: ${set.aiProcessed || false},
    commentsScraped: ${set.commentsScraped || 0},
    tracksIdentified: ${set.tracksIdentified || 0},
    plays: ${set.plays || 0},
  }`;
    }).join(',\n');
    
    // Insert new sets at the beginning of the array
    const beforeArray = mocksContent.substring(0, arrayStartIndex + 1);
    const afterArray = mocksContent.substring(arrayStartIndex + 1, arrayEndIndex);
    const newContent = beforeArray + '\n' + setsCode + (afterArray.trim() ? ',\n' + afterArray : '') + mocksContent.substring(arrayEndIndex);
    
    // Write back to file
    writeFileSync(mocksPath, newContent, 'utf-8');
    
    console.log(`✓ Added ${sets.length} sets to mocks/tracks.ts`);
    console.log(`\n========================================`);
    console.log(`Complete!`);
    console.log(`========================================\n`);
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
