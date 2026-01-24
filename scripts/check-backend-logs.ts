/**
 * Quick test to see if backend is receiving requests and logging
 * This will help us determine if the backend server has the latest code
 */

import { createTRPCProxyClient, httpLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '../backend/trpc/app-router';

const BACKEND_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'http://localhost:3002';

async function checkBackend() {
  console.log('=== Checking Backend Status ===\n');
  console.log(`Backend URL: ${BACKEND_URL}\n`);

  // Test 1: Health check
  console.log('Test 1: Health check endpoint');
  try {
    const health = await fetch(`${BACKEND_URL}/`);
    const data = await health.json();
    console.log(`  ✅ Backend is running:`, data);
  } catch (error) {
    console.log(`  ❌ Backend not reachable: ${error}`);
    return;
  }

  // Test 2: Try a simple tRPC call to see if we get logs
  console.log('\nTest 2: Making identification request (check backend terminal for logs)');
  console.log('  💡 Watch your backend server terminal for:');
  console.log('     - "[ACRCloud] ===== PROCEDURE CALLED ====="');
  console.log('     - "[ACRCloud] ===== IDENTIFICATION TRACE START ====="');
  console.log('     - Any other [ACRCloud] or [Scraper] logs\n');

  const client = createTRPCProxyClient<AppRouter>({
    links: [
      httpLink({
        url: `${BACKEND_URL}/api/trpc`,
        transformer: superjson,
      }),
    ],
  });

  try {
    const result = await client.scraper.identifyTrackFromUrl.mutate({
      audioUrl: 'https://www.youtube.com/watch?v=LXGBKmlRn0U',
      startSeconds: 4500,
      durationSeconds: 15,
    });

    console.log('  ✅ Request completed');
    console.log(`  Result: ${JSON.stringify(result, null, 2).substring(0, 200)}...`);
    
    console.log('\n📋 What to check in your backend terminal:');
    console.log('  1. Do you see "[ACRCloud] ===== PROCEDURE CALLED ====="?');
    console.log('     → YES: Backend has latest code, request is reaching it');
    console.log('     → NO: Backend needs restart to pick up new code');
    console.log('  2. Do you see "[ACRCloud] Detected YouTube URL"?');
    console.log('     → YES: URL detection is working');
    console.log('     → NO: Check URL format');
    console.log('  3. Do you see "[Scraper] Running yt-dlp: ..."?');
    console.log('     → YES: yt-dlp is being called');
    console.log('     → NO: yt-dlp config issue');
    console.log('  4. Do you see "[ACRCloud] Sending request to ACRCloud API..."?');
    console.log('     → YES: ACRCloud is being called (you should see request in ACRCloud dashboard)');
    console.log('     → NO: Failing before reaching ACRCloud');
  } catch (error: any) {
    console.log('  ❌ Request failed:', error.message);
    console.log('\n📋 Check your backend terminal for error logs');
  }
}

checkBackend().catch(console.error);
