// Chrome Extension Import API
// Receives scraped data from the extension and imports into Supabase

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Allow GET for testing
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'ok', 
      endpoint: 'chrome-import',
      supabaseConfigured: !!(supabaseUrl && supabaseKey)
    });
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Check Supabase config
  if (!supabaseUrl || !supabaseKey) {
    console.error('[Chrome Import] Supabase not configured');
    return res.status(500).json({ 
      error: 'Database not configured',
      message: 'Supabase credentials not found'
    });
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    const data = req.body;
    
    if (!data || (!data.tracks && !data.artists)) {
      return res.status(400).json({ error: 'No data provided' });
    }
    
    console.log(`[Chrome Import] Received from ${data.source}:`, {
      artists: data.artists?.length || 0,
      tracks: data.tracks?.length || 0,
      pageType: data.pageType,
      genreName: data.genreName || null,
    });
    
    const results = {
      artistsCreated: 0,
      artistsSkipped: 0,
      tracksCreated: 0,
      tracksSkipped: 0,
      setsCreated: 0,
      setsSkipped: 0,
      errors: [],
    };

    // Process set info (from 1001Tracklists)
    if (data.setInfo && data.source === '1001tracklists' && data.pageType === 'tracklist') {
      const setInfo = data.setInfo;
      const sourceUrl = data.sourceUrl;

      if (setInfo.title && setInfo.djName) {
        try {
          // Check if set already exists by source URL
          let existingSet = null;
          if (sourceUrl) {
            const { data: existing } = await supabase
              .from('sets')
              .select('id')
              .eq('tracklists_url', sourceUrl)
              .single();
            existingSet = existing;
          }

          if (existingSet) {
            results.setsSkipped++;
            console.log('[Chrome Import] Set already exists:', setInfo.title);
          } else {
            // Create the set
            const { data: newSet, error: setError } = await supabase
              .from('sets')
              .insert({
                title: setInfo.title,
                dj_name: setInfo.djName,
                venue: setInfo.venue || null,
                event_name: setInfo.eventName || null,
                set_date: setInfo.date || null,
                duration_seconds: setInfo.durationSeconds || null,
                track_count: data.tracks?.length || 0,
                tracklists_url: sourceUrl,
                soundcloud_url: setInfo.soundcloud_url || null,
                youtube_url: setInfo.youtube_url || null,
                mixcloud_url: setInfo.mixcloud_url || null,
              })
              .select('id')
              .single();

            if (setError) {
              console.error('[Chrome Import] Set insert error:', setError);
              results.errors.push(`Set: ${setError.message}`);
              results.setsSkipped++;
            } else {
              results.setsCreated++;
              console.log('[Chrome Import] Created set:', setInfo.title, 'with ID:', newSet?.id);

              // Link tracks to set if we have a set ID
              if (newSet?.id && data.tracks?.length > 0) {
                // Check if tracks have real timestamps (more than just 0:00)
                // If all tracks are at 0:00 or sequential from 0, they're untimed
                const hasRealTimestamps = data.tracks.some((t, i) => {
                  const ts = t.timestamp_seconds || 0;
                  // If any track has a timestamp > 60 seconds and it's not just position-based
                  return ts > 60 && ts !== i * 60;
                });

                let tracksWithTimestamps = 0;
                let tracksWithoutTimestamps = 0;

                for (const track of data.tracks) {
                  try {
                    const hasTimestamp = hasRealTimestamps && (track.timestamp_seconds || 0) > 0;

                    if (hasTimestamp) {
                      tracksWithTimestamps++;
                    } else {
                      tracksWithoutTimestamps++;
                    }

                    // Detect and strip unreleased indicators from title
                    let cleanTitle = track.title;
                    const unreleasedRx = /\bunreleased\b|\bforthcoming\b|\bdubplate\b|\bwhite\s*label\b|\(dub\s*\??\)|\(VIP\)/i;
                    const titleHasIndicator = unreleasedRx.test(cleanTitle || '');
                    const isUnreleased = track.is_unreleased || titleHasIndicator;
                    if (titleHasIndicator && cleanTitle) {
                      cleanTitle = cleanTitle
                        .replace(/\s*\(?\s*unreleased\s*\??\s*\)?\s*/gi, ' ')
                        .replace(/\s*\(?\s*forthcoming\s*\)?\s*/gi, ' ')
                        .replace(/\s*\(\s*dub\s*\??\s*\)\s*/gi, ' ')
                        .replace(/\s*\(?\s*dubplate\s*\)?\s*/gi, ' ')
                        .replace(/\s*\(?\s*white\s*label\s*\)?\s*/gi, ' ')
                        .replace(/\s*\(\s*VIP\s*\)\s*/gi, ' ')
                        .replace(/\s+/g, ' ').trim()
                        .replace(/\(\s*$/, '').trim();
                    }

                    await supabase
                      .from('set_tracks')
                      .insert({
                        set_id: newSet.id,
                        track_title: cleanTitle,
                        artist_name: track.artist,
                        timestamp_seconds: track.timestamp_seconds || 0,
                        position: track.position || 0,
                        is_id: track.title?.toLowerCase() === 'id' || track.is_unreleased || false,
                        source: '1001tracklists',
                        is_unreleased: isUnreleased,
                        unreleased_source: isUnreleased ? 'comment_hint' : null,
                      });
                  } catch (e) {
                    // Ignore individual track link errors
                  }
                }

                console.log(`[Chrome Import] Set tracks: ${tracksWithTimestamps} timed, ${tracksWithoutTimestamps} untimed (ordered)`);
              }
            }
          }
        } catch (e) {
          results.errors.push(`Set: ${e.message}`);
          results.setsSkipped++;
        }
      }
    }

    // Process artists
    if (data.artists && Array.isArray(data.artists)) {
      for (const artist of data.artists) {
        if (!artist.name) continue;
        
        const slug = generateSlug(artist.name);
        
        try {
          // Check if exists
          const { data: existing } = await supabase
            .from('artists')
            .select('id')
            .eq('slug', slug)
            .single();
          
          if (existing) {
            // Update with new info if we have it
            const updates = {};
            if (artist.beatport_url) updates.beatport_url = artist.beatport_url;
            if (artist.soundcloud_url) updates.soundcloud_url = artist.soundcloud_url;
            if (artist.spotify_url) updates.spotify_url = artist.spotify_url;
            if (artist.image_url) updates.image_url = artist.image_url;
            if (artist.country) updates.country = artist.country;

            // Merge genres if provided (add new ones to existing array)
            if (artist.genres?.length) {
              // Fetch current genres to merge
              const { data: currentArtist } = await supabase
                .from('artists')
                .select('genres')
                .eq('id', existing.id)
                .single();

              const currentGenres = currentArtist?.genres || [];
              const newGenres = [...new Set([...currentGenres, ...artist.genres])];
              if (newGenres.length > currentGenres.length) {
                updates.genres = newGenres;
              }
            }

            if (Object.keys(updates).length > 0) {
              await supabase
                .from('artists')
                .update(updates)
                .eq('id', existing.id);
            }

            results.artistsSkipped++;
            continue;
          }

          // Insert new artist
          const { error } = await supabase
            .from('artists')
            .insert({
              name: artist.name,
              slug,
              image_url: artist.image_url || null,
              genres: artist.genres || [],
              country: artist.country || null,
              beatport_url: artist.beatport_url || null,
              soundcloud_url: artist.soundcloud_url || null,
              spotify_url: artist.spotify_url || null,
            });
          
          if (error) {
            if (!error.message.includes('duplicate')) {
              results.errors.push(`Artist ${artist.name}: ${error.message}`);
            }
            results.artistsSkipped++;
          } else {
            results.artistsCreated++;
          }
        } catch (e) {
          results.errors.push(`Artist ${artist.name}: ${e.message}`);
          results.artistsSkipped++;
        }
      }
    }
    
    // Get genre from page if available (for genre page imports)
    const pageGenre = data.genreName || null;

    // Process tracks
    if (data.tracks && Array.isArray(data.tracks)) {
      for (const track of data.tracks) {
        if (!track.title) continue;

        const titleNormalized = normalizeText(track.title);
        const artistName = track.artist || track.artists?.[0] || 'Unknown';
        const trackGenre = track.genre || pageGenre;
        
        try {
          // Find artist ID first (needed for both update and insert)
          let artistId = null;
          const artistSlug = generateSlug(artistName);
          const { data: artistData } = await supabase
            .from('artists')
            .select('id, genres')
            .eq('slug', artistSlug)
            .single();

          if (artistData) {
            artistId = artistData.id;

            // If track has genre info, update the artist's genres
            if (trackGenre) {
              const currentGenres = artistData.genres || [];
              if (!currentGenres.includes(trackGenre)) {
                await supabase
                  .from('artists')
                  .update({ genres: [...currentGenres, trackGenre] })
                  .eq('id', artistId);
              }
            }
          }

          // Check if track exists
          const { data: existing } = await supabase
            .from('tracks')
            .select('id')
            .eq('title_normalized', titleNormalized)
            .eq('artist_name', artistName)
            .single();

          if (existing) {
            // Update with new info
            const updates = {};
            if (track.label) updates.label = track.label;
            if (track.bpm) updates.bpm = track.bpm;
            if (track.key) updates.key = track.key;
            if (track.beatport_url) updates.beatport_url = track.beatport_url;
            if (track.soundcloud_url) updates.soundcloud_url = track.soundcloud_url;
            if (track.spotify_url) updates.spotify_url = track.spotify_url;
            if (track.youtube_url) updates.youtube_url = track.youtube_url;
            if (track.release_year) updates.release_year = track.release_year;
            if (track.duration_seconds) updates.duration_seconds = track.duration_seconds;

            if (Object.keys(updates).length > 0) {
              await supabase
                .from('tracks')
                .update(updates)
                .eq('id', existing.id);
            }

            results.tracksSkipped++;
            continue;
          }
          
          // Insert new track
          const { error } = await supabase
            .from('tracks')
            .insert({
              title: track.title,
              title_normalized: titleNormalized,
              artist_id: artistId,
              artist_name: artistName,
              label: track.label || null,
              release_year: track.release_year || null,
              is_unreleased: track.is_unreleased || false,
              bpm: track.bpm || null,
              key: track.key || null,
              duration_seconds: track.duration_seconds || null,
              beatport_url: track.beatport_url || null,
              soundcloud_url: track.soundcloud_url || null,
              spotify_url: track.spotify_url || null,
              youtube_url: track.youtube_url || null,
              times_played: 0,
            });
          
          if (error) {
            if (!error.message.includes('duplicate')) {
              results.errors.push(`Track ${track.title}: ${error.message}`);
            }
            results.tracksSkipped++;
          } else {
            results.tracksCreated++;
          }
        } catch (e) {
          results.errors.push(`Track ${track.title}: ${e.message}`);
          results.tracksSkipped++;
        }
      }
    }
    
    console.log('[Chrome Import] Results:', results);
    
    return res.status(200).json({
      success: true,
      source: data.source,
      ...results,
    });
    
  } catch (error) {
    console.error('[Chrome Import] Error:', error);
    return res.status(500).json({
      error: 'Import failed',
      message: error.message,
    });
  }
};
