// API endpoint to list sets from database
import { createClient } from '@supabase/supabase-js';

// ── Helpers ──────────────────────────────────────────────────────────────

function extractYouTubeVideoId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function getYouTubeThumbnail(videoId) {
  if (!videoId) return null;
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

function getSupabaseClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

// ── Scoring Functions ────────────────────────────────────────────────────
//
// For You:   Personalized — artist affinity + similar users' likes + engagement velocity + recency.
//            Falls back to trending (velocity + recency + quality) for anonymous users.
//
// Popular:   Hacker News–style hot ranking — engagement / time^gravity.
//            Rewards recent engagement bursts, prevents old sets from dominating.
//
// Deep Cuts: Hidden gems — older sets with high quality but low engagement.
//            quality * (1 / log(engagement + 2)) * age_boost
//
// New:       Simple event_date DESC.
// Recent:    Simple created_at DESC (default).

/**
 * Quality score: How complete/rich is this set's metadata?
 * Returns 0–1. Sets with tracks, covers, sources, and venue info score highest.
 */
function qualityScore(set) {
  let score = 0;
  // Identified tracks — most important quality signal
  if (set.track_count > 0) score += Math.min(set.track_count / 20, 1);
  // Has a cover image (stored or derivable from YouTube)
  if (set.cover_url || set.youtube_url) score += 0.8;
  // Has duration (means it's a real recorded set)
  if (set.duration_seconds > 0) score += 0.6;
  // Source links breadth (tracklist, youtube, soundcloud, mixcloud)
  const sourceCount = [set.tracklist_url, set.youtube_url, set.soundcloud_url, set.mixcloud_url]
    .filter(Boolean).length;
  score += sourceCount * 0.4;
  // Has venue info
  if (set.venue) score += 0.3;
  return Math.min(score / 4.3, 1);
}

/**
 * Recency decay: exponential half-life.
 * A set is "fully fresh" at age 0 and halves every `halfLifeDays` days.
 * Returns 0–1.
 */
function recencyScore(dateStr, halfLifeDays = 14) {
  if (!dateStr) return 0.1;
  const ageDays = Math.max((Date.now() - new Date(dateStr).getTime()) / 86400000, 0);
  return Math.pow(0.5, ageDays / halfLifeDays);
}

/**
 * Engagement velocity: Hacker News–style hot ranking.
 * score = (likes + comments×2) / (age_hours + 2)^gravity
 * Comments weighted 2× because they signal deeper engagement.
 * Gravity 1.5 is gentler than HN's 1.8 — DJ sets are more evergreen than news.
 */
function engagementVelocity(set) {
  const likes = set.likes_count || 0;
  const comments = set.comments_count || 0;
  const engagement = likes + comments * 2;
  const ageHours = Math.max((Date.now() - new Date(set.created_at).getTime()) / 3600000, 1);
  return engagement / Math.pow(ageHours + 2, 1.5);
}

/**
 * Deep cut score: finds hidden gems.
 * High quality + low popularity + old age = high score.
 * quality * inverse_popularity * (1 + age_boost)
 */
function deepCutScore(set) {
  const quality = qualityScore(set);
  const engagement = (set.likes_count || 0) + (set.comments_count || 0);
  const ageDays = Math.max((Date.now() - new Date(set.event_date || set.created_at).getTime()) / 86400000, 0);
  // Age boost: caps at 2× for sets older than 6 months
  const ageBoost = Math.min(ageDays / 180, 2);
  // Inverse popularity: log dampening so 0-engagement isn't infinite
  const popularityPenalty = 1 / Math.log2(engagement + 2);
  return quality * popularityPenalty * (1 + ageBoost);
}

/**
 * Normalize an array of scores to 0–1 range relative to the pool max.
 * Returns a Map<index, normalizedScore>.
 */
function normalizeScores(scores) {
  const max = Math.max(...scores, 0.0001);
  return scores.map(s => s / max);
}

// ── Query Builder ────────────────────────────────────────────────────────

function buildBaseQuery(supabase, { dj, search } = {}) {
  let query = supabase
    .from('sets')
    .select('*, artists:dj_id(image_url)', { count: 'exact' });
  if (dj) query = query.ilike('dj_name', `%${dj}%`);
  if (search) query = query.or(`title.ilike.%${search}%,dj_name.ilike.%${search}%,venue.ilike.%${search}%`);
  return query;
}

// ── Transform ────────────────────────────────────────────────────────────

function transformSet(set) {
  const youtubeVideoId = extractYouTubeVideoId(set.youtube_url);
  const coverUrl = set.cover_url || getYouTubeThumbnail(youtubeVideoId) || null;
  return {
    id: set.id,
    name: set.title,
    artist: set.dj_name || 'Unknown Artist',
    artistImageUrl: set.artists?.image_url || null,
    venue: set.venue || null,
    location: set.location || null,
    date: set.event_date || set.created_at,
    totalDuration: set.duration_seconds || 0,
    trackCount: set.track_count || 0,
    coverUrl,
    sourceLinks: [
      set.tracklist_url && { platform: '1001tracklists', url: set.tracklist_url },
      set.youtube_url && { platform: 'youtube', url: set.youtube_url },
      set.soundcloud_url && { platform: 'soundcloud', url: set.soundcloud_url },
      set.mixcloud_url && { platform: 'mixcloud', url: set.mixcloud_url },
    ].filter(Boolean),
    source: set.source,
    hasGaps: false,
  };
}

// ── Handler ──────────────────────────────────────────────────────────────

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
    const {
      limit = 20,
      offset = 0,
      dj,
      search,
      sort = 'recent',
      user_id,
    } = req.query;

    const lim = parseInt(limit);
    const off = parseInt(offset);
    let resultSets;
    let totalCount;

    // ── For You ──────────────────────────────────────────────────────
    // Personalized feed for logged-in users, trending fallback otherwise.
    if (sort === 'for_you') {
      const POOL_SIZE = 200;
      const query = buildBaseQuery(supabase, { dj, search })
        .order('created_at', { ascending: false })
        .limit(POOL_SIZE);
      const { data: pool, error, count } = await query;
      if (error) throw error;
      totalCount = count;

      // Gather personalization signals (gracefully degrade if RLS blocks access)
      const affinityMap = {};
      const socialSignals = {};

      if (user_id) {
        // 1. Artist affinities — pre-calculated scores from user's listening/liking history
        const { data: affinities } = await supabase
          .from('user_artist_affinity')
          .select('artist_id, affinity_score')
          .eq('user_id', user_id)
          .order('affinity_score', { ascending: false })
          .limit(50);
        (affinities || []).forEach(a => { affinityMap[a.artist_id] = a.affinity_score; });

        // 2. Similar users — find what like-minded people are listening to
        const { data: similarUsers } = await supabase
          .from('user_similarity')
          .select('similar_user_id, similarity_score')
          .eq('user_id', user_id)
          .order('similarity_score', { ascending: false })
          .limit(20);
        const simIds = (similarUsers || []).map(u => u.similar_user_id);
        const simMap = {};
        (similarUsers || []).forEach(u => { simMap[u.similar_user_id] = u.similarity_score; });

        // 3. What those similar users liked recently (last 30 days)
        if (simIds.length > 0) {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
          const { data: socialLikes } = await supabase
            .from('likes')
            .select('set_id, user_id')
            .in('user_id', simIds)
            .gte('created_at', thirtyDaysAgo);
          (socialLikes || []).forEach(like => {
            socialSignals[like.set_id] = (socialSignals[like.set_id] || 0) + (simMap[like.user_id] || 0);
          });
        }
      }

      const hasPersonalization = Object.keys(affinityMap).length > 0 || Object.keys(socialSignals).length > 0;

      // Compute velocity scores and normalize relative to the pool
      const rawVelocities = (pool || []).map(s => engagementVelocity(s));
      const normVelocities = normalizeScores(rawVelocities);

      const scored = (pool || []).map((set, i) => {
        let score;
        if (hasPersonalization) {
          // Weighted multi-factor scoring (research-based weights):
          //   Artist affinity 35% — strongest signal: user explicitly liked this artist's sets
          //   Social signal   25% — collaborative filtering: similar users liked this
          //   Velocity        20% — trending signal: recent engagement burst
          //   Recency         15% — freshness: prefer recent sets
          //   Quality          5% — metadata completeness: tiebreaker
          const affinity = affinityMap[set.dj_id] || 0;
          const social = Math.min(socialSignals[set.id] || 0, 1);
          const velocity = normVelocities[i];
          const recency = recencyScore(set.event_date || set.created_at, 14);
          const quality = qualityScore(set);
          score = affinity * 0.35 + social * 0.25 + velocity * 0.20 + recency * 0.15 + quality * 0.05;
        } else {
          // Anonymous / cold-start: trending algorithm
          //   Velocity 45% — what's hot right now
          //   Recency  35% — freshness
          //   Quality  20% — metadata completeness
          const velocity = normVelocities[i];
          const recency = recencyScore(set.event_date || set.created_at, 14);
          const quality = qualityScore(set);
          score = velocity * 0.45 + recency * 0.35 + quality * 0.20;
        }
        return { ...set, _score: score };
      });

      scored.sort((a, b) => b._score - a._score);
      resultSets = scored.slice(off, off + lim);
    }

    // ── Most Popular ─────────────────────────────────────────────────
    // Engagement velocity ranking — rewards sets getting engagement NOW,
    // not sets that accumulated likes over years.
    else if (sort === 'popular') {
      const POOL_SIZE = 200;
      const query = buildBaseQuery(supabase, { dj, search })
        .order('created_at', { ascending: false })
        .limit(POOL_SIZE);
      const { data: pool, error, count } = await query;
      if (error) throw error;
      totalCount = count;

      const scored = (pool || []).map(set => ({
        ...set,
        _score: engagementVelocity(set),
      }));
      scored.sort((a, b) => b._score - a._score);
      resultSets = scored.slice(off, off + lim);
    }

    // ── Deep Cuts ────────────────────────────────────────────────────
    // Hidden gems: older sets (>90 days in DB) with good quality metadata
    // but low engagement relative to their age. Excludes sets with 0 tracks.
    else if (sort === 'deep_cuts') {
      const POOL_SIZE = 200;
      const threeMonthsAgo = new Date(Date.now() - 90 * 86400000).toISOString();
      const query = buildBaseQuery(supabase, { dj, search })
        .lt('created_at', threeMonthsAgo)
        .gt('track_count', 0)
        .order('created_at', { ascending: true })
        .limit(POOL_SIZE);
      const { data: pool, error, count } = await query;
      if (error) throw error;
      totalCount = count;

      const scored = (pool || []).map(set => ({
        ...set,
        _score: deepCutScore(set),
      }));
      scored.sort((a, b) => b._score - a._score);
      resultSets = scored.slice(off, off + lim);
    }

    // ── New Sets ─────────────────────────────────────────────────────
    // Most recent events first (by event date, not DB insert date).
    else if (sort === 'new') {
      const query = buildBaseQuery(supabase, { dj, search })
        .order('event_date', { ascending: false, nullsFirst: false })
        .range(off, off + lim - 1);
      const { data: sets, error, count } = await query;
      if (error) throw error;
      resultSets = sets;
      totalCount = count;
    }

    // ── Recent (default) ─────────────────────────────────────────────
    // Most recently added to the database.
    else {
      const query = buildBaseQuery(supabase, { dj, search })
        .order('created_at', { ascending: false })
        .range(off, off + lim - 1);
      const { data: sets, error, count } = await query;
      if (error) throw error;
      resultSets = sets;
      totalCount = count;
    }

    const transformedSets = (resultSets || []).map(transformSet);

    // Backfill artist images for sets where the FK join (dj_id) didn't produce one
    const needsImage = transformedSets.filter(s => !s.artistImageUrl && s.artist && s.artist !== 'Unknown Artist');
    if (needsImage.length > 0) {
      const uniqueNames = [...new Set(needsImage.map(s => s.artist.toLowerCase()))];
      const { data: artists } = await supabase
        .from('artists')
        .select('name, image_url')
        .filter('image_url', 'not.is', null)
        .in('name', uniqueNames);

      if (artists && artists.length > 0) {
        const nameToImage = new Map(artists.map(a => [a.name.toLowerCase(), a.image_url]));
        for (const set of needsImage) {
          const img = nameToImage.get(set.artist.toLowerCase());
          if (img) set.artistImageUrl = img;
        }
      }
    }

    return res.status(200).json({
      success: true,
      sets: transformedSets,
      total: totalCount,
      limit: lim,
      offset: off,
    });

  } catch (error) {
    console.error('Sets API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
