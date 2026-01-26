#!/usr/bin/env node

/**
 * Batch SoundCloud Scraper
 *
 * Scrape multiple SoundCloud users/playlists from a text file.
 *
 * Usage:
 *   node scripts/batch-scrape.js <urls-file>
 *
 * urls-file format (one URL per line):
 *   https://soundcloud.com/user1
 *   https://soundcloud.com/user2
 *   https://soundcloud.com/user3/sets/playlist-name
 *   # Comments start with #
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
Batch SoundCloud Scraper

Usage:
  node scripts/batch-scrape.js <urls-file>

Create a text file with one SoundCloud URL per line:
  https://soundcloud.com/user1
  https://soundcloud.com/user2
  # This is a comment
  https://soundcloud.com/user3/sets/my-edits

Then run:
  node scripts/batch-scrape.js my-urls.txt
`);
  process.exit(1);
}

const urlsFile = args[0];

if (!fs.existsSync(urlsFile)) {
  console.error(`Error: File not found: ${urlsFile}`);
  process.exit(1);
}

const content = fs.readFileSync(urlsFile, 'utf8');
const urls = content
  .split('\n')
  .map(line => line.trim())
  .filter(line => line && !line.startsWith('#'));

console.log(`Found ${urls.length} URLs to process\n`);

const results = [];

for (let i = 0; i < urls.length; i++) {
  const url = urls[i];
  console.log(`\n[${ i + 1}/${urls.length}] Processing: ${url}`);
  console.log('-'.repeat(60));

  try {
    const result = spawnSync('node', [
      path.join(__dirname, 'soundcloud-scraper.js'),
      url
    ], { stdio: 'inherit' });

    results.push({ url, success: result.status === 0 });
  } catch (err) {
    console.error(`Error processing ${url}:`, err.message);
    results.push({ url, success: false, error: err.message });
  }
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('BATCH COMPLETE');
console.log('='.repeat(60));
console.log(`Total: ${results.length}`);
console.log(`Success: ${results.filter(r => r.success).length}`);
console.log(`Failed: ${results.filter(r => !r.success).length}`);

const failed = results.filter(r => !r.success);
if (failed.length > 0) {
  console.log('\nFailed URLs:');
  failed.forEach(r => console.log(`  - ${r.url}`));
}
