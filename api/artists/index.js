// API endpoint to list/search artists or fetch a single artist by slug
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    const { slug, search, limit = 20, offset = 0, sort = 'name' } = req.query;

    // Single artist by slug
    if (slug) {
      const { data: artist, error } = await supabase
        .from('artists')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Artist not found' });
        }
        console.error('Artist query error:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({
        success: true,
        artist: {
          id: artist.id,
          name: artist.name,
          slug: artist.slug,
          image_url: artist.image_url,
          bio: artist.bio,
          genres: artist.genres || [],
          country: artist.country,
          tracks_count: artist.tracks_count || 0,
          sets_count: artist.sets_count || 0,
          spotify_url: artist.spotify_url,
        },
      });
    }

    // Listing/search
    let query = supabase
      .from('artists')
      .select('*', { count: 'exact' });

    // Search by name
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    // Filter out collaboration/B2B/featuring entries
    query = query
      .not('name', 'ilike', '%b2b%')
      .not('name', 'ilike', '%feat%')
      .not('name', 'ilike', '% vs %')
      .not('name', 'ilike', '% & %');

    // Sort
    if (sort === 'tracks_count') {
      query = query.order('tracks_count', { ascending: false, nullsFirst: false });
    } else if (sort === 'sets_count') {
      query = query.order('sets_count', { ascending: false, nullsFirst: false });
    } else {
      query = query.order('name', { ascending: true });
    }

    // Pagination
    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: artists, error, count } = await query;

    if (error) {
      console.error('Artists query error:', error);
      return res.status(500).json({ error: error.message });
    }

    const transformedArtists = (artists || []).map(artist => ({
      id: artist.id,
      name: artist.name,
      slug: artist.slug,
      image_url: artist.image_url,
      genres: artist.genres || [],
      country: artist.country,
      tracks_count: artist.tracks_count || 0,
      sets_count: artist.sets_count || 0,
    }));

    return res.status(200).json({
      success: true,
      artists: transformedArtists,
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

  } catch (error) {
    console.error('Artists API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
