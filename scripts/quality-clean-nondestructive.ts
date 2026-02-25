#!/usr/bin/env bun
/**
 * Non-destructive quality cleanup:
 * 1) Detect duplicate/near-duplicate tracks by normalized key (artist+title)
 * 2) Re-link set_tracks.track_id to canonical keeper track (does NOT delete tracks)
 * 3) Flag likely comment/junk rows in set_tracks as ID/public_status='id'
 *
 * Usage:
 *   bun scripts/quality-clean-nondestructive.ts
 *   bun scripts/quality-clean-nondestructive.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const dryRun = process.argv.includes('--dry-run');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

function norm(s = '') {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(extended mix|radio edit|club mix|original mix|vip|bootleg|remix|rework|edit)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreTrack(t: any) {
  return (
    (t.spotify_url ? 4 : 0) +
    (t.beatport_url ? 2 : 0) +
    (t.soundcloud_url ? 2 : 0) +
    (t.youtube_url ? 1 : 0) +
    (t.isrc ? 2 : 0) +
    (t.verified ? 2 : 0) +
    (t.times_played || 0)
  );
}

function looksLikeComment(trackTitle: string | null, artistName: string | null) {
  const t = (trackTitle || '').trim().toLowerCase();
  const a = (artistName || '').trim().toLowerCase();
  const joined = `${a} ${t}`.trim();
  if (!joined) return true;

  const commentPatterns = [
    /https?:\/\//,
    /www\./,
    /soundcloud\.com|youtube\.com|youtu\.be/,
    /anyone know|who knows|what track|what song|id\?|track id|need id|pls id|please id/,
    /tracklist|full set|timestamp|time stamp/,
    /🔥|🙌|😂|😍|💯|😮|🤯/,
    /^\d{1,2}:\d{2}$/, // plain timestamp accidentally parsed
  ];

  if (commentPatterns.some((re) => re.test(joined))) return true;

  // Very short nonsense tokens
  const badTokens = ['nice', 'wow', 'fire', 'banger', 'id', 'unknown', '???', '??'];
  if (badTokens.includes(t) || badTokens.includes(joined)) return true;

  // Overly long string likely comment text, not track metadata
  if (joined.length > 140) return true;

  return false;
}

async function fetchAll(table: string, columns: string) {
  const out: any[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + page - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < page) break;
  }
  return out;
}

async function main() {
  console.log(`Quality cleanup start (dryRun=${dryRun})`);

  const tracks = await fetchAll(
    'tracks',
    'id,title,artist_name,spotify_url,beatport_url,soundcloud_url,youtube_url,isrc,verified,times_played'
  );

  const setTracks = await fetchAll('set_tracks', 'id,track_id,track_title,artist_name,is_id,public_status');

  // 1) Build canonical map for duplicates
  const groups = new Map<string, any[]>();
  for (const t of tracks) {
    const key = `${norm(t.artist_name)}|||${norm(t.title)}`;
    if (!key || key === '|||') continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  const canonicalMap = new Map<string, string>();
  const duplicateGroups: any[] = [];

  for (const [key, group] of groups) {
    if (group.length <= 1) continue;
    group.sort((a, b) => scoreTrack(b) - scoreTrack(a));
    const keeper = group[0];
    const dupes = group.slice(1);
    for (const d of dupes) canonicalMap.set(d.id, keeper.id);
    duplicateGroups.push({ key, keeper: keeper.id, duplicates: dupes.map((d) => d.id), size: group.length });
  }

  // 2) Re-link set_tracks.track_id -> canonical keeper (non-destructive)
  const relinkTargets = setTracks
    .filter((st) => st.track_id && canonicalMap.has(st.track_id))
    .map((st) => ({ id: st.id, from: st.track_id, to: canonicalMap.get(st.track_id)! }));

  let relinked = 0;
  if (!dryRun) {
    for (const row of relinkTargets) {
      const { error } = await supabase
        .from('set_tracks')
        .update({ track_id: row.to })
        .eq('id', row.id)
        .eq('track_id', row.from);
      if (!error) relinked++;
    }
  }

  // 3) Flag likely comments/junk as ID rows
  const junkCandidates = setTracks.filter((st) => looksLikeComment(st.track_title, st.artist_name));

  let junkFlagged = 0;
  if (!dryRun) {
    for (const row of junkCandidates) {
      const { error } = await supabase
        .from('set_tracks')
        .update({ is_id: true, public_status: 'id' })
        .eq('id', row.id)
        .neq('is_id', true);
      if (!error) junkFlagged++;
    }
  }

  const report = {
    at: new Date().toISOString(),
    dryRun,
    tracksTotal: tracks.length,
    setTracksTotal: setTracks.length,
    duplicateGroups: duplicateGroups.length,
    duplicateTrackIds: canonicalMap.size,
    setTrackRelinkTargets: relinkTargets.length,
    setTracksRelinked: dryRun ? relinkTargets.length : relinked,
    junkCandidates: junkCandidates.length,
    junkFlagged: dryRun ? junkCandidates.length : junkFlagged,
    sampleDuplicateGroups: duplicateGroups.slice(0, 25),
    sampleJunk: junkCandidates.slice(0, 25).map((j) => ({ id: j.id, artist_name: j.artist_name, track_title: j.track_title })),
  };

  const outDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `quality_cleanup_${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report, null, 2));
  console.log(`Saved report: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
