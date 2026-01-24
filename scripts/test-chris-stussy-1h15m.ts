/**
 * Test identification at 1 hour 15 minutes for Chris Stussy STRAAT Museum set
 * Uses tRPC client directly like the frontend does
 */

import { createTRPCProxyClient, httpLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '../backend/trpc/app-router';

const YOUTUBE_URL = 'https://www.youtube.com/watch?v=LXGBKmlRn0U';
const BACKEND_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'http://localhost:3002';
const TIMESTAMP_SECONDS = 1 * 3600 + 15 * 60; // 1 hour 15 minutes = 4500 seconds

async function testIdentification() {
  console.log('=== Testing Identification at 1:15:00 ===\n');
  console.log(`Set: Chris Stussy at STRAAT Museum`);
  console.log(`URL: ${YOUTUBE_URL}`);
  console.log(`Timestamp: 1:15:00 (${TIMESTAMP_SECONDS} seconds)`);
  console.log(`Backend: ${BACKEND_URL}\n`);

  // Create tRPC client like the frontend does
  const client = createTRPCProxyClient<AppRouter>({
    links: [
      httpLink({
        url: `${BACKEND_URL}/api/trpc`,
        transformer: superjson,
      }),
    ],
  });

  try {
    console.log('Calling identifyTrackFromUrl...');
    console.log(`Input:`, {
      audioUrl: YOUTUBE_URL,
      startSeconds: TIMESTAMP_SECONDS,
      durationSeconds: 15,
    });
    console.log('');

    const result = await client.scraper.identifyTrackFromUrl.mutate({
      audioUrl: YOUTUBE_URL,
      startSeconds: TIMESTAMP_SECONDS,
      durationSeconds: 15,
    });

    console.log('=== Response ===');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n');

    if (result.success) {
      if (result.result) {
        console.log('✅ SUCCESS! Track identified:');
        console.log(`   Artist: ${result.result.artist}`);
        console.log(`   Title: ${result.result.title}`);
        if (result.result.links?.spotify) {
          console.log(`   Spotify: ${result.result.links.spotify}`);
        }
        if (result.result.links?.youtube) {
          console.log(`   YouTube: ${result.result.links.youtube}`);
        }
        console.log(`   Confidence: ${result.result.confidence}%`);
      } else {
        console.log('⚠️  No match found');
        console.log('   ACRCloud analyzed the audio but the track is not in their database');
        console.log('   This means:');
        console.log('   ✅ ACRCloud successfully listened to the audio segment');
        console.log('   ✅ The stream URL was accessible');
        console.log('   ❌ The track is not in ACRCloud\'s database');
      }
    } else {
      console.log('❌ Identification failed:');
      console.log(`   Error: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('❌ Request failed:');
    console.error(`   ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (error instanceof Error && error.stack) {
      console.error(`   Stack: ${error.stack.split('\n').slice(0, 5).join('\n')}`);
    }
  }

  console.log('\n=== Test Complete ===');
  console.log('\n💡 Check your backend server logs for detailed trace:');
  console.log('   - Look for [ACRCloud] and [Scraper] log lines');
  console.log('   - They will show:');
  console.log('     • If yt-dlp successfully extracted the stream URL');
  console.log('     • The exact timestamp range ACRCloud analyzed');
  console.log('     • Whether ACRCloud successfully processed the audio');
}

testIdentification().catch(console.error);
