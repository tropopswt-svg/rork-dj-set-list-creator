/**
 * Script to add Luke Dean sets using the backend scraper
 * This uses the same logic as the tRPC endpoint but runs directly
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { SetList, Track } from '../types';

// Import the backend scraper function
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetch1001TracklistDirect(url: string): Promise<{
  tracks: Array<{ title: string; artist: string; timestamp: string }>;
  title?: string;
  artist?: string;
  venue?: string;
  date?: string;
  thumbnail?: string;
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
      
      // Extract tracks - try multiple patterns
      // Pattern 1: tlpItem divs
      const trackRowPattern = /<div[^>]*class="[^"]*tlpItem[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
      let rows = html.match(trackRowPattern) || [];
      
      // Pattern 2: tlpTog divs (alternative structure)
      if (rows.length === 0) {
        const toggPattern = /<div[^>]*class="[^"]*tlpTog[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
        rows = html.match(toggPattern) || [];
      }
      
      // Pattern 3: table rows
      if (rows.length === 0) {
        const trPattern = /<tr[^>]*class="[^"]*tlpItem[^"]*"[^>]*>[\s\S]*?<\/tr>/gi;
        rows = html.match(trPattern) || [];
      }
      
      for (const row of rows) {
        // Try multiple track name patterns
        const trackNameMatch = 
          row.match(/<span[^>]*class="[^"]*trackFormat[^"]*"[^>]*>([\s\S]*?)<\/span>/i) ||
          row.match(/<span[^>]*class="[^"]*trackValue[^"]*"[^>]*>([\s\S]*?)<\/span>/i) ||
          row.match(/<div[^>]*class="[^"]*trackFormat[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
          row.match(/<td[^>]*class="[^"]*trackFormat[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
        
        const timeMatch = 
          row.match(/<span[^>]*class="[^"]*cueValueField[^"]*"[^>]*>([^<]+)<\/span>/i) ||
          row.match(/<div[^>]*class="[^"]*cueValueField[^"]*"[^>]*>([^<]+)<\/div>/i) ||
          row.match(/<td[^>]*class="[^"]*cueValueField[^"]*"[^>]*>([^<]+)<\/td>/i);
        
        if (trackNameMatch) {
          const fullTrack = trackNameMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          const parts = fullTrack.split(/\s*[-–]\s*/);
          
          if (parts.length >= 2) {
            result.tracks.push({
              title: parts.slice(1).join(' - ').trim(),
              artist: parts[0].trim(),
              timestamp: timeMatch ? timeMatch[1].trim() : '0:00',
            });
          } else if (fullTrack.length > 3) {
            // If no dash, try to split by common patterns
            const altParts = fullTrack.match(/^(.+?)\s+(?:by|feat\.?|ft\.?)\s+(.+)$/i);
            if (altParts) {
              result.tracks.push({
                title: altParts[2].trim(),
                artist: altParts[1].trim(),
                timestamp: timeMatch ? timeMatch[1].trim() : '0:00',
              });
            } else {
              // Single track name, use as title
              result.tracks.push({
                title: fullTrack,
                artist: 'Unknown',
                timestamp: timeMatch ? timeMatch[1].trim() : '0:00',
              });
            }
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
  const urls = [
    'https://www.1001tracklists.com/tracklist/23n9z9xk/luke-nye-2026-2026-01-01.html',
    'https://www.1001tracklists.com/tracklist/26b26jut/max-dean-luke-dean-wyld-lab11-birmingham-united-kingdom-2023-09-09.html',
    'https://www.1001tracklists.com/tracklist/14wrxfdt/max-dean-luke-dean-joss-dean-radio-1s-essential-mix-2025-12-20.html',
  ];
  
  console.log(`\n========================================`);
  console.log(`Adding ${urls.length} Luke Dean sets`);
  console.log(`========================================\n`);
  
  const allSets: SetList[] = [];
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`[${i + 1}/${urls.length}] Scraping: ${url}`);
    
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
          artist: result.artist || 'Luke Dean',
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
      
      if (i < urls.length - 1) {
        await delay(1000);
      }
    } catch (error) {
      console.error(`  ✗ Error:`, error);
      continue;
    }
  }
  
  if (allSets.length === 0) {
    console.log('\n❌ No sets were successfully scraped');
    return;
  }
  
  console.log(`\n✓ Successfully scraped ${allSets.length} sets`);
  console.log(`  Total tracks: ${allSets.reduce((sum, s) => sum + s.tracks.length, 0)}\n`);
  
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
  
  // Find the closing bracket of the array
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
  const setsCode = allSets.map(set => {
    const tracksCode = set.tracks.map(track => {
      return `    {
      id: "${track.id}",
      title: ${JSON.stringify(track.title)},
      artist: ${JSON.stringify(track.artist)},
      timestamp: ${track.timestamp || 0},
      duration: ${track.duration || 0},
      coverUrl: ${JSON.stringify(track.coverUrl || '')},
      addedAt: new Date("${track.addedAt.toISOString()}"),
      source: "${track.source}",
      verified: ${track.verified || false},
    }`;
    }).join(',\n');
    
    return `  {
    id: ${JSON.stringify(set.id)},
    name: ${JSON.stringify(set.name)},
    artist: ${JSON.stringify(set.artist)},
    ${set.venue ? `venue: ${JSON.stringify(set.venue)},` : ''}
    date: new Date("${set.date.toISOString()}"),
    tracks: [
${tracksCode}
    ],
    ${set.coverUrl ? `coverUrl: ${JSON.stringify(set.coverUrl)},` : ''}
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
  
  console.log(`✓ Added ${allSets.length} sets to mocks/tracks.ts`);
  console.log(`\n========================================`);
  console.log(`Complete!`);
  console.log(`========================================\n`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
