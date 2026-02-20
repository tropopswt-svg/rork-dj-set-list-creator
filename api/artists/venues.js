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
    // Resolve artist name from slug or id
    let artistName = null;
    if (artistSlug) {
      const { data: artist } = await supabase
        .from('artists')
        .select('id, name')
        .eq('slug', artistSlug)
        .single();

      if (!artist) {
        return res.status(404).json({ success: false, error: 'Artist not found' });
      }
      artistName = artist.name;
    } else if (artistId) {
      const { data: artist } = await supabase
        .from('artists')
        .select('id, name')
        .eq('id', artistId)
        .single();

      if (!artist) {
        return res.status(404).json({ success: false, error: 'Artist not found' });
      }
      artistName = artist.name;
    }

    // Get all sets by this artist with venue info (sets table uses dj_name)
    const { data: sets, error } = await supabase
      .from('sets')
      .select('id, venue, event_date')
      .eq('dj_name', artistName)
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

    // Get ALL venue coordinates for fuzzy matching
    const { data: allCoordinates } = await supabase
      .from('venue_coordinates')
      .select('venue_name, latitude, longitude, city, country');

    const coordList = allCoordinates || [];

    // Build final venue list with coordinates using fuzzy matching
    const venues = [];
    for (const [name, data] of Object.entries(venueMap)) {
      const nameLower = name.toLowerCase().trim();

      // Try exact match first
      let coord = coordList.find(c => c.venue_name.toLowerCase() === nameLower);

      // Try partial/contains match
      if (!coord) {
        coord = coordList.find(c =>
          nameLower.includes(c.venue_name.toLowerCase()) ||
          c.venue_name.toLowerCase().includes(nameLower)
        );
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
