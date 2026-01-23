/**
 * Import CSV data into the app's mock data
 * 
 * Usage:
 *   bun import path/to/file.csv
 *   
 * Or paste CSV directly:
 *   bun import
 *   (paste CSV, then type "Complete" on a new line when done)
 * 
 * Auto-enhancement:
 *   After import, automatically scrapes SoundCloud/YouTube comments
 *   to find additional tracks not in the original tracklist.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// ============ Comment Scraping Functions ============

function parseTimestampFromText(text: string): string | null {
  const patterns = [
    /(\d{1,2}:\d{2}:\d{2})/,
    /(\d{1,2}:\d{2})/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function extractTrackFromComment(comment: string): { artist?: string; title?: string; timestamp?: string } | null {
  const timestamp = parseTimestampFromText(comment);
  
  const patterns = [
    /(?:track(?:list)?|id|song)[:\s]+([^@\n]+?)(?:\s*[-–]\s*|\s+by\s+)([^@\n]+)/i,
    /([^@\n]+?)\s*[-–]\s*([^@\n]+?)(?:\s+at\s+|\s*@\s*)?\d/i,
    /"([^"]+)"\s*(?:by|-)\s*([^@\n]+)/i,
    /([A-Z][^\-–]+?)\s*[-–]\s*([^@\n]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = comment.match(pattern);
    if (match && match[1] && match[2]) {
      const part1 = match[1].trim();
      const part2 = match[2].trim();
      if (part1.length > 2 && part2.length > 2 && part1.length < 100 && part2.length < 100) {
        return { artist: part1, title: part2, timestamp: timestamp || undefined };
      }
    }
  }
  return timestamp ? { timestamp } : null;
}

interface ScrapedTrackInfo {
  title: string;
  artist: string;
  timestamp: string;
  source: string;
}

async function fetchSoundCloudComments(soundcloudUrl: string): Promise<ScrapedTrackInfo[]> {
  console.error(`[Enhance] Fetching SoundCloud comments for: ${soundcloudUrl}`);
  const tracks: ScrapedTrackInfo[] = [];
  
  try {
    const response = await fetch(soundcloudUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    
    if (response.ok) {
      const html = await response.text();
      const hydrationMatch = html.match(/window\.__sc_hydration\s*=\s*(\[.*?\]);/s);
      
      if (hydrationMatch) {
        try {
          const hydrationData = JSON.parse(hydrationMatch[1]);
          const seen = new Set<string>();
          
          for (const item of hydrationData) {
            if (item.hydratable === 'comment' || item.data?.comments) {
              const commentsData = item.data?.comments || item.data;
              if (Array.isArray(commentsData)) {
                for (const c of commentsData) {
                  if (c.body) {
                    const extracted = extractTrackFromComment(c.body);
                    if (extracted?.artist && extracted?.title) {
                      const key = `${extracted.artist.toLowerCase()}-${extracted.title.toLowerCase()}`;
                      if (!seen.has(key)) {
                        seen.add(key);
                        tracks.push({
                          title: extracted.title,
                          artist: extracted.artist,
                          timestamp: extracted.timestamp || '0:00',
                          source: `SoundCloud comment by ${c.user?.username || 'Unknown'}`,
                        });
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error('[Enhance] Error parsing SoundCloud data:', e);
        }
      }
    }
  } catch (error) {
    console.error('[Enhance] SoundCloud fetch error:', error);
  }
  
  console.error(`[Enhance] Found ${tracks.length} potential tracks from comments`);
  return tracks;
}

async function fetchYouTubeComments(videoId: string): Promise<ScrapedTrackInfo[]> {
  console.error(`[Enhance] Fetching YouTube comments for: ${videoId}`);
  const tracks: ScrapedTrackInfo[] = [];
  
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(watchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    
    if (response.ok) {
      const html = await response.text();
      const seen = new Set<string>();
      
      // Check video description for tracklist
      const descriptionMatch = html.match(/"description":\{"simpleText":"([^"]+)"\}/);
      if (descriptionMatch) {
        const description = descriptionMatch[1].replace(/\\n/g, '\n').replace(/\\u0026/g, '&');
        const lines = description.split('\n');
        
        for (const line of lines) {
          const timestamp = parseTimestampFromText(line);
          if (timestamp) {
            // Try to extract track info from timestamp line
            const trackMatch = line.match(/\d{1,2}:\d{2}(?::\d{2})?\s*[-–]?\s*(.+)/);
            if (trackMatch) {
              const trackText = trackMatch[1].trim();
              const parts = trackText.split(/\s*[-–]\s*/);
              if (parts.length >= 2) {
                const key = `${parts[0].toLowerCase()}-${parts[1].toLowerCase()}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  tracks.push({
                    artist: parts[0].trim(),
                    title: parts.slice(1).join(' - ').trim(),
                    timestamp,
                    source: 'YouTube description',
                  });
                }
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[Enhance] YouTube fetch error:', error);
  }
  
  console.error(`[Enhance] Found ${tracks.length} potential tracks from YouTube`);
  return tracks;
}

function extractVideoId(url: string): { platform: string; id: string } | null {
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/);
  if (youtubeMatch) return { platform: 'youtube', id: youtubeMatch[1] };
  
  const soundcloudMatch = url.match(/soundcloud\.com\/([^\/]+)\/([^\/?\s]+)/);
  if (soundcloudMatch) return { platform: 'soundcloud', id: `${soundcloudMatch[1]}/${soundcloudMatch[2]}` };
  
  return null;
}

async function enhanceSetWithComments(set: SetList): Promise<ScrapedTrackInfo[]> {
  const sourceUrl = set.sourceLinks[0]?.url;
  if (!sourceUrl) return [];
  
  const extracted = extractVideoId(sourceUrl);
  if (!extracted) return [];
  
  let scrapedTracks: ScrapedTrackInfo[] = [];
  
  if (extracted.platform === 'soundcloud') {
    scrapedTracks = await fetchSoundCloudComments(`https://soundcloud.com/${extracted.id}`);
  } else if (extracted.platform === 'youtube') {
    scrapedTracks = await fetchYouTubeComments(extracted.id);
  }
  
  // Filter out tracks that already exist in the set
  const existingTracks = new Set(
    set.tracks.map(t => `${t.artist.toLowerCase()}-${t.title.toLowerCase()}`)
  );
  
  return scrapedTracks.filter(t => {
    const key = `${t.artist.toLowerCase()}-${t.title.toLowerCase()}`;
    return !existingTracks.has(key);
  });
}

// ============ End Comment Scraping Functions ============

interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  bpm?: number;
  key?: string;
  coverUrl: string;
  addedAt: string;
  source: string;
  timestamp?: number;
  verified: boolean;
}

interface SetList {
  id: string;
  name: string;
  artist: string;
  venue?: string;
  date: string;
  tracks: Track[];
  coverUrl?: string;
  sourceLinks: { platform: string; url: string }[];
  totalDuration: number;
  aiProcessed: boolean;
  commentsScraped: number;
  tracksIdentified: number;
  plays: number;
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const next = csvText[i + 1];
    
    if (char === '"' && next === '"') {
      current += '"';
      i++;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(current.trim());
      current = '';
      if (row.some(v => v.length > 0)) rows.push(row);
      row = [];
      continue;
    }
    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (row.some(v => v.length > 0)) rows.push(row);
  }

  return rows;
}

function detectSourcePlatform(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  if (lower.includes('soundcloud.com')) return 'soundcloud';
  if (lower.includes('mixcloud.com')) return 'mixcloud';
  if (lower.includes('1001tracklists.com')) return '1001tracklists';
  return 'youtube';
}

function parseNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCsvToSets(csvText: string): SetList[] {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) return [];

  const headerRow = rows[0].map(h => h.toLowerCase().replace(/\s+/g, '_'));
  const headerIndex = new Map<string, number>();
  headerRow.forEach((h, i) => headerIndex.set(h, i));

  const get = (row: string[], key: string): string => {
    const idx = headerIndex.get(key);
    return idx !== undefined ? row[idx]?.trim() || '' : '';
  };

  const sets: SetList[] = [];
  let currentSet: SetList | null = null;
  let trackIndex = 0;
  const timestamp = Date.now();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowType = get(row, 'type').toUpperCase();

    if (rowType === 'SET') {
      if (currentSet && currentSet.name && currentSet.artist) {
        sets.push(currentSet);
      }

      const sourceUrl = get(row, 'set_source_url');
      const sourceLinks: { platform: string; url: string }[] = [];
      if (sourceUrl) {
        sourceLinks.push({ platform: detectSourcePlatform(sourceUrl), url: sourceUrl });
      }

      currentSet = {
        id: `imported-${timestamp}-${sets.length}`,
        name: get(row, 'set_name') || 'Untitled Set',
        artist: get(row, 'set_artist') || 'Unknown Artist',
        venue: get(row, 'set_venue') || undefined,
        date: get(row, 'set_date') || new Date().toISOString().split('T')[0],
        tracks: [],
        coverUrl: get(row, 'set_cover_url') || undefined,
        sourceLinks,
        totalDuration: 0,
        aiProcessed: false,
        commentsScraped: 0,
        tracksIdentified: 0,
        plays: Math.floor(Math.random() * 50000),
      };
      trackIndex = 0;

    } else if (rowType === 'TRACK' && currentSet) {
      let trackTitle = get(row, 'track_title');
      let trackArtist = get(row, 'track_artist');

      // Handle combined "Artist - Title" format
      if (trackTitle && (!trackArtist || trackArtist === 'Unknown')) {
        const parts = trackTitle.split(' - ');
        if (parts.length >= 2) {
          trackArtist = parts[0].trim();
          trackTitle = parts.slice(1).join(' - ').trim();
        }
      }

      if (trackTitle) {
        const timestampSecs = parseNumber(get(row, 'timestamp_seconds')) || 0;
        const duration = parseNumber(get(row, 'duration_seconds')) || 0;

        currentSet.tracks.push({
          id: `track-${timestamp}-${sets.length}-${trackIndex}`,
          title: trackTitle,
          artist: trackArtist || 'Unknown',
          album: get(row, 'album') || undefined,
          duration,
          bpm: parseNumber(get(row, 'bpm')),
          key: get(row, 'key') || undefined,
          coverUrl: get(row, 'track_cover_url') || currentSet.coverUrl || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
          addedAt: new Date().toISOString(),
          source: 'manual',
          timestamp: timestampSecs,
          verified: false,
        });
        trackIndex++;
      }
    }
  }

  // Don't forget last set
  if (currentSet && currentSet.name && currentSet.artist) {
    currentSet.tracksIdentified = currentSet.tracks.length;
    currentSet.totalDuration = currentSet.tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
    sets.push(currentSet);
  }

  // Update track counts for all sets
  sets.forEach(set => {
    set.tracksIdentified = set.tracks.length;
    set.totalDuration = set.tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
  });

  return sets;
}

function generateMockCode(sets: SetList[]): string {
  const lines: string[] = [];
  
  lines.push('// Auto-generated imported sets');
  lines.push(`// Generated: ${new Date().toISOString()}`);
  lines.push('');
  
  for (const set of sets) {
    lines.push(`  {`);
    lines.push(`    id: '${set.id}',`);
    lines.push(`    name: '${set.name.replace(/'/g, "\\'")}',`);
    lines.push(`    artist: '${set.artist.replace(/'/g, "\\'")}',`);
    if (set.venue) lines.push(`    venue: '${set.venue.replace(/'/g, "\\'")}',`);
    lines.push(`    date: new Date('${set.date}'),`);
    lines.push(`    tracks: [`);
    
    for (const track of set.tracks) {
      lines.push(`      {`);
      lines.push(`        id: '${track.id}',`);
      lines.push(`        title: '${track.title.replace(/'/g, "\\'")}',`);
      lines.push(`        artist: '${track.artist.replace(/'/g, "\\'")}',`);
      if (track.album) lines.push(`        album: '${track.album.replace(/'/g, "\\'")}',`);
      lines.push(`        duration: ${track.duration},`);
      if (track.bpm) lines.push(`        bpm: ${track.bpm},`);
      if (track.key) lines.push(`        key: '${track.key}',`);
      lines.push(`        coverUrl: '${track.coverUrl}',`);
      lines.push(`        addedAt: new Date('${track.addedAt}'),`);
      lines.push(`        source: 'manual' as const,`);
      if (track.timestamp) lines.push(`        timestamp: ${track.timestamp},`);
      lines.push(`        verified: false,`);
      lines.push(`      },`);
    }
    
    lines.push(`    ],`);
    if (set.coverUrl) lines.push(`    coverUrl: '${set.coverUrl}',`);
    lines.push(`    sourceLinks: ${JSON.stringify(set.sourceLinks)},`);
    lines.push(`    totalDuration: ${set.totalDuration},`);
    lines.push(`    aiProcessed: false,`);
    lines.push(`    commentsScraped: 0,`);
    lines.push(`    tracksIdentified: ${set.tracksIdentified},`);
    lines.push(`    plays: ${set.plays},`);
    lines.push(`  },`);
  }
  
  return lines.join('\n');
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });
    
    let data = '';
    
    rl.on('line', (line: string) => {
      if (line.trim().toLowerCase() === 'complete') {
        rl.close();
      } else {
        data += line + '\n';
      }
    });
    
    rl.on('close', () => {
      resolve(data);
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  let csvText = '';

  if (args.length > 0 && !args[0].startsWith('--')) {
    // Read from file
    const filePath = args[0];
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    csvText = fs.readFileSync(filePath, 'utf8');
  } else {
    // Read from stdin
    console.error('Paste CSV data below (type "Complete" on a new line when done):');
    csvText = await readStdin();
  }

  if (!csvText.trim()) {
    console.error('No CSV data provided');
    process.exit(1);
  }

  const sets = parseCsvToSets(csvText);

  if (sets.length === 0) {
    console.error('No valid sets found in CSV');
    process.exit(1);
  }

  console.error(`\n✓ Parsed ${sets.length} set(s) with ${sets.reduce((sum, s) => sum + s.tracks.length, 0)} total tracks\n`);

  // Auto-enhance sets by scraping comments for missing tracks
  const skipEnhance = args.includes('--no-enhance');
  
  if (!skipEnhance) {
    console.error('🔍 Enhancing sets with comment data...\n');
    
    for (const set of sets) {
      if (set.sourceLinks.length > 0) {
        console.error(`   Checking: ${set.name}`);
        const newTracks = await enhanceSetWithComments(set);
        
        if (newTracks.length > 0) {
          console.error(`   ✓ Found ${newTracks.length} additional track(s) from comments`);
          
          // Add new tracks to the set
          const timestamp = Date.now();
          newTracks.forEach((track, idx) => {
            set.tracks.push({
              id: `track-enhanced-${timestamp}-${idx}`,
              title: track.title,
              artist: track.artist,
              duration: 0,
              coverUrl: set.coverUrl || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
              addedAt: new Date().toISOString(),
              source: 'ai',
              timestamp: 0,
              verified: false,
            });
          });
          
          set.tracksIdentified = set.tracks.length;
        } else {
          console.error(`   No additional tracks found`);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.error('');
  }

  // Read existing mocks file
  const mocksPath = path.join(__dirname, '..', 'mocks', 'tracks.ts');
  let mocksContent = fs.readFileSync(mocksPath, 'utf8');

  // Find the mockSetLists array and append new sets
  const mockSetListsMatch = mocksContent.match(/export const mockSetLists: SetList\[\] = \[/);
  
  if (!mockSetListsMatch) {
    console.error('Could not find mockSetLists in mocks/tracks.ts');
    process.exit(1);
  }

  const insertPosition = mockSetListsMatch.index! + mockSetListsMatch[0].length;
  const newMockCode = '\n' + generateMockCode(sets);
  
  mocksContent = mocksContent.slice(0, insertPosition) + newMockCode + mocksContent.slice(insertPosition);

  // Write updated mocks file
  fs.writeFileSync(mocksPath, mocksContent);

  console.error(`✓ Added ${sets.length} set(s) to mocks/tracks.ts`);
  console.error('\nRestart your app to see the imported sets.');
  
  // Print summary
  sets.forEach((set, i) => {
    console.error(`\n${i + 1}. ${set.name}`);
    console.error(`   Artist: ${set.artist}`);
    console.error(`   Tracks: ${set.tracks.length}`);
  });
}

main().catch(console.error);
