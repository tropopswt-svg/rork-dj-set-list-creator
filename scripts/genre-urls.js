#!/usr/bin/env node
/**
 * House Music Genre URLs for Bulk Import
 *
 * Lists all the house music pages on 1001Tracklists, Beatport, and SoundCloud
 * that you can visit with the Chrome extension to import top tracks.
 *
 * Run with: node scripts/genre-urls.js
 */

// ============================================
// 1001TRACKLISTS GENRES
// ============================================
const TRACKLISTS_GENRES = [
  { id: 1, name: 'House', slug: 'house' },
  { id: 17, name: 'Deep House', slug: 'deep-house' },
  { id: 7, name: 'Tech House', slug: 'tech-house' },
  { id: 5, name: 'Progressive House', slug: 'progressive-house' },
  { id: 90, name: 'Melodic House & Techno', slug: 'melodic-house-techno' },
  { id: 89, name: 'Afro House', slug: 'afro-house' },
  { id: 95, name: 'Organic House / Downtempo', slug: 'organic-house-downtempo' },
  { id: 4, name: 'Electro House', slug: 'electro-house' },
  { id: 91, name: 'Bass House', slug: 'bass-house' },
  { id: 14, name: 'Funky / Groove / Jackin House', slug: 'funky-groove-jackin-house' },
  { id: 39, name: 'Nu Disco / Disco', slug: 'nu-disco-disco' },
  { id: 6, name: 'Minimal / Deep Tech', slug: 'minimal-deep-tech' },
  { id: 2, name: 'Techno', slug: 'techno' },
];

// ============================================
// BEATPORT GENRES
// ============================================
const BEATPORT_GENRES = [
  { slug: 'house', name: 'House' },
  { slug: 'deep-house', name: 'Deep House' },
  { slug: 'tech-house', name: 'Tech House' },
  { slug: 'progressive-house', name: 'Progressive House' },
  { slug: 'melodic-house-techno', name: 'Melodic House & Techno' },
  { slug: 'afro-house', name: 'Afro House' },
  { slug: 'organic-house-downtempo', name: 'Organic House / Downtempo' },
  { slug: 'funky-house', name: 'Funky House' },
  { slug: 'jackin-house', name: 'Jackin House' },
  { slug: 'nu-disco-disco', name: 'Nu Disco / Disco' },
  { slug: 'minimal-deep-tech', name: 'Minimal / Deep Tech' },
  { slug: 'electro-house', name: 'Electro House' },
  { slug: 'bass-house', name: 'Bass House' },
  { slug: 'techno-peak-time-driving', name: 'Peak Time Techno' },
  { slug: 'techno-raw-deep-hypnotic', name: 'Raw / Deep / Hypnotic Techno' },
];

// ============================================
// SOUNDCLOUD GENRES
// ============================================
const SOUNDCLOUD_GENRES = [
  { slug: 'house', name: 'House' },
  { slug: 'deep-house', name: 'Deep House' },
  { slug: 'tech-house', name: 'Tech House' },
  { slug: 'progressive-house', name: 'Progressive House' },
  { slug: 'electronic', name: 'Electronic' },
  { slug: 'techno', name: 'Techno' },
  { slug: 'disco', name: 'Disco' },
];

// Parse args
const args = process.argv.slice(2);
const showAll = args.includes('--all');
const showBeatport = args.includes('--beatport') || showAll || args.length === 0;
const showSoundcloud = args.includes('--soundcloud') || showAll;
const show1001 = args.includes('--1001') || showAll || args.length === 0;

console.log('='.repeat(70));
console.log('House Music Genre URLs for Bulk Import');
console.log('='.repeat(70));
console.log('');
console.log('Visit these URLs with the Chrome extension active.');
console.log('Click the "TRACK\'D" button on each page to import tracks.');
console.log('');
console.log('Usage: node scripts/genre-urls.js [--beatport] [--soundcloud] [--1001] [--all]');
console.log('');

if (show1001) {
  console.log('='.repeat(70));
  console.log('1001TRACKLISTS - Charts (Tracks Only, No Sets)');
  console.log('='.repeat(70));
  console.log('');

  console.log('Weekly Charts:');
  console.log('  https://www.1001tracklists.com/charts/weekly/index.html');
  console.log('');
  console.log('Monthly Charts:');
  console.log('  https://www.1001tracklists.com/charts/monthly/index.html');
  console.log('');
  console.log('Yearly Charts:');
  console.log('  https://www.1001tracklists.com/charts/yearly/index.html');
  console.log('');

  console.log('Genre Pages:');
  TRACKLISTS_GENRES.forEach(genre => {
    console.log(`  ${genre.name}: https://www.1001tracklists.com/genre/${genre.id}/${genre.slug}/index.html`);
  });
  console.log('');
}

if (showBeatport) {
  console.log('='.repeat(70));
  console.log('BEATPORT - Top 100 Charts by Genre');
  console.log('='.repeat(70));
  console.log('');

  BEATPORT_GENRES.forEach(genre => {
    console.log(`${genre.name}:`);
    console.log(`  https://www.beatport.com/genre/${genre.slug}/top-100`);
  });
  console.log('');

  console.log('BEATPORT - Hype Charts (New & Rising):');
  console.log('');
  ['house', 'deep-house', 'tech-house', 'melodic-house-techno', 'afro-house'].forEach(slug => {
    console.log(`  https://www.beatport.com/genre/${slug}/hype-100`);
  });
  console.log('');
}

if (showSoundcloud) {
  console.log('='.repeat(70));
  console.log('SOUNDCLOUD - Charts by Genre');
  console.log('='.repeat(70));
  console.log('');

  console.log('Top 50 Charts:');
  SOUNDCLOUD_GENRES.forEach(genre => {
    console.log(`  ${genre.name}: https://soundcloud.com/charts/top?genre=${genre.slug}`);
  });
  console.log('');

  console.log('New & Hot Charts:');
  SOUNDCLOUD_GENRES.forEach(genre => {
    console.log(`  ${genre.name}: https://soundcloud.com/charts/new?genre=${genre.slug}`);
  });
  console.log('');

  console.log('Discover Pages:');
  console.log('  https://soundcloud.com/discover/sets/charts-top:house');
  console.log('  https://soundcloud.com/discover/sets/charts-top:deep-house');
  console.log('  https://soundcloud.com/discover/sets/charts-top:tech-house');
  console.log('  https://soundcloud.com/discover/sets/charts-top:techno');
  console.log('');
}

console.log('='.repeat(70));
console.log('TIP: Open multiple tabs and scrape in batch!');
console.log('');
console.log('For auto-import, enable "Auto-scrape" in the extension popup,');
console.log('then visit each URL - tracks will be imported automatically.');
console.log('='.repeat(70));
