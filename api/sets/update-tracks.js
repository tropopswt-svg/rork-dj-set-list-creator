// API endpoint to update set tracks with timestamps from YouTube/SoundCloud scraping
import { createClient } from '@supabase/supabase-js';
import { cleanTrackTitleUnreleased } from '../_lib/track-utils.js';

// Use service role key for server-side write operations (bypasses RLS)
function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  // Prefer service role key for write operations, fall back to anon key
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseKey = serviceKey || anonKey;

  console.log('[Supabase] Using service role key:', !!serviceKey);

  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

// Normalize strings for matching
function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Calculate similarity between two strings
function similarity(s1, s2) {
  const n1 = normalize(s1);
  const n2 = normalize(s2);
  if (n1 === n2) return 1;
  if (!n1 || !n2) return 0;

  // Check if one contains the other
  if (n1.includes(n2) || n2.includes(n1)) return 0.8;

  // Word overlap
  const words1 = new Set(n1.split(' '));
  const words2 = new Set(n2.split(' '));
  const intersection = [...words1].filter(w => words2.has(w));
  const union = new Set([...words1, ...words2]);
  return intersection.length / union.size;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    const { setId, tracks, source, coverUrl } = req.body;

    if (!setId) {
      return res.status(400).json({ error: 'setId is required' });
    }

    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      return res.status(400).json({ error: 'tracks array is required' });
    }

    // Get existing set tracks
    const { data: existingTracks, error: fetchError } = await supabase
      .from('set_tracks')
      .select('*')
      .eq('set_id', setId)
      .order('position', { ascending: true });

    if (fetchError) {
      return res.status(500).json({ error: fetchError.message });
    }

    if (!existingTracks || existingTracks.length === 0) {
      return res.status(404).json({ error: 'No tracks found for this set' });
    }

    const existingTrackCount = existingTracks.length;
    let updatedCount = 0;
    let newTracksAdded = 0;
    let confirmedCount = 0;
    let errorCount = 0;
    const matchThreshold = 0.6;

    // Source reliability ranking — never overwrite a more reliable source
    const SOURCE_RANK = { '1001tracklists': 10, 'tracklist': 8, 'database': 6, 'manual': 5, 'soundcloud': 3, 'youtube': 2, 'unknown': 0 };
    function sourceRank(s) { return SOURCE_RANK[s] || 0; }

    console.log(`[Update Tracks] Processing ${tracks.length} scraped tracks for set ${setId} (${existingTrackCount} existing)`);
    console.log(`[Update Tracks] First 3 scraped tracks:`, tracks.slice(0, 3).map(t => ({
      title: t.title,
      artist: t.artist,
      timestamp: t.timestamp,
    })));

    // For each scraped track, try to match with existing tracks
    for (const scrapedTrack of tracks) {
      // Handle both timestamp formats (seconds or object with timestamp property)
      const timestamp = typeof scrapedTrack.timestamp === 'number'
        ? scrapedTrack.timestamp
        : (scrapedTrack.timestamp_seconds || 0);

      let bestMatch = null;
      let bestScore = 0;

      for (const existingTrack of existingTracks) {
        // Calculate match score based on title and artist
        const titleScore = similarity(scrapedTrack.title, existingTrack.track_title);
        const artistScore = similarity(scrapedTrack.artist, existingTrack.artist_name);

        // Weight title higher than artist
        const score = titleScore * 0.7 + artistScore * 0.3;

        if (score > bestScore && score >= matchThreshold) {
          bestScore = score;
          bestMatch = existingTrack;
        }
      }

      if (bestMatch) {
        // Build update object — ADDITIVE ONLY: enhance, never downgrade
        const updateData = {};

        // Only upgrade source if the new one is MORE reliable (never downgrade)
        if (source && sourceRank(source) > sourceRank(bestMatch.source)) {
          updateData.source = source;
        }

        // Only update timestamp if we have a valid one AND the track doesn't already have one
        if (timestamp > 0) {
          if (!bestMatch.timestamp_seconds || bestMatch.timestamp_seconds === 0) {
            updateData.timestamp_seconds = timestamp;
            updateData.timestamp_str = scrapedTrack.timestampFormatted || formatTimestamp(timestamp);
            updateData.is_timed = true;
          }
          updatedCount++;
        } else {
          confirmedCount++;
        }

        // Only write to DB if there's something to update
        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from('set_tracks')
            .update(updateData)
            .eq('id', bestMatch.id);

          if (updateError) {
            // Log but CONTINUE — never stop processing because of one track
            console.log(`[Update Tracks] Update error for track ${bestMatch.id}:`, updateError);
            errorCount++;
          } else {
            console.log(`[Update Tracks] Matched "${scrapedTrack.title}" → "${bestMatch.track_title}" (score: ${bestScore.toFixed(2)}, ts: ${timestamp}s)`);
          }
        } else {
          console.log(`[Update Tracks] Confirmed "${scrapedTrack.title}" → "${bestMatch.track_title}" (no changes needed)`);
        }
      } else {
        // No match found - only add as new track if we have a timestamp
        if (timestamp > 0) {
          const position = existingTracks.length + newTracksAdded + 1;

          const { title: cleanScrapedTitle, isUnreleased: scrapedUnreleased } = cleanTrackTitleUnreleased(scrapedTrack.title || 'Unknown');
          const insertData = {
            set_id: setId,
            artist_name: scrapedTrack.artist || 'Unknown',
            track_title: cleanScrapedTitle,
            position: position,
            timestamp_seconds: timestamp,
            timestamp_str: scrapedTrack.timestampFormatted || formatTimestamp(timestamp),
            source: source || 'youtube',
            is_id: false,
            is_timed: true,
          };
          if (scrapedUnreleased) {
            insertData.is_unreleased = true;
            insertData.unreleased_source = 'comment_hint';
          }
          const { error: insertError } = await supabase
            .from('set_tracks')
            .insert(insertData);

          if (!insertError) {
            newTracksAdded++;
            console.log(`[Update Tracks] Added new track "${scrapedTrack.title}" at ${timestamp}s`);
          } else {
            console.log(`[Update Tracks] Insert error for "${scrapedTrack.title}":`, insertError);
            errorCount++;
          }
        } else {
          console.log(`[Update Tracks] No match for "${scrapedTrack.title}" and no timestamp, skipping`);
        }
      }
    }

    // Update the set with analysis info
    const setUpdateData = {};

    // Update coverUrl if provided and valid AND the set doesn't already have one
    if (coverUrl && coverUrl.startsWith('http')) {
      const { data: currentSet } = await supabase
        .from('sets')
        .select('cover_url')
        .eq('id', setId)
        .single();
      if (!currentSet?.cover_url) {
        setUpdateData.cover_url = coverUrl;
        console.log(`[Update Tracks] Setting cover URL to: ${coverUrl}`);
      }
    }

    // Always recount tracks from DB to get accurate count (never trust incremental math)
    const { count: actualTrackCount } = await supabase
      .from('set_tracks')
      .select('*', { count: 'exact', head: true })
      .eq('set_id', setId);

    if (actualTrackCount !== null) {
      setUpdateData.track_count = actualTrackCount;
    }

    // Mark the set as analyzed by this source
    if (source === 'youtube') {
      setUpdateData.youtube_analyzed = true;
    } else if (source === 'soundcloud') {
      setUpdateData.soundcloud_analyzed = true;
    }

    // Apply set updates
    if (Object.keys(setUpdateData).length > 0) {
      const { error: setUpdateError } = await supabase
        .from('sets')
        .update(setUpdateData)
        .eq('id', setId);

      if (setUpdateError) {
        console.log('[Update Tracks] Set update error:', setUpdateError);
      } else {
        console.log('[Update Tracks] Updated set with:', setUpdateData);
      }
    }

    // Safety check: verify we didn't lose tracks
    const finalTrackCount = actualTrackCount || existingTrackCount;
    if (finalTrackCount < existingTrackCount) {
      console.error(`[Update Tracks] SAFETY WARNING: Track count dropped from ${existingTrackCount} to ${finalTrackCount}!`);
    }

    console.log(`[Update Tracks] Complete: ${updatedCount} timestamped, ${confirmedCount} confirmed, ${newTracksAdded} new, ${errorCount} errors (${existingTrackCount} existing → ${finalTrackCount} total)`);

    return res.status(200).json({
      success: true,
      message: `Updated ${updatedCount} tracks with timestamps, confirmed ${confirmedCount} tracks, added ${newTracksAdded} new tracks`,
      updatedCount,
      confirmedCount,
      newTracksAdded,
      errorCount,
      existingTrackCount,
      finalTrackCount,
    });

  } catch (error) {
    console.error('Update tracks error:', error);
    return res.status(500).json({ error: error.message });
  }
}

function formatTimestamp(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
