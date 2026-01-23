/**
 * Script to add Luke Dean sets using the backend tRPC endpoint
 * This requires the backend server to be running
 * 
 * Usage:
 *   1. Start the app: bun run start-web (in another terminal)
 *   2. Run this script: bun run scripts/add-luke-dean-via-backend.ts
 */

import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../backend/trpc/app-router';
import superjson from 'superjson';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { SetList, Track } from '../types';

// Create tRPC client
const trpc = createTRPCProxyClient<AppRouter>({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: process.env.EXPO_PUBLIC_RORK_API_BASE_URL 
        ? `${process.env.EXPO_PUBLIC_RORK_API_BASE_URL}/api/trpc`
        : 'http://localhost:8081/api/trpc', // Default Expo dev server port
    }),
  ],
});

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
  console.log(`Adding Luke Dean sets via backend API`);
  console.log(`========================================\n`);
  
  try {
    console.log('Calling backend scraper...');
    const result = await trpc.scraper.scrapeAllArtistSets.mutate({
      artistName: 'Luke Dean',
      maxSets: 50,
      delayMs: 1000,
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to scrape sets');
    }
    
    console.log(`✓ Scraped ${result.sets.length} sets with ${result.totalTracks} total tracks\n`);
    
    // Convert to SetList format
    const sets: SetList[] = result.sets.map((scrapedSet, i) => {
      const sourceLinks: SetList['sourceLinks'] = [];
      
      // Add 1001tracklists URL
      if (scrapedSet.url) {
        sourceLinks.push({ platform: '1001tracklists', url: scrapedSet.url });
      }
      
      // Add audio links
      if (scrapedSet.links?.youtube) {
        sourceLinks.push({ platform: 'youtube', url: scrapedSet.links.youtube });
      }
      if (scrapedSet.links?.soundcloud) {
        sourceLinks.push({ platform: 'soundcloud', url: scrapedSet.links.soundcloud });
      }
      if (scrapedSet.links?.mixcloud) {
        sourceLinks.push({ platform: 'mixcloud', url: scrapedSet.links.mixcloud });
      }
      
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
      
      return {
        id: `luke-dean-${Date.now()}-${i}`,
        name: scrapedSet.title || `Set ${i + 1}`,
        artist: scrapedSet.artist || result.artist || 'Luke Dean',
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
    });
    
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
    const setsCode = sets.map(set => {
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
    
    console.log(`✓ Added ${sets.length} sets to mocks/tracks.ts`);
    console.log(`\n========================================`);
    console.log(`Complete!`);
    console.log(`========================================\n`);
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message || error);
    if (error.message?.includes('fetch') || error.message?.includes('ECONNREFUSED')) {
      console.error('\n💡 Make sure the backend server is running:');
      console.error('   Run "bun run start-web" in another terminal first');
    }
    process.exit(1);
  }
}

main();
