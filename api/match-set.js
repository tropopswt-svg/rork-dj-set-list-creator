// API endpoint to match a URL against existing sets and fill in gaps
import { createClient } from '@supabase/supabase-js';
import { cleanTrackTitleUnreleased } from './_lib/track-utils.js';

function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

function normalizeText(text) {
  if (!text) return '';
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').trim();
}

function generateSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      description: 'POST with { url, identifiedTracks } to match and fill gaps in existing sets',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const { url, identifiedTracks } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    // Try to find an existing set by URL
    let existingSet = null;

    // Check YouTube URL
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const { data } = await supabase
        .from('sets')
        .select('*, set_tracks(*)')
        .eq('youtube_url', url)
        .single();
      if (data) existingSet = data;
    }

    // Check SoundCloud URL
    if (!existingSet && url.includes('soundcloud.com')) {
      const { data } = await supabase
        .from('sets')
        .select('*, set_tracks(*)')
        .eq('soundcloud_url', url)
        .single();
      if (data) existingSet = data;
    }

    // Check Mixcloud URL
    if (!existingSet && url.includes('mixcloud.com')) {
      const { data } = await supabase
        .from('sets')
        .select('*, set_tracks(*)')
        .eq('mixcloud_url', url)
        .single();
      if (data) existingSet = data;
    }

    // Check 1001Tracklists URL
    if (!existingSet && url.includes('1001tracklists.com')) {
      const { data } = await supabase
        .from('sets')
        .select('*, set_tracks(*)')
        .eq('tracklist_url', url)
        .single();
      if (data) existingSet = data;
    }

    const results = {
      setFound: !!existingSet,
      setId: existingSet?.id || null,
      setTitle: existingSet?.title || null,
      djName: existingSet?.dj_name || null,
      existingTracks: existingSet?.set_tracks?.length || 0,
      idTracks: 0,
      tracksUpdated: 0,
      tracksAdded: 0,
      newTracksCreated: 0,
      newArtistsCreated: 0,
    };

    if (existingSet) {
      // Count ID tracks
      results.idTracks = existingSet.set_tracks?.filter(t => t.is_id)?.length || 0;

      // If we have identified tracks from comments, try to fill gaps
      if (identifiedTracks && Array.isArray(identifiedTracks) && identifiedTracks.length > 0) {
        for (const identified of identifiedTracks) {
          if (!identified.title || !identified.artist) continue;

          // First, ensure the track exists in our tracks table
          const titleNormalized = normalizeText(identified.title);
          const artistSlug = generateSlug(identified.artist);

          // Check/create artist
          let artistId = null;
          const { data: existingArtist } = await supabase
            .from('artists')
            .select('id')
            .eq('slug', artistSlug)
            .single();

          if (existingArtist) {
            artistId = existingArtist.id;
          } else {
            const { data: newArtist } = await supabase
              .from('artists')
              .insert({ name: identified.artist, slug: artistSlug })
              .select('id')
              .single();
            if (newArtist) {
              artistId = newArtist.id;
              results.newArtistsCreated++;
            }
          }

          // Check/create track
          let trackId = null;
          const { data: existingTrack } = await supabase
            .from('tracks')
            .select('id')
            .eq('title_normalized', titleNormalized)
            .eq('artist_name', identified.artist)
            .single();

          if (existingTrack) {
            trackId = existingTrack.id;
          } else {
            const { data: newTrack } = await supabase
              .from('tracks')
              .insert({
                title: identified.title,
                title_normalized: titleNormalized,
                artist_id: artistId,
                artist_name: identified.artist,
                label: identified.label || null,
                bpm: identified.bpm || null,
                times_played: 1,
              })
              .select('id')
              .single();
            if (newTrack) {
              trackId = newTrack.id;
              results.newTracksCreated++;
            }
          }

          // Now try to match to an ID track in the set by timestamp
          if (identified.timestamp_seconds !== undefined && identified.timestamp_seconds !== null) {
            // Find ID track closest to this timestamp (within 30 seconds)
            const idTrack = existingSet.set_tracks?.find(t =>
              t.is_id &&
              Math.abs((t.timestamp_seconds || 0) - identified.timestamp_seconds) < 30
            );

            if (idTrack) {
              // Update the ID track with real info
              const { title: cleanTitle, isUnreleased } = cleanTrackTitleUnreleased(identified.title);
              const updateData = {
                track_id: trackId,
                artist_name: identified.artist,
                track_title: cleanTitle,
                is_id: false,
              };
              if (isUnreleased) {
                updateData.is_unreleased = true;
                updateData.unreleased_source = 'comment_hint';
              }
              const { error: updateError } = await supabase
                .from('set_tracks')
                .update(updateData)
                .eq('id', idTrack.id);

              if (!updateError) {
                results.tracksUpdated++;
                // Remove from set_tracks so we don't match again
                existingSet.set_tracks = existingSet.set_tracks.filter(t => t.id !== idTrack.id);
              }
            } else {
              // No ID track at this timestamp, but we can add it as a new track in the set
              // Find the right position based on timestamp
              let position = existingSet.set_tracks?.length + 1 || 1;
              for (const t of existingSet.set_tracks || []) {
                if ((t.timestamp_seconds || 0) > identified.timestamp_seconds) {
                  position = t.position;
                  break;
                }
              }

              // Check if we already have a track at this position
              const existsAtPosition = existingSet.set_tracks?.some(t =>
                Math.abs((t.timestamp_seconds || 0) - identified.timestamp_seconds) < 10
              );

              if (!existsAtPosition) {
                const { title: cleanInsertTitle, isUnreleased: insertUnreleased } = cleanTrackTitleUnreleased(identified.title);
                const insertData = {
                  set_id: existingSet.id,
                  track_id: trackId,
                  artist_name: identified.artist,
                  track_title: cleanInsertTitle,
                  position: position,
                  timestamp_seconds: identified.timestamp_seconds,
                  timestamp_str: identified.timestamp_str || null,
                  is_id: false,
                };
                if (insertUnreleased) {
                  insertData.is_unreleased = true;
                  insertData.unreleased_source = 'comment_hint';
                }
                await supabase.from('set_tracks').insert(insertData);
                results.tracksAdded++;
              }
            }
          }
        }

        // Update track count on set
        const { count } = await supabase
          .from('set_tracks')
          .select('*', { count: 'exact', head: true })
          .eq('set_id', existingSet.id);

        await supabase
          .from('sets')
          .update({ track_count: count, updated_at: new Date().toISOString() })
          .eq('id', existingSet.id);
      }

      // Get updated set_tracks
      const { data: updatedTracks } = await supabase
        .from('set_tracks')
        .select('*')
        .eq('set_id', existingSet.id)
        .order('position', { ascending: true });

      results.tracklist = updatedTracks || [];
      results.remainingIds = updatedTracks?.filter(t => t.is_id)?.length || 0;
    }

    return res.status(200).json({
      success: true,
      ...results,
    });

  } catch (error) {
    console.error('Match set error:', error);
    return res.status(500).json({ error: error.message });
  }
}
