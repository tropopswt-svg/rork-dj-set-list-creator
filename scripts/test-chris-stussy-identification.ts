/**
 * Shows which URL is used for Chris Stussy set identification
 * 
 * When you click "Identify Track" in the app:
 * 1. getAudioUrl() in [id].tsx checks sourceLinks
 * 2. It prioritizes YouTube over SoundCloud
 * 3. The selected URL is passed to identifyTrackFromUrl tRPC endpoint
 * 4. Backend resolves the URL and sends to ACRCloud
 */

const chrisStussySet = {
  name: 'Chris Stussy at STRAAT Museum',
  sourceLinks: [
    { platform: 'youtube', url: 'https://www.youtube.com/watch?v=LXGBKmlRn0U', label: 'Full Set' },
    { platform: 'soundcloud', url: 'https://soundcloud.com/user-820329560/chris-stussy-dj-set-from-the?si=7a3ebf4d315540f7956be8c984b14164&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing', label: 'Audio Only' },
    { platform: '1001tracklists', url: 'https://www.1001tracklists.com/tracklist/example1' },
  ],
};

// Simulate getAudioUrl() logic from [id].tsx
function getAudioUrl(sourceLinks: typeof chrisStussySet.sourceLinks): string | undefined {
  const youtubeLink = sourceLinks.find(l => l.platform === 'youtube');
  if (youtubeLink) {
    return youtubeLink.url;
  }
  const soundcloudLink = sourceLinks.find(l => l.platform === 'soundcloud');
  if (soundcloudLink) {
    return soundcloudLink.url;
  }
  return undefined;
}

console.log('=== Chris Stussy STRAAT Set - URL Selection Analysis ===\n');

console.log('📋 Available sourceLinks:');
chrisStussySet.sourceLinks.forEach(link => {
  console.log(`  ${link.platform.padEnd(15)} ${link.url}`);
});

console.log('\n📱 Frontend getAudioUrl() logic (from app/(tabs)/(discover)/[id].tsx):');
console.log('  1. Checks for YouTube link first');
console.log('  2. Falls back to SoundCloud if no YouTube');
console.log('  3. Returns undefined if neither exists\n');

const selectedUrl = getAudioUrl(chrisStussySet.sourceLinks);

if (selectedUrl) {
  console.log(`✅ Selected URL: ${selectedUrl}`);
  console.log(`   Platform: ${selectedUrl.includes('youtube') ? 'YouTube' : 'SoundCloud'}\n`);
  
  console.log('🔄 Backend processing flow:');
  if (selectedUrl.includes('youtube')) {
    console.log('  1. Detects YouTube URL');
    console.log('  2. Calls resolveYouTubeToStreamUrl() using yt-dlp');
    console.log('  3. Extracts direct audio stream URL');
    console.log('  4. Sends stream URL to ACRCloud for identification');
    console.log('\n💡 Check backend logs for:');
    console.log('   - "[ACRCloud] Detected YouTube URL"');
    console.log('   - "[ACRCloud] Resolved YouTube stream URL: ..."');
    console.log('   - "[ACRCloud] Final URL sent to ACRCloud: ..."');
  } else if (selectedUrl.includes('soundcloud')) {
    console.log('  1. Detects SoundCloud URL');
    console.log('  2. Calls resolveSoundCloudToStreamUrl() using Widget API');
    console.log('  3. Resolves to direct stream URL');
    console.log('  4. Sends stream URL to ACRCloud for identification');
    console.log('\n💡 Check backend logs for:');
    console.log('   - "[ACRCloud] Detected SoundCloud URL"');
    console.log('   - "[ACRCloud] Resolved SoundCloud stream URL: ..."');
    console.log('   - "[ACRCloud] Final URL sent to ACRCloud: ..."');
  }
} else {
  console.log('❌ No audio URL available (no YouTube or SoundCloud links)');
}

console.log('\n=== To test identification ===');
console.log('1. Open the app and navigate to Chris Stussy STRAAT set');
console.log('2. Click "Identify Track" at a timestamp');
console.log('3. Check your backend server logs for detailed trace output');
console.log('4. Look for lines starting with "[ACRCloud]" to see the full flow');
