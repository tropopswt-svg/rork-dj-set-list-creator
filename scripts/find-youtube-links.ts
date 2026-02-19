/**
 * Auto-find YouTube links for sets using YouTube Data API
 * Searches YouTube for each set and updates Supabase with the best match
 *
 * Run: bun run scripts/find-youtube-links.ts
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || process.env.EXPO_PUBLIC_YOUTUBE_API_KEY;

if (!YOUTUBE_API_KEY) {
  console.error('No YOUTUBE_API_KEY found in env');
  process.exit(1);
}

interface YouTubeSearchResult {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    publishedAt: string;
    description: string;
  };
}

// Trusted channels that upload official DJ sets
const TRUSTED_CHANNELS = [
  'Boiler Room',
  'Mixmag',
  'Cercle',
  'HATE',
  'Tomorrowland',
  'Ultra Music Festival',
  'Insomniac Events',
  'DJ Mag',
  'Resident Advisor',
  'Printworks London',
  'BBC Radio 1',
  'fabric',
  'Solid Grooves',
  'Defected Records',
  'Toolroom Records',
  'Circoloco',
  'elrow',
  'Drumcode',
  'Afterlife',
  'The Warehouse Project',
  'DGTL Festival',
  'Awakenings',
  'Dekmantel',
  'EDC',
  'Coachella',
  'Be-At.TV',
  'OUR MUSIC',
  'The Lot Radio',
  'HÖR Berlin',
];

async function searchYouTube(query: string, maxResults = 5): Promise<YouTubeSearchResult[]> {
  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults: String(maxResults),
    key: YOUTUBE_API_KEY!,
    videoCategoryId: '10', // Music category
  });

  const url = `https://www.googleapis.com/youtube/v3/search?${params}`;
  const response = await fetch(url);

  if (!response.ok) {
    const err = await response.text();
    console.error(`  YouTube API error: ${response.status} ${err}`);
    return [];
  }

  const data = await response.json();
  return data.items || [];
}

function buildSearchQuery(set: { dj_name: string; event_name?: string; venue?: string; event_date?: string }): string {
  const parts: string[] = [];

  // DJ name is always first
  parts.push(set.dj_name);

  // Add event context
  if (set.event_name) {
    // Special handling for well-known event series
    if (set.event_name.includes('Boiler Room')) {
      parts.push('Boiler Room');
    } else if (set.event_name.includes('Essential Mix')) {
      parts.push('Essential Mix BBC Radio 1');
    } else if (set.event_name.includes('Mixmag')) {
      parts.push('Mixmag Lab');
    } else {
      parts.push(set.event_name);
    }
  }

  if (set.venue && !set.event_name?.includes(set.venue)) {
    // Add venue if not redundant
    const shortVenue = set.venue.replace(/\s+(Stage|Room|Floor)$/i, '');
    parts.push(shortVenue);
  }

  // Add year from date
  if (set.event_date) {
    const year = set.event_date.substring(0, 4);
    parts.push(year);
  }

  // Add "DJ set" to help filter
  parts.push('DJ set');

  return parts.join(' ');
}

function scoreResult(
  result: YouTubeSearchResult,
  set: { dj_name: string; event_name?: string; venue?: string }
): number {
  let score = 0;
  const title = result.snippet.title.toLowerCase();
  const channel = result.snippet.channelTitle.toLowerCase();
  const djLower = set.dj_name.toLowerCase();

  // DJ name must be in the title
  if (!title.includes(djLower) && !title.includes(djLower.replace(/\s+/g, ''))) {
    return -1; // Disqualify
  }

  // Bonus for trusted channels
  for (const trusted of TRUSTED_CHANNELS) {
    if (channel.includes(trusted.toLowerCase())) {
      score += 50;
      break;
    }
  }

  // Bonus for matching event/venue in title
  if (set.event_name) {
    const eventLower = set.event_name.toLowerCase();
    if (title.includes(eventLower) || title.includes(eventLower.replace(/\s+/g, ''))) {
      score += 30;
    }
    // Partial match on key words
    const eventWords = eventLower.split(/\s+/).filter(w => w.length > 3);
    for (const word of eventWords) {
      if (title.includes(word)) score += 5;
    }
  }

  if (set.venue) {
    if (title.includes(set.venue.toLowerCase())) {
      score += 20;
    }
  }

  // Penalize clearly wrong content
  if (title.includes('reaction') || title.includes('review') || title.includes('tutorial')) {
    score -= 100;
  }

  // Bonus for longer videos (likely full sets, not clips)
  // We can't get duration from search results, but descriptions help
  const desc = result.snippet.description.toLowerCase();
  if (desc.includes('tracklist') || desc.includes('full set') || desc.includes('live set')) {
    score += 15;
  }

  return score;
}

async function findAndUpdateYouTubeLinks() {
  // Get all sets without YouTube URLs
  const { data: sets, error } = await supabase
    .from('sets')
    .select('id, title, dj_name, venue, event_name, event_date, youtube_url')
    .is('youtube_url', null)
    .order('event_date', { ascending: false });

  if (error) {
    console.error('Error fetching sets:', error);
    return;
  }

  if (!sets || sets.length === 0) {
    console.log('All sets already have YouTube links!');
    return;
  }

  console.log(`🔍 Searching YouTube for ${sets.length} sets...\n`);

  let found = 0;
  let notFound = 0;
  let apiCalls = 0;
  const quotaLimit = 90; // Stay under 100 units per run (each search = 100 units quota cost, so be careful)

  for (const set of sets) {
    if (apiCalls >= quotaLimit) {
      console.log(`\n⚠️  Approaching YouTube API quota limit (${apiCalls} calls). Stopping.`);
      console.log('   Run again later to continue.');
      break;
    }

    const query = buildSearchQuery(set);
    console.log(`🔎 ${set.dj_name} | ${set.event_name || set.venue || ''} | ${set.event_date || ''}`);
    console.log(`   Query: "${query}"`);

    const results = await searchYouTube(query, 5);
    apiCalls++;

    if (results.length === 0) {
      console.log('   ❌ No results\n');
      notFound++;
      continue;
    }

    // Score and rank results
    const scored = results
      .map(r => ({ result: r, score: scoreResult(r, set) }))
      .filter(r => r.score >= 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0 || scored[0].score < 10) {
      console.log('   ❌ No good match found');
      if (results.length > 0) {
        console.log(`   Best result was: "${results[0].snippet.title}" by ${results[0].snippet.channelTitle} (score: ${scored[0]?.score ?? 'disqualified'})`);
      }
      console.log('');
      notFound++;
      continue;
    }

    const best = scored[0].result;
    const youtubeUrl = `https://www.youtube.com/watch?v=${best.id.videoId}`;

    console.log(`   ✅ Found: "${best.snippet.title}"`);
    console.log(`   Channel: ${best.snippet.channelTitle} | Score: ${scored[0].score}`);
    console.log(`   URL: ${youtubeUrl}`);

    // Update in Supabase
    const { error: updateError } = await supabase
      .from('sets')
      .update({ youtube_url: youtubeUrl })
      .eq('id', set.id);

    if (updateError) {
      console.log(`   ⚠️  Failed to update: ${updateError.message}`);
    } else {
      found++;
    }
    console.log('');

    // Rate limit: 1 request per second
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('====================================');
  console.log(`✨ Done! Found ${found} YouTube links, ${notFound} not found.`);
  console.log(`   API calls used: ${apiCalls}`);
  console.log(`   Sets remaining without YouTube: ${sets.length - found - apiCalls + notFound}`);

  // Show final stats
  const { count: withYT } = await supabase
    .from('sets')
    .select('*', { count: 'exact', head: true })
    .not('youtube_url', 'is', null);

  const { count: total } = await supabase
    .from('sets')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📊 ${withYT}/${total} sets now have YouTube links`);
}

findAndUpdateYouTubeLinks().catch(console.error);
