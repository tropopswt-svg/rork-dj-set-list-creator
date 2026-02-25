/**
 * Enrich set_tracks missing album_art_url using SoundCloud track search.
 * Deduplicates by artist+title so each unique pair is only searched once,
 * then updates all matching rows in a single batch update.
 *
 * Usage: bun run scripts/run-soundcloud-tracks.ts
 * Dry run: bun run scripts/run-soundcloud-tracks.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';

const DRY_RUN      = process.argv.includes('--dry-run');
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const DELAY_MS     = 300;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── SoundCloud client_id ──────────────────────────────────────────────────────

async function fetchClientId(): Promise<string | null> {
  try {
    const home = await fetch('https://soundcloud.com', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!home.ok) return null;
    const html = await home.text();
    const pattern = /<script crossorigin src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g;
    const urls: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(html)) !== null) urls.push(m[1]);
    if (!urls.length) return null;
    const js = await fetch(urls[urls.length - 1], { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!js.ok) return null;
    const body = await js.text();
    const match = body.match(/,client_id:"([^"]+)"/) || body.match(/client_id=([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  } catch { return null; }
}

// ── SoundCloud track search ───────────────────────────────────────────────────

function norm(s: string): string {
  return (s || '').toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

async function searchTrack(clientId: string, artist: string, title: string): Promise<string | null> {
  const res = await fetch(
    `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(`${artist} ${title}`)}&client_id=${clientId}&limit=5`,
    { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) return null;

  const data = await res.json() as any;
  const tracks: any[] = data.collection || [];

  // Strict: both artist and title must match
  for (const t of tracks) {
    const titleMatch = norm(t.title || '').includes(norm(title)) || norm(title).includes(norm(t.title || ''));
    const artistMatch = norm(t.user?.username || '').includes(norm(artist)) || norm(artist).includes(norm(t.user?.username || ''));
    if (titleMatch && artistMatch && t.artwork_url) {
      return t.artwork_url.replace('-large', '-t500x500');
    }
  }

  // Looser: just title match
  for (const t of tracks) {
    const titleMatch = norm(t.title || '').includes(norm(title)) || norm(title).includes(norm(t.title || ''));
    if (titleMatch && t.artwork_url) {
      return t.artwork_url.replace('-large', '-t500x500');
    }
  }

  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) console.log('⚠️  DRY RUN — no database changes will be made\n');
  console.log('=== SoundCloud Track Artwork Enrichment ===\n');

  process.stdout.write('Fetching SoundCloud client_id... ');
  const clientId = await fetchClientId();
  if (!clientId) { console.error('Failed'); return; }
  console.log(`got ${clientId.slice(0, 8)}…\n`);

  // Fetch all rows missing artwork (with their current spotify_data for merging).
  // Exclude is_unreleased=true: SoundCloud search for unreleased tracks returns
  // random rips/bootlegs with wrong art (e.g. a kid's profile picture).
  const { data: rows, error } = await supabase
    .from('set_tracks')
    .select('id, artist_name, track_title, spotify_data')
    .eq('is_id', false)
    .eq('is_unreleased', false)
    .not('artist_name', 'is', null)
    .not('track_title', 'is', null)
    .or('spotify_data.is.null,spotify_data->album_art_url.is.null')
    .neq('track_title', 'ID')
    .neq('track_title', 'Unknown');

  if (error) { console.error('DB error:', error.message); return; }
  if (!rows?.length) { console.log('Nothing to do.'); return; }

  console.log(`${rows.length} rows missing artwork (${new Set(rows.map(r => norm(r.artist_name) + '|||' + norm(r.track_title))).size} unique pairs)\n`);

  // Group rows by normalised artist+title key
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = norm(row.artist_name) + '|||' + norm(row.track_title);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  let found   = 0;
  let noMatch = 0;
  let updated = 0;
  let errors  = 0;
  let i       = 0;

  for (const [, group] of groups) {
    const { artist_name, track_title } = group[0];
    i++;

    try {
      await new Promise(r => setTimeout(r, DELAY_MS));
      const artUrl = await searchTrack(clientId, artist_name, track_title);

      if (artUrl) {
        found++;
        console.log(`  ✓ [${i}/${groups.size}] "${artist_name} - ${track_title}"`);

        if (!DRY_RUN) {
          // Update all rows in this group
          for (const row of group) {
            const existing = (row.spotify_data as any) || {};
            const { error: e } = await supabase
              .from('set_tracks')
              .update({
                spotify_data: {
                  ...existing,
                  album_art_url: artUrl,
                  album_art_small: artUrl.replace('-t500x500', '-large'),
                },
              })
              .eq('id', row.id);
            if (e) { console.error(`     ✗ row ${row.id}: ${e.message}`); errors++; }
            else updated++;
          }
        } else {
          updated += group.length;
        }
      } else {
        noMatch++;
        if (i % 50 === 0) {
          console.log(`  [${i}/${groups.size}] ${found} found, ${noMatch} no match so far`);
        }
      }
    } catch (err: any) {
      console.error(`  ✗ "${artist_name} - ${track_title}": ${err.message}`);
      errors++;
    }
  }

  console.log('\n=== FINAL RESULTS ===');
  console.log(`Found artwork:   ${found} unique pairs`);
  console.log(`Rows updated:    ${updated}${DRY_RUN ? ' [DRY RUN]' : ''}`);
  console.log(`No match:        ${noMatch}`);
  console.log(`Errors:          ${errors}`);

  const [total, withArt] = await Promise.all([
    supabase.from('set_tracks').select('id', { count: 'exact', head: true }).eq('is_id', false).not('artist_name', 'is', null).not('track_title', 'is', null),
    supabase.from('set_tracks').select('id', { count: 'exact', head: true }).eq('is_id', false).not('spotify_data->album_art_url', 'is', null),
  ]);
  console.log(`\nCoverage: ${withArt.count}/${total.count} tracks (${((withArt.count ?? 0) / (total.count ?? 1) * 100).toFixed(1)}%)`);
}

main().catch(console.error);
