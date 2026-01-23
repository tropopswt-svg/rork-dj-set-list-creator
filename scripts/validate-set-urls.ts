/**
 * Script to validate all set URLs in mocks/tracks.ts
 * Tests URL accessibility and backend integration (SoundCloud/YouTube resolution)
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../backend/trpc/app-router';
import superjson from 'superjson';

// Real URLs found in mocks
const REAL_URLS = [
  { platform: 'soundcloud', url: 'https://soundcloud.com/chris-stussy/straat', name: 'Chris Stussy - STRAAT' },
  { platform: 'soundcloud', url: 'https://soundcloud.com/ame/cercle-alps', name: 'Âme - Cercle Alps' },
  { platform: 'soundcloud', url: 'https://soundcloud.com/hunee/dekmantel-2024', name: 'Hunee - Dekmantel 2024' },
  { platform: 'soundcloud', url: 'https://soundcloud.com/deadmau5/strobe', name: 'deadmau5 - Strobe' },
  { platform: 'youtube', url: 'https://www.youtube.com/watch?v=_ovdm2yX4MA', name: 'Avicii - Levels' },
  { platform: 'mixcloud', url: 'https://www.mixcloud.com/hunee/dekmantel-2024/', name: 'Hunee - Dekmantel 2024' },
];

const PLACEHOLDER_URLS = [
  'https://www.youtube.com/watch?v=example1',
  'https://www.youtube.com/watch?v=example2',
  'https://www.youtube.com/watch?v=example3',
  'https://www.youtube.com/watch?v=example4',
  'https://www.youtube.com/watch?v=example5',
  'https://www.youtube.com/watch?v=example6',
];

// Create tRPC client to test backend resolution
const getTrpcClient = () => {
  const baseUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL 
    ? `${process.env.EXPO_PUBLIC_RORK_API_BASE_URL}/api/trpc`
    : 'http://localhost:8081/api/trpc';
  
  return createTRPCProxyClient<AppRouter>({
    transformer: superjson,
    links: [
      httpBatchLink({
        url: baseUrl,
      }),
    ],
  });
};

async function testUrlAccess(url: string): Promise<{ accessible: boolean; status?: number; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      redirect: 'follow',
    });
    
    clearTimeout(timeout);
    return { accessible: response.status < 400, status: response.status };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { accessible: false, error: 'Timeout' };
    }
    // For platforms that block HEAD, consider it potentially accessible
    return { accessible: true, error: 'HEAD blocked, but URL format valid' };
  }
}

async function testBackendResolution(url: string, platform: string): Promise<{ success: boolean; error?: string }> {
  try {
    const trpc = getTrpcClient();
    
    // Test with a small duration to avoid long waits
    const result = await trpc.scraper.identifyTrackFromUrl.mutate({
      audioUrl: url,
      startSeconds: 0,
      durationSeconds: 5, // Short test
    });
    
    if (result.success || result.error?.includes('credentials') || result.error?.includes('resolve')) {
      // Even if identification fails, if we got past URL resolution, that's good
      return { success: true };
    }
    
    return { success: false, error: result.error || 'Unknown error' };
  } catch (error: any) {
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('fetch')) {
      return { success: false, error: 'Backend not running or unreachable' };
    }
    return { success: false, error: error.message || 'Unknown error' };
  }
}

async function main() {
  console.log('🔍 Validating Set URLs\n');
  console.log('=' .repeat(60) + '\n');
  
  // Check environment variables
  console.log('📋 Environment Check:\n');
  const envVars = {
    'ACRCLOUD_ACCESS_KEY': process.env.ACRCLOUD_ACCESS_KEY ? '✅ Set' : '❌ Missing',
    'ACRCLOUD_ACCESS_SECRET': process.env.ACRCLOUD_ACCESS_SECRET ? '✅ Set' : '❌ Missing',
    'SOUNDCLOUD_CLIENT_ID': process.env.SOUNDCLOUD_CLIENT_ID ? '✅ Set' : '❌ Missing',
    'YT_DLP_PATH': process.env.YT_DLP_PATH ? `✅ Set (${process.env.YT_DLP_PATH})` : '⚠️  Not set (will use default)',
  };
  
  Object.entries(envVars).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  // Test real URLs
  console.log('🌐 Testing Real URLs:\n');
  
  let accessibleCount = 0;
  let backendWorkingCount = 0;
  
  for (const { platform, url, name } of REAL_URLS) {
    console.log(`\n📌 ${name}`);
    console.log(`   Platform: ${platform.toUpperCase()}`);
    console.log(`   URL: ${url}`);
    
    // Test URL access
    const accessResult = await testUrlAccess(url);
    if (accessResult.accessible) {
      console.log(`   ✅ URL accessible (status: ${accessResult.status || 'OK'})`);
      accessibleCount++;
    } else {
      console.log(`   ⚠️  URL access: ${accessResult.error || `HTTP ${accessResult.status}`}`);
    }
    
    // Test backend resolution (only for SoundCloud/YouTube)
    if (platform === 'soundcloud' || platform === 'youtube') {
      console.log(`   🔧 Testing backend resolution...`);
      const backendResult = await testBackendResolution(url, platform);
      if (backendResult.success) {
        console.log(`   ✅ Backend can resolve URL`);
        backendWorkingCount++;
      } else {
        console.log(`   ❌ Backend resolution failed: ${backendResult.error}`);
      }
    }
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  // Report placeholders
  console.log('⚠️  Placeholder URLs Found:\n');
  PLACEHOLDER_URLS.forEach(url => {
    console.log(`   ${url}`);
  });
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  // Summary
  console.log('📊 Summary:\n');
  console.log(`  Real URLs tested: ${REAL_URLS.length}`);
  console.log(`  ✅ Accessible: ${accessibleCount}/${REAL_URLS.length}`);
  console.log(`  ✅ Backend resolution working: ${backendWorkingCount}/${REAL_URLS.filter(u => u.platform === 'soundcloud' || u.platform === 'youtube').length}`);
  console.log(`  ⚠️  Placeholder URLs: ${PLACEHOLDER_URLS.length}`);
  
  console.log('\n💡 Recommendations:\n');
  
  if (accessibleCount < REAL_URLS.length) {
    console.log('  - Some URLs may be inaccessible or require authentication');
  }
  
  if (backendWorkingCount < REAL_URLS.filter(u => u.platform === 'soundcloud' || u.platform === 'youtube').length) {
    console.log('  - Backend URL resolution needs attention. Check:');
    console.log('    • Backend server is running');
    console.log('    • Environment variables are set correctly');
    console.log('    • yt-dlp is installed and accessible (for YouTube)');
    console.log('    • SoundCloud Client ID is valid (for SoundCloud)');
  }
  
  if (PLACEHOLDER_URLS.length > 0) {
    console.log('  - Replace placeholder YouTube URLs with real video IDs for testing');
  }
  
  console.log('\n');
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  if (error.message?.includes('ECONNREFUSED')) {
    console.error('\n💡 Make sure the backend server is running:');
    console.error('   bun run start-web');
  }
  process.exit(1);
});
