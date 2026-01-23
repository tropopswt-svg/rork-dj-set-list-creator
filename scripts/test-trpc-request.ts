/**
 * Test tRPC request exactly as the frontend does it
 */

const BACKEND_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'https://72roq2v56c1t8ob04sop2.rork.app';
const YOUTUBE_URL = 'https://www.youtube.com/watch?v=LXGBKmlRn0U';

async function testTRPCRequest() {
  console.log('=== Testing tRPC Request (Frontend Format) ===\n');
  console.log(`Backend: ${BACKEND_URL}`);
  console.log(`URL: ${YOUTUBE_URL}\n`);

  // Test 1: Check if root endpoint works
  console.log('Test 1: Root endpoint');
  try {
    const rootRes = await fetch(`${BACKEND_URL}/`);
    const rootData = await rootRes.json();
    console.log(`  ✅ Status: ${rootRes.status}`);
    console.log(`  Response:`, rootData);
  } catch (error) {
    console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  console.log('\nTest 2: tRPC endpoint (procedure in URL path)');
  // tRPC httpLink format: POST /api/trpc/{procedurePath}
  // Body: JSON with input (or batch format)
  const procedurePath = 'scraper.identifyTrackFromUrl';
  const trpcUrl = `${BACKEND_URL}/api/trpc/${procedurePath}`;
  
  console.log(`  URL: ${trpcUrl}`);
  console.log(`  Method: POST`);
  
  try {
    // Try format 1: Direct input (what httpLink might use)
    console.log('\n  Format 1: Direct input object');
    const res1 = await fetch(trpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audioUrl: YOUTUBE_URL,
        startSeconds: 40,
        durationSeconds: 15,
      }),
    });
    
    console.log(`    Status: ${res1.status}`);
    const text1 = await res1.text();
    console.log(`    Response (first 500 chars): ${text1.substring(0, 500)}`);
    
    if (res1.ok) {
      try {
        const json1 = JSON.parse(text1);
        console.log(`    ✅ Success! Response:`, JSON.stringify(json1, null, 2));
      } catch {
        console.log(`    ⚠️  Response is not JSON`);
      }
    } else {
      console.log(`    ❌ Failed with status ${res1.status}`);
    }
  } catch (error) {
    console.log(`    ❌ Exception: ${error instanceof Error ? error.message : 'Unknown'}`);
    if (error instanceof Error && error.stack) {
      console.log(`    Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
    }
  }

  // Try format 2: Batch format (what tRPC might use for batching)
  console.log('\n  Format 2: Batch format');
  try {
    const res2 = await fetch(trpcUrl, {
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
    
    console.log(`    Status: ${res2.status}`);
    const text2 = await res2.text();
    console.log(`    Response (first 500 chars): ${text2.substring(0, 500)}`);
    
    if (res2.ok) {
      try {
        const json2 = JSON.parse(text2);
        console.log(`    ✅ Success! Response:`, JSON.stringify(json2, null, 2));
      } catch {
        console.log(`    ⚠️  Response is not JSON`);
      }
    } else {
      console.log(`    ❌ Failed with status ${res2.status}`);
    }
  } catch (error) {
    console.log(`    ❌ Exception: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  // Test 3: Check if the route exists at all
  console.log('\nTest 3: Route existence check');
  const testPaths = [
    '/api/trpc',
    '/api/trpc/scraper',
    '/api/trpc/scraper.identifyTrackFromUrl',
    '/trpc/scraper.identifyTrackFromUrl', // Old path
  ];
  
  for (const path of testPaths) {
    try {
      const res = await fetch(`${BACKEND_URL}${path}`, {
        method: 'GET',
      });
      console.log(`  ${path}: ${res.status} ${res.statusText}`);
    } catch (error) {
      console.log(`  ${path}: Error - ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  console.log('\n=== Test Complete ===');
}

testTRPCRequest().catch(console.error);
