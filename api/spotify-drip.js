// Vercel cron endpoint — background drip enrichment
// Processes 10 un-enriched tracks per invocation with cache-first + rate-limit checks
// Schedule: every 5 minutes via vercel.json cron
import { getSupabaseClient, getSpotifyToken, searchTrackOnSpotify } from './_lib/spotify-core.js';
import { checkCache, writeCache, canMakeRequest, recordRateLimit } from './_lib/spotify-cache.js';

const BATCH_SIZE = 10;
const DELAY_MS = 1200;

export default async function handler(req, res) {
  // Verify cron secret (Vercel sets this header for cron jobs)
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const token = await getSpotifyToken();
  if (!token) {
    return res.status(500).json({ error: 'Spotify credentials not configured' });
  }

  try {
    // Fetch un-enriched tracks (no spotify_data, not ID tracks)
    const { data: tracks, error } = await supabase
      .from('set_tracks')
      .select('id, artist_name, track_title')
      .eq('is_id', false)
      .is('spotify_data', null)
      .not('artist_name', 'is', null)
      .not('track_title', 'is', null)
      .neq('track_title', 'ID')
      .neq('track_title', 'Unknown')
      .limit(BATCH_SIZE);

    if (error) throw error;
    if (!tracks || tracks.length === 0) {
      return res.status(200).json({ success: true, message: 'No tracks to process', processed: 0 });
    }

    let enriched = 0;
    let notFound = 0;
    let cacheHits = 0;
    let rateLimited = false;

    for (const track of tracks) {
      // Check global cache first
      const cached = await checkCache(supabase, track.artist_name, track.track_title);
      if (cached) {
        if (cached.found && cached.spotify_data) {
          await supabase
            .from('set_tracks')
            .update({ spotify_data: cached.spotify_data })
            .eq('id', track.id);
          enriched++;
          cacheHits++;
        } else {
          // Known not-found
          await supabase
            .from('set_tracks')
            .update({ spotify_data: { checked: true, found: false } })
            .eq('id', track.id);
          notFound++;
        }
        continue;
      }

      // Check rate limit budget
      const budget = await canMakeRequest(supabase);
      if (!budget.allowed) {
        rateLimited = true;
        break;
      }

      await new Promise(r => setTimeout(r, DELAY_MS));

      const spotifyData = await searchTrackOnSpotify(token, track.artist_name, track.track_title);

      if (spotifyData?._rateLimited) {
        await recordRateLimit(supabase, spotifyData._retryAfter || 60);
        rateLimited = true;
        break;
      }

      // Write to global cache
      await writeCache(supabase, track.artist_name, track.track_title, !!spotifyData, spotifyData);

      if (spotifyData) {
        await supabase
          .from('set_tracks')
          .update({ spotify_data: spotifyData })
          .eq('id', track.id);
        enriched++;
      } else {
        await supabase
          .from('set_tracks')
          .update({ spotify_data: { checked: true, found: false } })
          .eq('id', track.id);
        notFound++;
      }
    }

    return res.status(200).json({
      success: true,
      total: tracks.length,
      enriched,
      notFound,
      cacheHits,
      rateLimited,
    });

  } catch (error) {
    console.error('Spotify drip error:', error);
    return res.status(500).json({ error: error.message });
  }
}
