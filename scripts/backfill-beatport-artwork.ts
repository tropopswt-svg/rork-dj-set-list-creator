#!/usr/bin/env bun
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : 300;
const dryRun = process.argv.includes('--dry-run');

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
        'accept-language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (!m) return null;
    return m[1];
  } catch {
    return null;
  }
}

async function main() {
  const { data: rows, error } = await supabase
    .from('tracks')
    .select('id,title,artist_name,beatport_url,artwork_url')
    .not('beatport_url', 'is', null)
    .is('artwork_url', null)
    .limit(limit);

  if (error) throw error;
  const tracks = rows || [];
  console.log(`Found ${tracks.length} tracks with beatport_url and missing artwork`);

  let updated = 0;
  let missed = 0;

  for (const t of tracks) {
    const img = await fetchOgImage(t.beatport_url);
    if (!img) {
      missed++;
      continue;
    }

    if (!dryRun) {
      const { error: uerr } = await supabase
        .from('tracks')
        .update({ artwork_url: img, enriched_at: new Date().toISOString() })
        .eq('id', t.id);
      if (uerr) {
        missed++;
        continue;
      }
    }

    updated++;
    if (updated % 20 === 0) console.log(`Updated ${updated}...`);
  }

  console.log(JSON.stringify({ scanned: tracks.length, updated, missed, dryRun }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
