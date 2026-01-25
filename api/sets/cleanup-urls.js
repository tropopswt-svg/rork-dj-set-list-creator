// API endpoint to clean up invalid URLs from sets
// Removes URLs that point to DJ profiles instead of actual tracklists
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

// Check if a URL is invalid (artist profile instead of actual content)
function isInvalidTracklistUrl(url) {
  if (!url) return false;

  // Valid tracklist URL pattern
  const validTracklistPattern = /1001tracklists\.com\/tracklist\//;

  // If it's a 1001tracklists URL but not a tracklist page, it's invalid
  if (url.includes('1001tracklists.com')) {
    return !validTracklistPattern.test(url);
  }

  return false;
}

// Check if YouTube URL is invalid (channel/profile instead of video)
function isInvalidYoutubeUrl(url) {
  if (!url) return false;

  // Invalid YouTube URLs (channels, profiles, playlists without specific video)
  const invalidPatterns = [
    /youtube\.com\/channel\//,  // Channel pages
    /youtube\.com\/c\//,        // Custom channel URLs
    /youtube\.com\/user\//,     // User pages
    /youtube\.com\/@/,          // Handle-based profiles
  ];

  // Valid YouTube video URL patterns
  const validPatterns = [
    /youtube\.com\/watch\?v=/,  // Standard video
    /youtu\.be\//,              // Short URL
  ];

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    // Check if it matches any valid pattern
    for (const pattern of validPatterns) {
      if (pattern.test(url)) return false;
    }
    // If no valid pattern matched, it's invalid
    return true;
  }

  return false;
}

// Check if SoundCloud URL is invalid (profile instead of track/set)
function isInvalidSoundcloudUrl(url) {
  if (!url) return false;

  if (!url.includes('soundcloud.com')) return false;

  // Valid SoundCloud URLs have at least 2 path segments: /artist/track
  // Profile URLs only have 1: /artist
  const path = url.replace(/https?:\/\/(www\.)?soundcloud\.com\/?/, '');
  const segments = path.split('/').filter(s => s.length > 0);

  // If only 1 segment, it's a profile page (invalid)
  // If 2+ segments, it's likely a track/set page (valid)
  return segments.length < 2;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  // GET: Preview what would be cleaned up
  if (req.method === 'GET') {
    try {
      const { data: sets, error } = await supabase
        .from('sets')
        .select('id, title, dj_name, tracklist_url, youtube_url, soundcloud_url')
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      // Check each set for invalid URLs
      const setsWithIssues = sets.map(s => ({
        ...s,
        invalid_tracklist: isInvalidTracklistUrl(s.tracklist_url),
        invalid_youtube: isInvalidYoutubeUrl(s.youtube_url),
        invalid_soundcloud: isInvalidSoundcloudUrl(s.soundcloud_url),
      })).filter(s => s.invalid_tracklist || s.invalid_youtube || s.invalid_soundcloud);

      const summary = {
        totalSets: sets.length,
        setsWithInvalidUrls: setsWithIssues.length,
        invalidTracklistUrls: sets.filter(s => isInvalidTracklistUrl(s.tracklist_url)).length,
        invalidYoutubeUrls: sets.filter(s => isInvalidYoutubeUrl(s.youtube_url)).length,
        invalidSoundcloudUrls: sets.filter(s => isInvalidSoundcloudUrl(s.soundcloud_url)).length,
      };

      return res.status(200).json({
        success: true,
        preview: true,
        summary,
        setsWithIssues: setsWithIssues.map(s => ({
          id: s.id,
          title: s.title,
          dj_name: s.dj_name,
          tracklist_url: s.invalid_tracklist ? s.tracklist_url : null,
          youtube_url: s.invalid_youtube ? s.youtube_url : null,
          soundcloud_url: s.invalid_soundcloud ? s.soundcloud_url : null,
          will_clear: {
            tracklist: s.invalid_tracklist,
            youtube: s.invalid_youtube,
            soundcloud: s.invalid_soundcloud,
          },
        })),
        message: 'POST to this endpoint to clean up invalid URLs',
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // POST: Actually clean up the invalid URLs
  if (req.method === 'POST') {
    try {
      // Get all sets
      const { data: sets, error } = await supabase
        .from('sets')
        .select('id, tracklist_url, youtube_url, soundcloud_url');

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      const results = {
        tracklist_cleaned: 0,
        youtube_cleaned: 0,
        soundcloud_cleaned: 0,
        errors: [],
      };

      for (const set of sets) {
        const updates = {};

        if (isInvalidTracklistUrl(set.tracklist_url)) {
          updates.tracklist_url = null;
          results.tracklist_cleaned++;
        }

        if (isInvalidYoutubeUrl(set.youtube_url)) {
          updates.youtube_url = null;
          results.youtube_cleaned++;
        }

        if (isInvalidSoundcloudUrl(set.soundcloud_url)) {
          updates.soundcloud_url = null;
          results.soundcloud_cleaned++;
        }

        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from('sets')
            .update(updates)
            .eq('id', set.id);

          if (updateError) {
            results.errors.push({ id: set.id, error: updateError.message });
          }
        }
      }

      const totalCleaned = results.tracklist_cleaned + results.youtube_cleaned + results.soundcloud_cleaned;

      return res.status(200).json({
        success: true,
        results,
        totalCleaned,
        errors: results.errors.length > 0 ? results.errors : undefined,
        message: `Cleaned ${totalCleaned} invalid URLs (${results.tracklist_cleaned} tracklist, ${results.youtube_cleaned} YouTube, ${results.soundcloud_cleaned} SoundCloud)`,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
