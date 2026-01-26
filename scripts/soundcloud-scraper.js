#!/usr/bin/env node

/**
 * SoundCloud Track Scraper for ACRCloud Bucket Upload
 *
 * Downloads all tracks from a SoundCloud user profile and prepares them
 * for upload to ACRCloud custom bucket.
 *
 * Prerequisites:
 *   brew install yt-dlp ffmpeg
 *
 * Usage:
 *   node scripts/soundcloud-scraper.js <soundcloud-user-url>
 *   node scripts/soundcloud-scraper.js https://soundcloud.com/username
 *   node scripts/soundcloud-scraper.js https://soundcloud.com/username/sets/playlist-name
 *
 * Output:
 *   ./soundcloud-downloads/<username>/
 *     ├── tracks/           # Audio files (mp3)
 *     ├── metadata.json     # Track metadata for ACRCloud
 *     └── upload-ready.csv  # CSV format for bulk upload
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE_OUTPUT_DIR = './soundcloud-downloads';

// Use local binaries from ./bin if available, otherwise system-wide
const PROJECT_ROOT = path.resolve(__dirname, '..');
const LOCAL_YTDLP = path.join(PROJECT_ROOT, 'bin', 'yt-dlp');
const LOCAL_FFMPEG = path.join(PROJECT_ROOT, 'bin', 'ffmpeg');

const YTDLP_PATH = fs.existsSync(LOCAL_YTDLP) ? LOCAL_YTDLP : 'yt-dlp';
const FFMPEG_PATH = fs.existsSync(LOCAL_FFMPEG) ? LOCAL_FFMPEG : 'ffmpeg';

// Parse command line args
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log(`
SoundCloud Track Scraper for ACRCloud

Usage:
  node scripts/soundcloud-scraper.js <soundcloud-url>

Examples:
  node scripts/soundcloud-scraper.js https://soundcloud.com/username
  node scripts/soundcloud-scraper.js https://soundcloud.com/username/sets/playlist-name
  node scripts/soundcloud-scraper.js https://soundcloud.com/username/track-name

Prerequisites:
  brew install yt-dlp ffmpeg
`);
  process.exit(1);
}

const soundcloudUrl = args[0];

// Extract username from URL
function extractUsername(url) {
  const match = url.match(/soundcloud\.com\/([^\/\?]+)/);
  return match ? match[1] : 'unknown';
}

// Check if yt-dlp and ffmpeg are available
function checkDependencies() {
  // Check yt-dlp
  if (fs.existsSync(LOCAL_YTDLP)) {
    console.log(`Using local yt-dlp: ${LOCAL_YTDLP}`);
  } else {
    try {
      execSync('which yt-dlp', { stdio: 'ignore' });
      console.log('Using system yt-dlp');
    } catch {
      console.error('Error: yt-dlp not found.');
      console.error('Run the setup or install with: brew install yt-dlp');
      process.exit(1);
    }
  }

  // Check ffmpeg
  if (fs.existsSync(LOCAL_FFMPEG)) {
    console.log(`Using local ffmpeg: ${LOCAL_FFMPEG}`);
  } else {
    try {
      execSync('which ffmpeg', { stdio: 'ignore' });
      console.log('Using system ffmpeg');
    } catch {
      console.error('Error: ffmpeg not found.');
      console.error('Run the setup or install with: brew install ffmpeg');
      process.exit(1);
    }
  }
}

// Download tracks using yt-dlp
async function downloadTracks(url, outputDir) {
  const tracksDir = path.join(outputDir, 'tracks');
  fs.mkdirSync(tracksDir, { recursive: true });

  console.log(`\nDownloading tracks from: ${url}`);
  console.log(`Output directory: ${tracksDir}\n`);

  // yt-dlp command with metadata extraction
  const ytdlpArgs = [
    url,
    '--extract-audio',
    '--audio-format', 'mp3',
    '--audio-quality', '0',  // Best quality
    '--output', path.join(tracksDir, '%(title)s.%(ext)s'),
    '--write-info-json',     // Save metadata JSON for each track
    '--no-playlist-reverse', // Keep original order
    '--ignore-errors',       // Continue on errors
    '--no-overwrites',       // Don't re-download existing
    '--restrict-filenames',  // Safe filenames
    '--ffmpeg-location', path.dirname(FFMPEG_PATH), // Point to ffmpeg
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn(YTDLP_PATH, ytdlpArgs, { stdio: 'inherit' });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        // yt-dlp returns non-zero for partial failures, which is ok
        console.log(`\nyt-dlp finished with code ${code} (some tracks may have failed)`);
        resolve();
      }
    });

    proc.on('error', reject);
  });
}

// Parse downloaded metadata and create ACRCloud-ready format
function processMetadata(outputDir) {
  const tracksDir = path.join(outputDir, 'tracks');
  const files = fs.readdirSync(tracksDir);

  const jsonFiles = files.filter(f => f.endsWith('.info.json'));
  const tracks = [];

  for (const jsonFile of jsonFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(tracksDir, jsonFile), 'utf8'));

      // Find corresponding audio file
      const baseName = jsonFile.replace('.info.json', '');
      const audioFile = files.find(f =>
        f.startsWith(baseName) && (f.endsWith('.mp3') || f.endsWith('.m4a') || f.endsWith('.wav'))
      );

      if (audioFile) {
        tracks.push({
          // ACRCloud fields
          title: data.title || data.fulltitle || 'Unknown',
          artist: data.uploader || data.artist || 'Unknown',
          album: data.album || '',

          // Additional metadata
          duration: data.duration,
          uploadDate: data.upload_date,
          description: data.description?.substring(0, 500) || '',
          genre: data.genre || '',
          tags: data.tags || [],

          // Source info
          soundcloudUrl: data.webpage_url,
          soundcloudId: data.id,
          uploader: data.uploader,
          uploaderUrl: data.uploader_url,

          // Local file
          filename: audioFile,
          filepath: path.join(tracksDir, audioFile),
        });
      }
    } catch (err) {
      console.error(`Error parsing ${jsonFile}:`, err.message);
    }
  }

  return tracks;
}

// Generate CSV for ACRCloud bulk upload
function generateCSV(tracks, outputDir) {
  const csvPath = path.join(outputDir, 'upload-ready.csv');

  // ACRCloud CSV format: title, artist, album, audio_file
  const header = 'title,artist,album,audio_file,duration,soundcloud_url';
  const rows = tracks.map(t => {
    const escape = (s) => `"${(s || '').replace(/"/g, '""')}"`;
    return [
      escape(t.title),
      escape(t.artist),
      escape(t.album),
      escape(t.filename),
      t.duration || '',
      escape(t.soundcloudUrl),
    ].join(',');
  });

  fs.writeFileSync(csvPath, [header, ...rows].join('\n'));
  console.log(`\nCSV saved: ${csvPath}`);

  return csvPath;
}

// Main execution
async function main() {
  console.log('='.repeat(60));
  console.log('SoundCloud Track Scraper for ACRCloud');
  console.log('='.repeat(60));

  checkDependencies();

  const username = extractUsername(soundcloudUrl);
  const outputDir = path.join(BASE_OUTPUT_DIR, username);

  fs.mkdirSync(outputDir, { recursive: true });

  // Download tracks
  await downloadTracks(soundcloudUrl, outputDir);

  // Process metadata
  console.log('\nProcessing metadata...');
  const tracks = processMetadata(outputDir);

  if (tracks.length === 0) {
    console.log('No tracks found or downloaded.');
    return;
  }

  // Save full metadata JSON
  const metadataPath = path.join(outputDir, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(tracks, null, 2));
  console.log(`\nMetadata saved: ${metadataPath}`);

  // Generate CSV for ACRCloud
  generateCSV(tracks, outputDir);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total tracks: ${tracks.length}`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`\nFiles created:`);
  console.log(`  - tracks/          Audio files (mp3)`);
  console.log(`  - metadata.json    Full track metadata`);
  console.log(`  - upload-ready.csv ACRCloud bulk upload format`);
  console.log('\nNext steps:');
  console.log('  1. Review the tracks in the output folder');
  console.log('  2. Log into ACRCloud console');
  console.log('  3. Go to your custom bucket');
  console.log('  4. Use bulk upload with the CSV file');
  console.log('  5. Or upload individual tracks via their API');
}

main().catch(console.error);
