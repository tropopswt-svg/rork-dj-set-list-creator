// API endpoint: /api/artists/venues?artistId=xxx
// Returns venues where an artist has played with coordinates and frequency

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { artistId, artistSlug } = req.query;

  if (!artistId && !artistSlug) {
    return res.status(400).json({ success: false, error: 'artistId or artistSlug is required' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    // Get artist if using slug
    let resolvedArtistId = artistId;
    if (!resolvedArtistId && artistSlug) {
      const { data: artist } = await supabase
        .from('artists')
        .select('id')
        .eq('slug', artistSlug)
        .single();

      if (!artist) {
        return res.status(404).json({ success: false, error: 'Artist not found' });
      }
      resolvedArtistId = artist.id;
    }

    // Get all sets by this artist with venue info
    const { data: sets, error } = await supabase
      .from('sets')
      .select('id, venue, event_date')
      .eq('artist_id', resolvedArtistId)
      .not('venue', 'is', null);

    if (error) throw error;

    if (!sets || sets.length === 0) {
      return res.status(200).json({ success: true, venues: [] });
    }

    // Group by venue
    const venueMap = {};
    for (const set of sets) {
      if (!set.venue) continue;
      const venueName = set.venue.trim();
      if (!venueMap[venueName]) {
        venueMap[venueName] = { name: venueName, setsCount: 0, lastSetDate: null };
      }
      venueMap[venueName].setsCount++;
      if (!venueMap[venueName].lastSetDate || (set.event_date && set.event_date > venueMap[venueName].lastSetDate)) {
        venueMap[venueName].lastSetDate = set.event_date;
      }
    }

    // Get coordinates for these venues
    const venueNames = Object.keys(venueMap);
    const { data: coordinates } = await supabase
      .from('venue_coordinates')
      .select('venue_name, latitude, longitude, city, country')
      .in('venue_name', venueNames);

    // Also try partial matching for venues that don't have exact matches
    // e.g., "Berghain / Panorama Bar" should match "Berghain"
    const coordMap = {};
    if (coordinates) {
      for (const coord of coordinates) {
        coordMap[coord.venue_name] = coord;
      }
    }

    // Build final venue list with coordinates
    const venues = [];
    for (const [name, data] of Object.entries(venueMap)) {
      let coord = coordMap[name];

      // Try partial match if no exact match
      if (!coord) {
        const partialMatch = coordinates?.find(c =>
          name.toLowerCase().includes(c.venue_name.toLowerCase()) ||
          c.venue_name.toLowerCase().includes(name.toLowerCase())
        );
        if (partialMatch) coord = partialMatch;
      }

      if (coord) {
        venues.push({
          name,
          lat: coord.latitude,
          lng: coord.longitude,
          city: coord.city,
          country: coord.country,
          setsCount: data.setsCount,
          lastSetDate: data.lastSetDate,
        });
      }
    }

    return res.status(200).json({ success: true, venues });
  } catch (error) {
    console.error('[artists/venues] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
