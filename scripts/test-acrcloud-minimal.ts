/**
 * Minimal test to see what ACRCloud accepts
 */

import { createTRPCProxyClient, httpLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '../backend/trpc/app-router';

const BACKEND_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'http://localhost:3002';

async function testMinimal() {
  console.log('=== Testing Minimal ACRCloud Request ===\n');
  
  const client = createTRPCProxyClient<AppRouter>({
    links: [
      httpLink({
        url: `${BACKEND_URL}/api/trpc`,
        transformer: superjson,
      }),
    ],
  });

  // Test 1: Very short timestamp (1 minute)
  console.log('Test 1: Short timestamp (1:00)');
  try {
    const result1 = await client.scraper.identifyTrackFromUrl.mutate({
      audioUrl: 'https://www.youtube.com/watch?v=LXGBKmlRn0U',
      startSeconds: 60, // 1 minute
      durationSeconds: 15,
    });
    console.log('Result:', JSON.stringify(result1, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\nTest 2: No timestamp (start from beginning)');
  try {
    const result2 = await client.scraper.identifyTrackFromUrl.mutate({
      audioUrl: 'https://www.youtube.com/watch?v=LXGBKmlRn0U',
      startSeconds: 0,
      durationSeconds: 15,
    });
    console.log('Result:', JSON.stringify(result2, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testMinimal().catch(console.error);
