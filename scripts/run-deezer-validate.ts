/**
 * Run Deezer re-validation against all is_unreleased=true set_tracks.
 * Uses stricter matching to avoid false positives for house music DB.
 *
 * Matching rules:
 *   - DJ edits are skipped entirely ("Jumbo (Chris Stussy Edit)" → skip)
 *   - BOTH query and Deezer title are parenthetical-stripped before comparison
 *     ("Good Life" never matches "A Place You Wanna Go (Good Life)")
 *   - Substring matches require ≥60% word-count ratio
 *     (short titles can't match longer unrelated titles)
 *   - Version coherence: "(X Remix)" won't match "(Y Remix)" for a different remixer
 *   - Only 'exact' and 'strong' confidence accepted
 *
 * Usage: bun run scripts/run-deezer-validate.ts
 * Dry run (no DB writes): bun run scripts/run-deezer-validate.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';

const DRY_RUN   = process.argv.includes('--dry-run');
const SUPABASE_URL  = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const DELAY_MS      = 150;  // ~6 req/sec — well under Deezer's 50/5s limit
const BATCH_SIZE    = 200;
const SUBSTRING_RATIO = 0.6; // shorter title must be ≥60% of longer by word count

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Matching helpers ─────────────────────────────────────────────────────────

function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(unreleased|free download|clip|preview|edit|remix|original mix)\b/gi, '')
    .trim();
}

/** Strip ALL parenthetical and bracketed sections from BOTH sides */
function cleanTitle(title: string): string {
  return (title || '')
    .replace(/\s*[\[(][^\])\[()]*[\])]\s*/g, '')
    .trim();
}

function hasSubstantialOverlap(a: string, b: string): boolean {
  const wa = a.split(' ').filter(Boolean).length;
  const wb = b.split(' ').filter(Boolean).length;
  if (wa === 0 || wb === 0) return false;
  const [shorter, longer] = wa <= wb ? [wa, wb] : [wb, wa];
  return shorter / longer >= SUBSTRING_RATIO;
}

/**
 * Returns true if the track title is a DJ edit (e.g. "Jumbo (Chris Stussy Edit)").
 * DJ edits are often unreleased tools — skip Deezer lookup entirely.
 */
function isDjEdit(title: string): boolean {
  return /\((?:[^)]*\s)?edit\)/i.test(title);
}

/**
 * Extracts a "(X Remix)" / "(X Mix)" / "(X Rework)" version tag from a raw title.
 * Used for version coherence: "(Chris Stussy Remix)" must not match "(Malin Genie Remix)".
 */
function extractRemixTag(title: string): string | null {
  const m = (title || '').match(/\(([^)]*(?:remix|rework|re-?edit|re-?work)[^)]*)\)/i);
  return m ? m[1].toLowerCase().trim() : null;
}

type Score = 'exact' | 'strong' | null;

function scoreMatch(deezerTrack: any, qa: string, qt: string, rawQueryTitle?: string): Score {
  // Clean BOTH sides before comparing — this is the key false-positive guard
  const nt = normalize(cleanTitle(deezerTrack.title || ''));
  const na = normalize(deezerTrack.artist?.name || '');

  if (!nt || !na || !qt || !qa) return null;

  // Version coherence for remix-tagged queries:
  //   "(Chris Stussy Remix)" must NOT match "(Malin Genie Remix)" — different remixes
  //   "(Chris Stussy Remix)" must NOT match base "First Night Out" — can't confirm specific remix
  //   "(MK Dub)" has no remix tag → no check → base track match is fine
  if (rawQueryTitle) {
    const qRemix = extractRemixTag(rawQueryTitle);
    const dRemix = extractRemixTag(deezerTrack.title || '');
    if (qRemix && (!dRemix || qRemix !== dRemix)) return null;
  }

  const titleExact  = nt === qt;
  const titleStrong = !titleExact &&
    (nt.includes(qt) || qt.includes(nt)) &&
    hasSubstantialOverlap(nt, qt);

  const artistExact  = na === qa;
  const artistStrong = !artistExact && (na.includes(qa) || qa.includes(na));

  if (titleExact && artistExact) return 'exact';
  if ((titleExact || titleStrong) && (artistExact || artistStrong)) return 'strong';
  return null;
}

async function searchDeezer(artist: string, title: string) {
  const ct = cleanTitle(title);
  const ca = cleanTitle(artist);
  if (!ct || !ca) return null;

  const qt = normalize(ct);
  const qa = normalize(ca);

  const queries = [
    `artist:"${ca}" track:"${ct}"`,
    `${ca} ${ct}`,
  ];

  let best: any   = null;
  let bestScore: Score = null;

  for (const q of queries) {
    try {
      const res = await fetch(
        `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=10`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) continue;
      const json = await res.json() as any;

      for (const track of (json?.data || [])) {
        const score = scoreMatch(track, qa, qt, title);
        if (!score) continue;
        if (!bestScore || (score === 'exact' && bestScore !== 'exact')) {
          bestScore = score;
          best      = track;
        }
        if (bestScore === 'exact') break;
      }
    } catch { /* continue */ }
    if (bestScore === 'exact') break;
  }

  if (!best) return null;

  return {
    deezerId:     best.id,
    deezerUrl:    best.link,
    title:        best.title,
    artist:       best.artist?.name,
    album:        best.album?.title,
    albumArtUrl:  best.album?.cover_big || best.album?.cover_medium || best.album?.cover,
    albumArtSmall:best.album?.cover_small,
    previewUrl:   best.preview || null,
    releaseDate:  best.release_date || null,
    duration:     best.duration || null,
    isrc:         best.isrc || null,
    confidence:   bestScore as 'exact' | 'strong',
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) console.log('⚠️  DRY RUN — no database changes will be made\n');
  console.log('=== Deezer Re-Validation (strict matching) ===\n');

  const { count } = await supabase
    .from('set_tracks')
    .select('id', { count: 'exact', head: true })
    .eq('is_unreleased', true)
    .eq('is_id', false)
    .not('artist_name', 'is', null)
    .not('track_title', 'is', null)
    .neq('track_title', 'ID')
    .neq('track_title', 'Unknown');

  console.log(`Found ${count} is_unreleased=true tracks to check\n`);

  let offset     = 0;
  let checked    = 0;
  let confirmed  = 0;
  let noMatch    = 0;
  let skipped    = 0;
  const hits: string[] = [];

  while (true) {
    const { data: tracks, error } = await supabase
      .from('set_tracks')
      .select('id, artist_name, track_title, spotify_data')
      .eq('is_unreleased', true)
      .eq('is_id', false)
      .not('artist_name', 'is', null)
      .not('track_title', 'is', null)
      .neq('track_title', 'ID')
      .neq('track_title', 'Unknown')
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) { console.error('DB error:', error.message); break; }
    if (!tracks || tracks.length === 0) break;

    console.log(`--- Batch ${Math.floor(offset / BATCH_SIZE) + 1}: rows ${offset + 1}–${offset + tracks.length} ---`);

    for (const track of tracks) {
      if (!track.artist_name || !track.track_title) { skipped++; continue; }

      // Skip DJ edits — they're often unreleased tools, not released tracks
      if (isDjEdit(track.track_title)) {
        console.log(`  → Skip (DJ edit): "${track.artist_name} - ${track.track_title}"`);
        skipped++;
        continue;
      }

      // Skip tracks already confirmed by Deezer with the new strict logic
      const existing = (track.spotify_data as any);
      if (existing?.deezer_confidence === 'exact' || existing?.deezer_confidence === 'strong') {
        skipped++;
        continue;
      }

      try {
        await new Promise(r => setTimeout(r, DELAY_MS));
        const match = await searchDeezer(track.artist_name, track.track_title);
        checked++;

        if (match) {
          const conf = match.confidence;
          const line = `  ✓ [${conf}] "${track.artist_name} - ${track.track_title}"\n         → "${match.artist} - ${match.title}" (${match.album || 'no album'})`;
          console.log(line);
          hits.push(line);

          if (!DRY_RUN) {
            const deezerData = {
              ...(existing || {}),
              title:           match.title,
              artist:          match.artist,
              album:           match.album,
              album_art_url:   match.albumArtUrl   || existing?.album_art_url,
              album_art_small: match.albumArtSmall  || existing?.album_art_small,
              preview_url:     match.previewUrl     || existing?.preview_url,
              deezer_preview_url: match.previewUrl,
              deezer_id:       match.deezerId,
              deezer_url:      match.deezerUrl,
              isrc:            match.isrc           || existing?.isrc,
              release_date:    match.releaseDate    || existing?.release_date,
              duration_ms:     match.duration ? match.duration * 1000 : existing?.duration_ms,
              source:          existing?.spotify_id ? existing.source : 'deezer',
              deezer_confidence: conf,
            };

            const { error: updateErr } = await supabase
              .from('set_tracks')
              .update({ spotify_data: deezerData, is_unreleased: false })
              .eq('id', track.id);

            if (updateErr) {
              console.error(`     ✗ DB error: ${updateErr.message}`);
            } else {
              confirmed++;
            }
          } else {
            confirmed++; // count for dry run reporting
          }
        } else {
          noMatch++;
        }
      } catch (err: any) {
        console.error(`  ✗ Error on "${track.artist_name} - ${track.track_title}": ${err.message}`);
      }
    }

    offset += tracks.length;
    if (tracks.length < BATCH_SIZE) break;
    console.log(`  → Running total: ${checked} checked, ${confirmed} confirmed\n`);
  }

  console.log('\n=== FINAL RESULTS ===');
  console.log(`Checked:   ${checked}`);
  console.log(`Confirmed: ${confirmed} (flipped to is_unreleased=false${DRY_RUN ? ' [DRY RUN]' : ''})`);
  console.log(`No match:  ${noMatch}`);
  console.log(`Skipped:   ${skipped} (already confirmed or invalid)`);

  if (hits.length === 0) console.log('\nNo new matches found.');
}

main().catch(console.error);
