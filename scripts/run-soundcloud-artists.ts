/**
 * Enrich artists missing image_url using SoundCloud user search.
 * Searches for each artist by name, matches on normalized username,
 * and stores the avatar_url (upgraded to t500x500) + soundcloud_url.
 *
 * Usage: bun run scripts/run-soundcloud-artists.ts
 * Dry run: bun run scripts/run-soundcloud-artists.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';

const DRY_RUN      = process.argv.includes('--dry-run');
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const DELAY_MS     = 300;   // ~3 req/sec — SoundCloud is lenient
const BATCH_SIZE   = 200;

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
  } catch {
    return null;
  }
}

// ── SoundCloud artist search ──────────────────────────────────────────────────

function norm(s: string): string {
  return (s || '').toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

async function searchArtist(clientId: string, name: string) {
  const res = await fetch(
    `https://api-v2.soundcloud.com/search/users?q=${encodeURIComponent(name)}&client_id=${clientId}&limit=5`,
    { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) return null;

  const data = await res.json() as any;
  for (const user of data.collection || []) {
    const un = user.username || '';
    const match =
      norm(un) === norm(name) ||
      norm(un).includes(norm(name)) ||
      norm(name).includes(norm(un));
    if (match) {
      return {
        username:      user.username,
        avatar_url:    user.avatar_url ? user.avatar_url.replace('-large', '-t500x500') : null,
        permalink_url: user.permalink_url || `https://soundcloud.com/${user.permalink}`,
        followers:     user.followers_count || 0,
      };
    }
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) console.log('⚠️  DRY RUN — no database changes will be made\n');
  console.log('=== SoundCloud Artist Thumbnail Enrichment ===\n');

  // Fetch SoundCloud client_id
  process.stdout.write('Fetching SoundCloud client_id... ');
  const clientId = await fetchClientId();
  if (!clientId) { console.error('Failed — could not extract client_id from SoundCloud'); return; }
  console.log(`got ${clientId.slice(0, 8)}…\n`);

  const { count } = await supabase
    .from('artists')
    .select('id', { count: 'exact', head: true })
    .or('image_url.is.null,image_url.eq.');

  console.log(`Found ${count} artists without thumbnails\n`);

  let offset  = 0;
  let found   = 0;
  let noMatch = 0;
  let errors  = 0;

  while (true) {
    const { data: artists, error } = await supabase
      .from('artists')
      .select('id, name, image_url, soundcloud_url')
      .or('image_url.is.null,image_url.eq.')
      .order('name')
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) { console.error('DB error:', error.message); break; }
    if (!artists || artists.length === 0) break;

    console.log(`--- Batch ${Math.floor(offset / BATCH_SIZE) + 1}: ${offset + 1}–${offset + artists.length} ---`);

    for (const artist of artists) {
      if (!artist.name) { noMatch++; continue; }

      try {
        await new Promise(r => setTimeout(r, DELAY_MS));
        const sc = await searchArtist(clientId, artist.name);

        if (sc && sc.avatar_url) {
          console.log(`  ✓ "${artist.name}" → ${sc.username} (${sc.followers.toLocaleString()} followers)`);
          if (!DRY_RUN) {
            const update: any = { image_url: sc.avatar_url };
            if (!artist.soundcloud_url) update.soundcloud_url = sc.permalink_url;
            const { error: e } = await supabase
              .from('artists').update(update).eq('id', artist.id);
            if (e) { console.error(`     ✗ ${e.message}`); errors++; }
            else found++;
          } else {
            found++;
          }
        } else if (sc) {
          // Found the user but no avatar
          console.log(`  ~ "${artist.name}" → found on SC but no avatar (${sc.username})`);
          if (!DRY_RUN && !artist.soundcloud_url) {
            await supabase.from('artists').update({ soundcloud_url: sc.permalink_url }).eq('id', artist.id);
          }
          noMatch++;
        } else {
          noMatch++;
        }
      } catch (err: any) {
        console.error(`  ✗ "${artist.name}": ${err.message}`);
        errors++;
      }
    }

    offset += artists.length;
    console.log(`  → Running total: ${found} found, ${noMatch} no match\n`);
    if (artists.length < BATCH_SIZE) break;
  }

  console.log('=== FINAL RESULTS ===');
  console.log(`Found + updated: ${found}${DRY_RUN ? ' [DRY RUN]' : ''}`);
  console.log(`No match:        ${noMatch}`);
  console.log(`Errors:          ${errors}`);

  // Final coverage
  const [total, withThumb] = await Promise.all([
    supabase.from('artists').select('id', { count: 'exact', head: true }),
    supabase.from('artists').select('id', { count: 'exact', head: true }).not('image_url', 'is', null).neq('image_url', ''),
  ]);
  console.log(`\nCoverage: ${withThumb.count}/${total.count} artists (${((withThumb.count ?? 0) / (total.count ?? 1) * 100).toFixed(1)}%)`);
}

main().catch(console.error);
