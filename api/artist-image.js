// Lightweight API endpoint to resolve an artist's image from Spotify
// GET /api/artist-image?name=DJ+Rork&artistId=optional-uuid
// Returns { imageUrl: string | null }
import { getSupabaseClient, getSpotifyToken, searchArtistOnSpotify } from './_lib/spotify-core.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Cache responses for 24 hours
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { name, artistId } = req.query;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const supabase = getSupabaseClient();

  // If we have an artistId, check if the DB already has an image
  if (artistId && supabase) {
    const { data: artist } = await supabase
      .from('artists')
      .select('image_url')
      .eq('id', artistId)
      .single();

    if (artist?.image_url) {
      return res.status(200).json({ imageUrl: artist.image_url });
    }
  }

  // Try Spotify
  const token = await getSpotifyToken();
  if (!token) {
    return res.status(200).json({ imageUrl: null });
  }

  try {
    const spotifyData = await searchArtistOnSpotify(token, name);

    if (spotifyData?._rateLimited || !spotifyData?.image_url) {
      return res.status(200).json({ imageUrl: null });
    }

    // Persist the image to the database for future use
    if (artistId && supabase) {
      const update = { image_url: spotifyData.image_url };
      if (spotifyData.genres?.length) update.genres = spotifyData.genres;
      if (spotifyData.spotify_url) update.spotify_url = spotifyData.spotify_url;
      if (spotifyData.followers_count) update.followers_count = spotifyData.followers_count;

      await supabase
        .from('artists')
        .update(update)
        .eq('id', artistId);
    }

    return res.status(200).json({ imageUrl: spotifyData.image_url });
  } catch (error) {
    console.error('[artist-image] Error:', error);
    return res.status(200).json({ imageUrl: null });
  }
}
