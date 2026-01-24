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
    });
    
    const results = {
      artistsCreated: 0,
      artistsSkipped: 0,
      tracksCreated: 0,
      tracksSkipped: 0,
      errors: [],
    };
    
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
            if (artist.genres?.length) updates.genres = artist.genres;
            if (artist.country) updates.country = artist.country;
            
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
    
    // Process tracks
    if (data.tracks && Array.isArray(data.tracks)) {
      for (const track of data.tracks) {
        if (!track.title) continue;
        
        const titleNormalized = normalizeText(track.title);
        const artistName = track.artist || track.artists?.[0] || 'Unknown';
        
        try {
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
            if (track.release_year) updates.release_year = track.release_year;
            
            if (Object.keys(updates).length > 0) {
              await supabase
                .from('tracks')
                .update(updates)
                .eq('id', existing.id);
            }
            
            results.tracksSkipped++;
            continue;
          }
          
          // Find artist ID if exists
          let artistId = null;
          const artistSlug = generateSlug(artistName);
          const { data: artistData } = await supabase
            .from('artists')
            .select('id')
            .eq('slug', artistSlug)
            .single();
          
          if (artistData) {
            artistId = artistData.id;
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
