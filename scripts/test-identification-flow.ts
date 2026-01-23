/**
 * Test the full identification flow to find where it fails
 * Simulates what the frontend does when clicking "Identify Track"
 */

const YOUTUBE_URL = 'https://www.youtube.com/watch?v=LXGBKmlRn0U';
const BACKEND_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'http://localhost:3000';

async function testIdentificationFlow() {
  console.log('=== Testing Identification Flow ===\n');
  
  console.log('📋 Test Configuration:');
  console.log(`  Backend URL: ${BACKEND_URL}`);
  console.log(`  Test URL: ${YOUTUBE_URL}`);
  console.log(`  Timestamp: 40 seconds\n`);

  // Step 1: Check if backend is reachable
  console.log('Step 1: Checking if backend is reachable...');
  try {
    const healthCheck = await fetch(`${BACKEND_URL}/api/trpc`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    console.log(`  ✅ Backend reachable (status: ${healthCheck.status})\n`);
  } catch (error) {
    console.log(`  ❌ Backend not reachable: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.log(`  💡 Make sure your backend server is running!\n`);
    return;
  }

  // Step 2: Test tRPC endpoint (using HTTP batch format)
  console.log('Step 2: Testing tRPC identifyTrackFromUrl endpoint...');
  try {
    // tRPC uses a specific format for HTTP requests
    const trpcUrl = `${BACKEND_URL}/api/trpc/scraper.identifyTrackFromUrl`;
    console.log(`  Calling: ${trpcUrl}`);
    
    const response = await fetch(trpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        "0": {
          json: {
            audioUrl: YOUTUBE_URL,
            startSeconds: 40,
            durationSeconds: 15,
          },
        },
      }),
    });

    console.log(`  Response status: ${response.status}`);
    console.log(`  Response headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const text = await response.text();
      console.log(`  ❌ HTTP Error: ${response.status}`);
      console.log(`  Response body: ${text.substring(0, 500)}\n`);
      return;
    }

    const result = await response.json();
    console.log(`  ✅ Response received`);
    console.log(`  Result:`, JSON.stringify(result, null, 2));
    
    if (result.result?.data?.success) {
      if (result.result.data.result) {
        console.log(`\n  ✅ SUCCESS: Identified track!`);
        console.log(`     ${result.result.data.result.artist} - ${result.result.data.result.title}`);
      } else {
        console.log(`\n  ⚠️  No match found (track not in database)`);
      }
    } else {
      console.log(`\n  ❌ Identification failed:`);
      console.log(`     Error: ${result.result?.data?.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.log(`  ❌ Request failed with exception:`);
    console.log(`     ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.log(`     ${error instanceof Error ? error.stack : ''}\n`);
    console.log(`  💡 This is likely the same error you're seeing in the app!`);
    console.log(`  💡 Check:`);
    console.log(`     - Is the backend server running?`);
    console.log(`     - Is the backend URL correct? (${BACKEND_URL})`);
    console.log(`     - Are there CORS issues?`);
    console.log(`     - Check backend logs for errors\n`);
  }

  console.log('\n=== Test Complete ===');
}

testIdentificationFlow().catch(console.error);
