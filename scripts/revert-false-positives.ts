/**
 * Revert known false positive Deezer matches from the first validation run.
 *
 * The first run used incorrect matching (didn't clean Deezer result titles),
 * producing at least one confirmed false positive:
 *   - "Bullet Tooth - Good Life" matched "A Place You Wanna Go (Good Life)"
 *
 * This script sets those tracks back to is_unreleased=true and clears
 * the bad Deezer metadata.
 *
 * Usage: bun run scripts/revert-false-positives.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Known false positives to revert: [artist_name, track_title]
const FALSE_POSITIVES: [string, string][] = [
  ['Bullet Tooth', 'Good Life'],
];

async function main() {
  console.log('=== Reverting false positive Deezer matches ===\n');

  for (const [artist, title] of FALSE_POSITIVES) {
    console.log(`Looking up: "${artist} - ${title}"...`);

    const { data: tracks, error } = await supabase
      .from('set_tracks')
      .select('id, artist_name, track_title, is_unreleased, spotify_data')
      .eq('artist_name', artist)
      .eq('track_title', title);

    if (error) {
      console.error(`  DB error: ${error.message}`);
      continue;
    }

    if (!tracks || tracks.length === 0) {
      console.log(`  Not found — may already have been reverted or never existed.`);
      continue;
    }

    for (const track of tracks) {
      const existing = (track.spotify_data as any) || {};
      const wasWronglyFlipped = existing.deezer_confidence === 'strong' || existing.deezer_confidence === 'exact';

      if (!wasWronglyFlipped) {
        console.log(`  Row ${track.id}: no deezer_confidence found — skipping.`);
        continue;
      }

      // Remove Deezer fields added by the false match, restore is_unreleased
      const {
        title: _t,
        artist: _a,
        album: _al,
        album_art_url,
        album_art_small,
        preview_url,
        deezer_preview_url,
        deezer_id,
        deezer_url,
        isrc,
        release_date,
        duration_ms,
        deezer_confidence,
        source,
        ...rest
      } = existing;

      // Only keep fields that weren't from this bad Deezer import
      // (if there was no prior spotify data, rest will be empty)
      const cleanedData = Object.keys(rest).length > 0 ? rest : null;

      const { error: updateErr } = await supabase
        .from('set_tracks')
        .update({
          is_unreleased: true,
          spotify_data: cleanedData,
        })
        .eq('id', track.id);

      if (updateErr) {
        console.error(`  Row ${track.id}: update failed — ${updateErr.message}`);
      } else {
        console.log(`  ✓ Row ${track.id}: reverted "${artist} - ${title}" → is_unreleased=true`);
        if (cleanedData) {
          console.log(`    Retained pre-existing spotify_data fields: ${Object.keys(cleanedData).join(', ')}`);
        } else {
          console.log(`    spotify_data cleared (was only Deezer data)`);
        }
      }
    }
  }

  console.log('\nDone.');
}

main().catch(console.error);
