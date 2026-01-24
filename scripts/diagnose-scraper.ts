#!/usr/bin/env bun

/**
 * Diagnostic script to test the scraper and identify issues
 */

const BACKEND_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'http://localhost:3001';

async function checkBackend() {
  console.log('🔍 Checking backend server...');
  try {
    const response = await fetch(`${BACKEND_URL}/`);
    if (response.ok) {
      console.log('✅ Backend server is running');
      return true;
    }
  } catch (error) {
    console.log('❌ Backend server is NOT running');
    console.log(`   Expected URL: ${BACKEND_URL}`);
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    console.log('\n💡 To start the backend:');
    console.log('   bun run server');
    return false;
  }
  return false;
}

async function testScraper(url: string) {
  console.log(`\n🧪 Testing scraper with URL: ${url}`);
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/trpc/scraper.scrapeUrl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: { url },
      }),
    });

    const data = await response.json();
    
    if (data.error) {
      console.log('❌ Scraper returned an error:');
      console.log(JSON.stringify(data.error, null, 2));
      return;
    }

    if (data.result?.data) {
      const result = data.result.data;
      if (result.success) {
        console.log('✅ Scraper succeeded!');
        console.log(`   Title: ${result.data?.title || 'N/A'}`);
        console.log(`   Artist: ${result.data?.artist || 'N/A'}`);
        console.log(`   Tracks found: ${result.data?.tracks?.length || 0}`);
        console.log(`   Platform: ${result.data?.platform || 'N/A'}`);
      } else {
        console.log('❌ Scraper failed:');
        console.log(`   Error: ${result.error || 'Unknown error'}`);
      }
    } else {
      console.log('❌ Unexpected response format:');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('❌ Failed to call scraper:');
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.cause) {
      console.log(`   Cause: ${error.cause}`);
    }
  }
}

async function main() {
  const url = process.argv[2];
  
  if (!url) {
    console.log('Usage: bun run scripts/diagnose-scraper.ts <URL>');
    console.log('\nExample URLs:');
    console.log('  https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    console.log('  https://soundcloud.com/user/track-name');
    console.log('  https://www.mixcloud.com/user/mix-name/');
    process.exit(1);
  }

  console.log('🔧 Scraper Diagnostic Tool\n');
  console.log(`Backend URL: ${BACKEND_URL}\n`);

  const backendRunning = await checkBackend();
  
  if (!backendRunning) {
    process.exit(1);
  }

  await testScraper(url);
}

main().catch(console.error);
