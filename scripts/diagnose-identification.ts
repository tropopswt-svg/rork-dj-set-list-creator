/**
 * Diagnostic script to test identification flow and find where it fails
 */

const YOUTUBE_URL = 'https://www.youtube.com/watch?v=LXGBKmlRn0U';
const SOUNDCLOUD_URL = 'https://soundcloud.com/user-820329560/chris-stussy-dj-set-from-the?si=7a3ebf4d315540f7956be8c984b14164&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing';

async function diagnoseIdentification() {
  console.log('=== Identification Diagnostic Tool ===\n');

  // Step 1: Check environment variables
  console.log('Step 1: Environment Variables');
  const envVars = {
    ACRCLOUD_ACCESS_KEY: process.env.ACRCLOUD_ACCESS_KEY ? '✅ Set' : '❌ Missing',
    ACRCLOUD_ACCESS_SECRET: process.env.ACRCLOUD_ACCESS_SECRET ? '✅ Set' : '❌ Missing',
    SOUNDCLOUD_CLIENT_ID: process.env.SOUNDCLOUD_CLIENT_ID ? '✅ Set' : '❌ Missing',
    YT_DLP_PATH: process.env.YT_DLP_PATH || './bin/yt-dlp',
  };
  console.log(JSON.stringify(envVars, null, 2));
  console.log('');

  // Step 2: Test yt-dlp (for YouTube)
  console.log('Step 2: Testing yt-dlp for YouTube URL resolution');
  try {
    const { spawnSync } = await import('child_process');
    const fs = await import('fs');
    const path = await import('path');
    
    const ytDlpPath = envVars.YT_DLP_PATH;
    const projectRoot = process.cwd();
    const resolvedPath = path.isAbsolute(ytDlpPath) 
      ? ytDlpPath 
      : path.resolve(projectRoot, ytDlpPath);
    
    if (!fs.existsSync(resolvedPath)) {
      console.log(`  ❌ yt-dlp not found at: ${resolvedPath}`);
      console.log(`  💡 Install with: brew install yt-dlp`);
    } else {
      console.log(`  ✅ yt-dlp found at: ${resolvedPath}`);
      
      // Test extraction
      const result = spawnSync(resolvedPath, [
        '-g',
        '-f', 'bestaudio/best',
        '--no-warnings',
        YOUTUBE_URL,
      ], { 
        encoding: 'utf8',
        timeout: 10000,
      });
      
      if (result.status === 0 && result.stdout?.trim()) {
        const streamUrl = result.stdout.trim();
        console.log(`  ✅ Successfully extracted stream URL`);
        console.log(`  Stream URL: ${streamUrl.substring(0, 100)}...`);
        
        // Test if stream URL is accessible
        console.log(`  Testing stream URL accessibility...`);
        try {
          const streamTest = await fetch(streamUrl, { 
            method: 'HEAD',
            signal: AbortSignal.timeout(5000),
          });
          console.log(`  ✅ Stream URL accessible (status: ${streamTest.status})`);
        } catch (streamError) {
          console.log(`  ❌ Stream URL not accessible: ${streamError instanceof Error ? streamError.message : 'Unknown error'}`);
          console.log(`  💡 This could cause ACRCloud to fail`);
        }
      } else {
        console.log(`  ❌ Failed to extract stream URL (exit code: ${result.status})`);
        if (result.stderr) {
          console.log(`  stderr: ${result.stderr.toString().substring(0, 500)}`);
        }
        if (result.stdout) {
          console.log(`  stdout: ${result.stdout.toString().substring(0, 500)}`);
        }
        if (!result.stderr && !result.stdout) {
          console.log(`  No output from yt-dlp`);
        }
        console.log(`  💡 Try running manually: ${resolvedPath} -g -f "bestaudio/best" "${YOUTUBE_URL}"`);
      }
    }
  } catch (error) {
    console.log(`  ❌ Error testing yt-dlp: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log('');

  // Step 3: Test SoundCloud resolution
  console.log('Step 3: Testing SoundCloud URL resolution');
  if (!envVars.SOUNDCLOUD_CLIENT_ID.includes('✅')) {
    console.log('  ⚠️  SOUNDCLOUD_CLIENT_ID not set, skipping SoundCloud test');
  } else {
    try {
      const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
      const resolveUrl = `https://api-widget.soundcloud.com/resolve?url=${encodeURIComponent(SOUNDCLOUD_URL)}&format=json&client_id=${clientId}`;
      
      const resolveRes = await fetch(resolveUrl);
      if (resolveRes.ok) {
        const data = await resolveRes.json();
        const transcodings = data.media?.transcodings;
        if (transcodings?.length) {
          console.log(`  ✅ SoundCloud URL resolved successfully`);
          console.log(`  Found ${transcodings.length} transcoding options`);
        } else {
          console.log(`  ❌ No transcodings found in SoundCloud response`);
        }
      } else {
        console.log(`  ❌ SoundCloud resolve failed: ${resolveRes.status}`);
      }
    } catch (error) {
      console.log(`  ❌ Error testing SoundCloud: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  console.log('');

  // Step 4: Test ACRCloud API directly
  console.log('Step 4: Testing ACRCloud API (with a test URL)');
  if (!envVars.ACRCLOUD_ACCESS_KEY.includes('✅') || !envVars.ACRCLOUD_ACCESS_SECRET.includes('✅')) {
    console.log('  ⚠️  ACRCloud credentials not set, skipping API test');
  } else {
    console.log('  💡 To test ACRCloud, you need a valid stream URL');
    console.log('  💡 Run identification in the app and check backend logs for ACRCloud response');
  }
  console.log('');

  // Summary
  console.log('=== Diagnostic Summary ===');
  console.log('Next steps:');
  console.log('1. Check backend server logs when you try identification');
  console.log('2. Look for [ACRCloud] log lines to see exactly where it fails');
  console.log('3. Common failure points:');
  console.log('   - yt-dlp not installed or not working');
  console.log('   - Stream URL not accessible to ACRCloud');
  console.log('   - ACRCloud API error (check status code in logs)');
  console.log('   - Track not in ACRCloud database (code 1001 = no match)');
}

diagnoseIdentification().catch(console.error);
