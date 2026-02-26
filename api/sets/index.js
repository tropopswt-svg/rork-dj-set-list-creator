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

// ── Popularity Scoring ───────────────────────────────────────────────────

const RADIO_KEYWORDS = [
  'bbc radio', 'radio 1', 'essential mix', 'circoloco radio',
  'lot radio', 'rinse fm', 'nts radio', 'worldwide fm', 'red light radio',
  'radio show', 'ra podcast', 'resident advisor podcast',
];

/**
 * Detect if a set is a radio show / broadcast / podcast.
 * Checks title and venue against known radio keywords.
 */
function isRadioSet(set) {
  const text = `${set.title || ''} ${set.dj_name || ''} ${set.venue || ''}`.toLowerCase();
  return RADIO_KEYWORDS.some(kw => text.includes(kw));
}

/**
 * Artist-driven popularity score for the "Popular" sort.
 *
 * Weights:
 *   Artist Spotify popularity  55%  (normalized 0-100 → 0-1, default 25 for unknowns)
 *   Followers count            15%  (log-scaled, saturates ~10M)
 *   App engagement             15%  (engagement velocity, normalized across pool)
 *   Quality score              10%  (metadata completeness)
 *   Recency                     5%  (60-day half-life)
 *
 * Radio sets get a 0.7× multiplier.
 */
function popularityScore(set, normVelocity) {
  // Artist signals — default to modest values for unknown artists
  const artistPop = (set.artists?.popularity ?? 25) / 100;
  const followers = set.artists?.followers_count ?? 0;
  const followerScore = Math.min(Math.log10(followers + 1) / 7, 1); // saturates ~10M

  const quality = qualityScore(set);
  const recency = recencyScore(set.event_date || set.created_at, 60);

  const raw = artistPop * 0.55
    + followerScore * 0.15
    + normVelocity * 0.15
    + quality * 0.10
    + recency * 0.05;

  return isRadioSet(set) ? raw * 0.7 : raw;
}

// ── For You Constants ────────────────────────────────────────────────────

const RADIO_TITLE_PATTERN = /\b(radio|broadcast|podcast|essential mix)\b/i;

const COLD_START_SEED_ARTISTS = ['chris-stussy', 'max-dean', 'josh-baker', 'ranger-trucco', 'rossi', 'locklead'];

// ── Query Builder ────────────────────────────────────────────────────────

function buildBaseQuery(supabase, { dj, search } = {}) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  let query = supabase
    .from('sets')
    .select('*, artists:dj_id(image_url, genres, popularity, followers_count), set_tracks(count)', { count: 'exact' })
    // Exclude future events — sets that haven't happened yet have no tracklists
    .or(`event_date.is.null,event_date.lte.${today}`);
  if (dj) query = query.ilike('dj_name', `%${dj}%`);
  if (search) query = query.or(`title.ilike.%${search}%,dj_name.ilike.%${search}%,venue.ilike.%${search}%`);
  return query;
}

// ── Transform ────────────────────────────────────────────────────────────

function transformSet(set) {
  const youtubeVideoId = extractYouTubeVideoId(set.youtube_url);
  const coverUrl = set.cover_url || getYouTubeThumbnail(youtubeVideoId) || null;
  // Use actual row count from set_tracks join; fall back to stored track_count
  const actualTrackCount = set.set_tracks?.[0]?.count ?? set.track_count ?? 0;
  return {
    id: set.id,
    name: set.title,
    artist: set.dj_name || 'Unknown Artist',
    artistImageUrl: set.artists?.image_url || null,
    venue: set.venue || null,
    location: set.location || null,
    date: set.event_date || set.created_at,
    totalDuration: set.duration_seconds || 0,
    trackCount: actualTrackCount,
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
    // Discovery-focused personalized feed. Prioritizes NEW music the user
    // hasn't heard — similar genres to followed/liked artists, collaborative
    // filtering from similar users, and trending sets. Direct affinity
    // (artists already liked) is intentionally down-weighted so the feed
    // surfaces fresh discoveries rather than echoing the user's library.
    if (sort === 'for_you') {
      const POOL_SIZE = 200;
      const query = buildBaseQuery(supabase, { dj, search })
        .order('created_at', { ascending: false })
        .limit(POOL_SIZE);
      const { data: pool, error, count } = await query;
      if (error) throw error;
      totalCount = count;

      // Filter radio shows / broadcasts / podcasts and sets older than 6 years
      const sixYearsAgo = Date.now() - 6 * 365.25 * 86400000;
      const filteredPool = (pool || []).filter(s => {
        if (isRadioSet(s) || RADIO_TITLE_PATTERN.test(s.title) || RADIO_TITLE_PATTERN.test(s.dj_name)) return false;
        const date = s.event_date || s.created_at;
        if (date && new Date(date).getTime() < sixYearsAgo) return false;
        return true;
      });

      // Gather personalization signals (gracefully degrade if tables are empty)
      const affinityMap = {};
      const socialSignals = {};
      const genreScores = {};     // genre → score (from user's taste profile)
      const likedSetIds = new Set();
      const followedArtistIds = new Set();

      if (user_id) {
        // 1. Artist affinities — pre-calculated scores from liked sets
        const { data: affinities } = await supabase
          .from('user_artist_affinity')
          .select('artist_id, affinity_score')
          .eq('user_id', user_id)
          .order('affinity_score', { ascending: false })
          .limit(50);
        (affinities || []).forEach(a => { affinityMap[a.artist_id] = a.affinity_score; });

        // 2. Followed artists — these are "known" artists to de-prioritize
        const { data: follows } = await supabase
          .from('follows')
          .select('following_artist_id')
          .eq('follower_id', user_id)
          .not('following_artist_id', 'is', null);
        (follows || []).forEach(f => followedArtistIds.add(f.following_artist_id));

        // 3. User's liked set IDs — to filter out already-seen sets
        const { data: likes } = await supabase
          .from('likes')
          .select('set_id')
          .eq('user_id', user_id);
        (likes || []).forEach(l => likedSetIds.add(l.set_id));

        // 4. Build genre taste profile from followed artists + liked set artists
        const knownArtistIds = [
          ...Object.keys(affinityMap),
          ...followedArtistIds,
        ].filter(Boolean);

        if (knownArtistIds.length > 0) {
          const uniqueIds = [...new Set(knownArtistIds)];
          const { data: artistGenres } = await supabase
            .from('artists')
            .select('id, genres')
            .in('id', uniqueIds.slice(0, 50));
          // Weight genres by affinity score (or 0.5 for followed-only artists)
          (artistGenres || []).forEach(a => {
            const weight = affinityMap[a.id] || 0.5;
            (a.genres || []).forEach(g => {
              const genre = g.toLowerCase();
              genreScores[genre] = (genreScores[genre] || 0) + weight;
            });
          });
          // Normalize genre scores to 0-1
          const maxGenre = Math.max(...Object.values(genreScores), 0.001);
          for (const g in genreScores) genreScores[g] /= maxGenre;
        }

        // 5. Similar users — collaborative filtering
        const { data: similarUsers } = await supabase
          .from('user_similarity')
          .select('similar_user_id, similarity_score')
          .eq('user_id', user_id)
          .order('similarity_score', { ascending: false })
          .limit(20);
        const simIds = (similarUsers || []).map(u => u.similar_user_id);
        const simMap = {};
        (similarUsers || []).forEach(u => { simMap[u.similar_user_id] = u.similarity_score; });

        // 6. What similar users liked recently (last 30 days)
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

      const hasPersonalization = Object.keys(affinityMap).length > 0
        || Object.keys(socialSignals).length > 0
        || Object.keys(genreScores).length > 0
        || followedArtistIds.size > 0;

      // Build cold-start profile from seed artists (only when no personalization)
      let coldStartGenreScores = {};
      const seedArtistIds = new Set();
      if (!hasPersonalization) {
        const { data: seedArtists } = await supabase
          .from('artists')
          .select('id, genres')
          .in('slug', COLD_START_SEED_ARTISTS);

        (seedArtists || []).forEach(a => seedArtistIds.add(a.id));

        const genreCounts = {};
        (seedArtists || []).forEach(a => {
          (a.genres || []).forEach(g => {
            const genre = g.toLowerCase();
            genreCounts[genre] = (genreCounts[genre] || 0) + 1;
          });
        });

        if (Object.keys(genreCounts).length > 0) {
          const maxCount = Math.max(...Object.values(genreCounts));
          for (const g in genreCounts) coldStartGenreScores[g] = genreCounts[g] / maxCount;
        } else {
          // Hardcoded fallback if seed artists have no genres in DB
          coldStartGenreScores = { house: 1.0, 'tech house': 0.9, 'deep house': 0.8, minimal: 0.7 };
        }
      }

      // Compute velocity scores and normalize relative to the pool
      const rawVelocities = filteredPool.map(s => engagementVelocity(s));
      const normVelocities = normalizeScores(rawVelocities);

      const scored = filteredPool.map((set, i) => {
        let score;
        if (hasPersonalization) {
          // ── Genre match (discovery signal) ──
          // Score how well this set's genre matches the user's taste profile.
          // This is the primary DISCOVERY mechanism — surfaces new artists in
          // genres the user already enjoys.
          let genreMatch = 0;
          if (Object.keys(genreScores).length > 0) {
            // Collect genres from the set itself AND its linked artist
            const setGenres = [];
            if (set.genre) setGenres.push(set.genre.toLowerCase());
            if (set.artists?.genres) {
              set.artists.genres.forEach(g => setGenres.push(g.toLowerCase()));
            }
            for (const setGenre of setGenres) {
              // Direct match
              if (genreScores[setGenre]) {
                genreMatch = Math.max(genreMatch, genreScores[setGenre]);
              } else {
                // Partial match — check if any user genre appears in set genre or vice versa
                for (const [g, s] of Object.entries(genreScores)) {
                  if (setGenre.includes(g) || g.includes(setGenre)) {
                    genreMatch = Math.max(genreMatch, s * 0.7);
                  }
                }
              }
            }
          }

          // ── Novelty ──
          // Liked sets are suppressed. Known artists get a mild discovery nudge
          // but still rank well — the feed should feel taste-aligned, not random.
          const isKnownArtist = followedArtistIds.has(set.dj_id) || !!affinityMap[set.dj_id];
          const isAlreadyLiked = likedSetIds.has(set.id);
          const novelty = isAlreadyLiked ? 0 : (isKnownArtist ? 0.85 : 1.0);

          const affinity = affinityMap[set.dj_id] || 0;
          const social = Math.min(socialSignals[set.id] || 0, 1);
          const velocity = normVelocities[i];
          const recency = recencyScore(set.event_date || set.created_at, 14);
          const quality = qualityScore(set);

          // Taste-aligned scoring:
          //   Affinity      25% — artists you engage with rank high
          //   Genre match   25% — same vibe, new or known artist
          //   Social signal 20% — similar users liked this
          //   Velocity      10% — trending signal
          //   Recency       10% — freshness
          //   Quality       10% — metadata completeness
          const rawScore = affinity * 0.25 + genreMatch * 0.25 + social * 0.20
            + velocity * 0.10 + recency * 0.10 + quality * 0.10;

          // Apply novelty multiplier: known artists score ~92%, already-liked drops out
          score = rawScore * (0.5 + novelty * 0.5);
        } else {
          // Anonymous / cold-start: seed artist boost + genre + trending
          let genreMatch = 0;
          if (Object.keys(coldStartGenreScores).length > 0) {
            const setGenres = [];
            if (set.genre) setGenres.push(set.genre.toLowerCase());
            if (set.artists?.genres) {
              set.artists.genres.forEach(g => setGenres.push(g.toLowerCase()));
            }
            for (const setGenre of setGenres) {
              if (coldStartGenreScores[setGenre]) {
                genreMatch = Math.max(genreMatch, coldStartGenreScores[setGenre]);
              } else {
                for (const [g, s] of Object.entries(coldStartGenreScores)) {
                  if (setGenre.includes(g) || g.includes(setGenre)) {
                    genreMatch = Math.max(genreMatch, s * 0.7);
                  }
                }
              }
            }
          }

          // Direct seed artist boost — sets from seed artists always rank high
          const isSeedArtist = seedArtistIds.has(set.dj_id);
          const seedBoost = isSeedArtist ? 1.0 : 0;

          const velocity = normVelocities[i];
          const recency = recencyScore(set.event_date || set.created_at, 14);
          const quality = qualityScore(set);

          // Seed boost 40%, genre 15%, velocity 15%, recency 15%, quality 15%
          score = seedBoost * 0.40 + genreMatch * 0.15 + velocity * 0.15 + recency * 0.15 + quality * 0.15;
        }
        return { ...set, _score: score };
      });

      scored.sort((a, b) => b._score - a._score);
      resultSets = scored.slice(off, off + lim);
    }

    // ── Most Popular ─────────────────────────────────────────────────
    // Artist-driven popularity: Spotify popularity (55%) + followers (15%)
    // + app engagement (15%) + quality (10%) + recency (5%).
    // Radio sets get a 0.7× penalty so live sets rank above broadcasts.
    else if (sort === 'popular') {
      const POOL_SIZE = 500;
      const query = buildBaseQuery(supabase, { dj, search })
        .order('created_at', { ascending: false })
        .limit(POOL_SIZE);
      const { data: pool, error, count } = await query;
      if (error) throw error;
      totalCount = count;

      const rawVelocities = (pool || []).map(s => engagementVelocity(s));
      const normVelocities = normalizeScores(rawVelocities);

      const scored = (pool || []).map((set, i) => ({
        ...set,
        _score: popularityScore(set, normVelocities[i]),
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
        .or(uniqueNames.map(name => `name.ilike.${name}`).join(','));

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
