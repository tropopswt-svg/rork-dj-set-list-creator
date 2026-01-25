// One-time migration to fix tracks with "Artist - Track" format in title
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Only allow POST to run the fix
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ready',
      description: 'POST to this endpoint to fix tracks with "Artist - Track" format in title',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    // Find all tracks where artist_name is Unknown and title contains " - "
    const { data: tracks, error: fetchError } = await supabase
      .from('tracks')
      .select('id, title, artist_name')
      .eq('artist_name', 'Unknown')
      .like('title', '% - %');

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return res.status(500).json({ error: fetchError.message });
    }

    console.log(`Found ${tracks?.length || 0} tracks to fix`);

    const results = {
      total: tracks?.length || 0,
      fixed: 0,
      skipped: 0,
      errors: 0,
      artistsCreated: 0,
      samples: [],
    };

    for (const track of tracks || []) {
      try {
        // Parse "Artist - Track" format
        const dashIndex = track.title.indexOf(' - ');
        if (dashIndex === -1) {
          results.skipped++;
          continue;
        }

        const artistName = track.title.substring(0, dashIndex).trim();
        const newTitle = track.title.substring(dashIndex + 3).trim();

        if (!artistName || !newTitle) {
          results.skipped++;
          continue;
        }

        // Check if artist exists, create if not
        const artistSlug = generateSlug(artistName);
        let artistId = null;

        const { data: existingArtist } = await supabase
          .from('artists')
          .select('id')
          .eq('slug', artistSlug)
          .single();

        if (existingArtist) {
          artistId = existingArtist.id;
        } else {
          // Create the artist
          const { data: newArtist, error: artistError } = await supabase
            .from('artists')
            .insert({ name: artistName, slug: artistSlug })
            .select('id')
            .single();

          if (!artistError && newArtist) {
            artistId = newArtist.id;
            results.artistsCreated++;
          }
        }

        // Update the track
        const { error: updateError } = await supabase
          .from('tracks')
          .update({
            title: newTitle,
            title_normalized: newTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim(),
            artist_name: artistName,
            artist_id: artistId,
          })
          .eq('id', track.id);

        if (updateError) {
          console.error(`Update error for ${track.id}:`, updateError);
          results.errors++;
        } else {
          results.fixed++;
          if (results.samples.length < 10) {
            results.samples.push({
              before: track.title,
              artist: artistName,
              title: newTitle,
            });
          }
        }
      } catch (e) {
        console.error(`Error processing track ${track.id}:`, e);
        results.errors++;
      }
    }

    console.log('Migration results:', results);

    return res.status(200).json({
      success: true,
      message: `Fixed ${results.fixed} tracks, created ${results.artistsCreated} artists`,
      results,
    });

  } catch (error) {
    console.error('Migration error:', error);
    return res.status(500).json({ error: error.message });
  }
}
