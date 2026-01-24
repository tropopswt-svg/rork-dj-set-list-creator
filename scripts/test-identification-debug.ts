/**
 * Comprehensive test to debug identification failure
 * This will show exactly where it fails
 */

import { createTRPCProxyClient, httpLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '../backend/trpc/app-router';

const YOUTUBE_URL = 'https://www.youtube.com/watch?v=LXGBKmlRn0U';
const BACKEND_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'http://localhost:3002';
const TIMESTAMP_SECONDS = 1 * 3600 + 15 * 60; // 1 hour 15 minutes = 4500 seconds

async function testIdentification() {
  console.log('=== COMPREHENSIVE IDENTIFICATION TEST ===\n');
  console.log(`Backend URL: ${BACKEND_URL}`);
  console.log(`YouTube URL: ${YOUTUBE_URL}`);
  console.log(`Timestamp: 1:15:00 (${TIMESTAMP_SECONDS} seconds)\n`);

  // Step 1: Test backend is reachable
  console.log('Step 1: Testing backend reachability...');
  try {
    const healthCheck = await fetch(`${BACKEND_URL}/`);
    const healthData = await healthCheck.json();
    console.log(`  ✅ Backend is reachable:`, healthData);
  } catch (error) {
    console.log(`  ❌ Backend not reachable: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.log(`  💡 Make sure your backend server is running: bun run server`);
    return;
  }

  // Step 2: Create tRPC client
  console.log('\nStep 2: Creating tRPC client...');
  const client = createTRPCProxyClient<AppRouter>({
    links: [
      httpLink({
        url: `${BACKEND_URL}/api/trpc`,
        transformer: superjson,
      }),
    ],
  });
  console.log(`  ✅ tRPC client created`);

  // Step 3: Test the mutation with detailed error handling
  console.log('\nStep 3: Calling identifyTrackFromUrl mutation...');
  console.log(`  Input:`, {
    audioUrl: YOUTUBE_URL,
    startSeconds: TIMESTAMP_SECONDS,
    durationSeconds: 15,
  });

  try {
    const result = await client.scraper.identifyTrackFromUrl.mutate({
      audioUrl: YOUTUBE_URL,
      startSeconds: TIMESTAMP_SECONDS,
      durationSeconds: 15,
    });

    console.log(`  ✅ Mutation completed`);
    console.log(`  Result:`, JSON.stringify(result, null, 2));

    if (result.success) {
      if (result.result) {
        console.log('\n✅ SUCCESS! Track identified:');
        console.log(`   Artist: ${result.result.artist}`);
        console.log(`   Title: ${result.result.title}`);
      } else {
        console.log('\n⚠️  No match found (but ACRCloud analyzed the audio)');
      }
    } else {
      console.log(`\n❌ Identification failed: ${result.error}`);
    }
  } catch (error: any) {
    console.log(`  ❌ Mutation failed with exception`);
    console.log(`  Error type: ${error?.constructor?.name || 'Unknown'}`);
    console.log(`  Error message: ${error?.message || 'No message'}`);
    console.log(`  Error code: ${error?.code || 'No code'}`);
    console.log(`  Error data:`, error?.data || 'No data');
    console.log(`  Full error:`, error);
    
    if (error?.data?.code) {
      console.log(`\n  💡 This is a tRPC error with code: ${error.data.code}`);
      if (error.data.code === 'BAD_REQUEST') {
        console.log(`  💡 This means input validation failed`);
        console.log(`  💡 Check backend logs for validation errors`);
      }
    }
    
    if (error?.message?.includes('fetch')) {
      console.log(`\n  💡 This is a network error - backend might not be running`);
    }
  }

  console.log('\n=== Test Complete ===');
  console.log('\n📋 Next Steps:');
  console.log('1. Check your backend server terminal for logs starting with [ACRCloud]');
  console.log('2. Look for:');
  console.log('   - "[ACRCloud] ===== PROCEDURE CALLED ====="');
  console.log('   - "[ACRCloud] ===== IDENTIFICATION TRACE START ====="');
  console.log('   - "[Scraper] Running yt-dlp: ..."');
  console.log('   - Any error messages');
  console.log('3. If you see NO logs, the request is not reaching the backend');
  console.log('4. If you see logs but they stop, check where they stop');
}

testIdentification().catch(console.error);
