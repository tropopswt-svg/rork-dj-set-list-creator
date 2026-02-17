-- Recommendations and Enhanced Social Features Migration
-- Adds recommendation tables, similarity tracking, and contact sync

-- ============================================
-- USER-ARTIST AFFINITY TABLE
-- Tracks how much a user likes an artist based on liked sets
-- ============================================
CREATE TABLE IF NOT EXISTS user_artist_affinity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  affinity_score DECIMAL(5,4) DEFAULT 0,
  liked_sets_count INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, artist_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_artist_affinity_user ON user_artist_affinity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_artist_affinity_artist ON user_artist_affinity(artist_id);
CREATE INDEX IF NOT EXISTS idx_user_artist_affinity_score ON user_artist_affinity(user_id, affinity_score DESC);

-- ============================================
-- USER SIMILARITY TABLE
-- Tracks similarity between users based on shared likes
-- ============================================
CREATE TABLE IF NOT EXISTS user_similarity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  similar_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  similarity_score DECIMAL(5,4) DEFAULT 0,
  common_likes_count INTEGER DEFAULT 0,
  common_artists_count INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, similar_user_id),
  CHECK (user_id != similar_user_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_similarity_user ON user_similarity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_similarity_score ON user_similarity(user_id, similarity_score DESC);

-- ============================================
-- PHONE CONTACTS TABLE
-- Stores hashed phone numbers for Find Friends feature
-- ============================================
CREATE TABLE IF NOT EXISTS phone_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  phone_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, phone_hash)
);

-- Index for finding contacts
CREATE INDEX IF NOT EXISTS idx_phone_contacts_user ON phone_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_phone_contacts_hash ON phone_contacts(phone_hash);

-- ============================================
-- ADD COLUMNS TO PROFILES TABLE
-- ============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_hash TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_recommendation_update TIMESTAMPTZ;

-- Index for phone hash lookups (for contact matching)
CREATE INDEX IF NOT EXISTS idx_profiles_phone_hash ON profiles(phone_hash) WHERE phone_hash IS NOT NULL;

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on new tables
ALTER TABLE user_artist_affinity ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_similarity ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_contacts ENABLE ROW LEVEL SECURITY;

-- User artist affinity: users can only see their own
CREATE POLICY "Users can view own affinity" ON user_artist_affinity
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own affinity" ON user_artist_affinity
  FOR ALL USING (auth.uid() = user_id);

-- User similarity: users can see their own similarities
CREATE POLICY "Users can view own similarities" ON user_similarity
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own similarities" ON user_similarity
  FOR ALL USING (auth.uid() = user_id);

-- Phone contacts: users can only manage their own contacts
CREATE POLICY "Users can view own phone contacts" ON phone_contacts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own phone contacts" ON phone_contacts
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- FUNCTION: Calculate User-Artist Affinity
-- Scores artists based on tracks in liked sets
-- ============================================
CREATE OR REPLACE FUNCTION calculate_user_artist_affinity(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_max_sets INTEGER;
BEGIN
  -- Get max sets by any artist the user has liked (for normalization)
  SELECT MAX(artist_count) INTO v_max_sets
  FROM (
    SELECT COUNT(DISTINCT s.id) as artist_count
    FROM likes l
    JOIN sets s ON l.set_id = s.id
    JOIN set_tracks st ON s.id = st.set_id
    JOIN tracks t ON st.track_id = t.id
    WHERE l.user_id = p_user_id
    GROUP BY t.artist_id
  ) counts;

  -- Default to 1 if no likes
  v_max_sets := COALESCE(NULLIF(v_max_sets, 0), 1);

  -- Upsert affinity scores
  INSERT INTO user_artist_affinity (user_id, artist_id, affinity_score, liked_sets_count, last_calculated_at)
  SELECT
    p_user_id,
    artist_id,
    -- Affinity score: (liked_sets_count / max_sets) capped at 1.0
    LEAST(COUNT(DISTINCT s.id)::DECIMAL / v_max_sets, 1.0),
    COUNT(DISTINCT s.id),
    NOW()
  FROM (
    -- Get artists from tracks in liked sets
    SELECT DISTINCT t.artist_id, s.id
    FROM likes l
    JOIN sets s ON l.set_id = s.id
    JOIN set_tracks st ON s.id = st.set_id
    JOIN tracks t ON st.track_id = t.id
    WHERE l.user_id = p_user_id
      AND t.artist_id IS NOT NULL

    UNION

    -- Also include the set's main artist
    SELECT DISTINCT a.id as artist_id, s.id
    FROM likes l
    JOIN sets s ON l.set_id = s.id
    JOIN artists a ON LOWER(s.artist_name) = LOWER(a.name)
    WHERE l.user_id = p_user_id
  ) artist_sets
  JOIN artists ar ON artist_sets.artist_id = ar.id
  GROUP BY artist_id
  ON CONFLICT (user_id, artist_id)
  DO UPDATE SET
    affinity_score = EXCLUDED.affinity_score,
    liked_sets_count = EXCLUDED.liked_sets_count,
    last_calculated_at = NOW();

  -- Update profile's last recommendation update
  UPDATE profiles
  SET last_recommendation_update = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Calculate User Similarity
-- Finds users with overlapping likes using Jaccard similarity
-- ============================================
CREATE OR REPLACE FUNCTION calculate_user_similarity(p_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Calculate and upsert similarity scores
  INSERT INTO user_similarity (
    user_id,
    similar_user_id,
    similarity_score,
    common_likes_count,
    common_artists_count,
    last_calculated_at
  )
  SELECT
    p_user_id,
    other_user_id,
    -- Jaccard similarity: intersection / union
    (common_likes::DECIMAL + common_artists::DECIMAL) /
      NULLIF((total_user_likes + total_other_likes - common_likes + total_user_artists + total_other_artists - common_artists), 0),
    common_likes,
    common_artists,
    NOW()
  FROM (
    SELECT
      l2.user_id as other_user_id,
      COUNT(DISTINCT l1.set_id) as common_likes,
      (SELECT COUNT(DISTINCT set_id) FROM likes WHERE user_id = p_user_id) as total_user_likes,
      (SELECT COUNT(DISTINCT set_id) FROM likes WHERE user_id = l2.user_id) as total_other_likes,
      -- Count common followed artists
      (
        SELECT COUNT(*) FROM follows f1
        JOIN follows f2 ON f1.following_artist_id = f2.following_artist_id
        WHERE f1.follower_id = p_user_id
          AND f2.follower_id = l2.user_id
          AND f1.following_artist_id IS NOT NULL
      ) as common_artists,
      (SELECT COUNT(*) FROM follows WHERE follower_id = p_user_id AND following_artist_id IS NOT NULL) as total_user_artists,
      (SELECT COUNT(*) FROM follows WHERE follower_id = l2.user_id AND following_artist_id IS NOT NULL) as total_other_artists
    FROM likes l1
    JOIN likes l2 ON l1.set_id = l2.set_id
    JOIN profiles p ON l2.user_id = p.id
    WHERE l1.user_id = p_user_id
      AND l2.user_id != p_user_id
      AND p.is_public = true
    GROUP BY l2.user_id
    HAVING COUNT(DISTINCT l1.set_id) >= 2  -- Minimum 2 common likes
  ) similarity_data
  WHERE (common_likes::DECIMAL + common_artists::DECIMAL) /
    NULLIF((total_user_likes + total_other_likes - common_likes + total_user_artists + total_other_artists - common_artists), 0) > 0.05
  ON CONFLICT (user_id, similar_user_id)
  DO UPDATE SET
    similarity_score = EXCLUDED.similarity_score,
    common_likes_count = EXCLUDED.common_likes_count,
    common_artists_count = EXCLUDED.common_artists_count,
    last_calculated_at = NOW();

  -- Clean up old similarities with very low scores
  DELETE FROM user_similarity
  WHERE user_id = p_user_id
    AND similarity_score < 0.05
    AND last_calculated_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Get Recommended Artists
-- Returns artists user might like based on affinity
-- ============================================
CREATE OR REPLACE FUNCTION get_recommended_artists(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  artist_id UUID,
  artist_name TEXT,
  artist_slug TEXT,
  artist_image_url TEXT,
  recommendation_score DECIMAL,
  reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH user_affinity AS (
    SELECT artist_id, affinity_score
    FROM user_artist_affinity
    WHERE user_id = p_user_id
  ),
  similar_users_following AS (
    SELECT
      f.following_artist_id,
      AVG(us.similarity_score) as avg_similarity
    FROM user_similarity us
    JOIN follows f ON f.follower_id = us.similar_user_id
    WHERE us.user_id = p_user_id
      AND f.following_artist_id IS NOT NULL
    GROUP BY f.following_artist_id
  ),
  already_following AS (
    SELECT following_artist_id
    FROM follows
    WHERE follower_id = p_user_id
      AND following_artist_id IS NOT NULL
  )
  SELECT
    a.id,
    a.name,
    a.slug,
    a.image_url,
    -- Score: 50% from affinity, 30% from similar users, 20% from popularity
    (
      COALESCE(ua.affinity_score, 0) * 0.5 +
      COALESCE(suf.avg_similarity, 0) * 0.3 +
      LEAST(a.followers_count::DECIMAL / 1000, 1.0) * 0.2
    )::DECIMAL(5,4) as recommendation_score,
    CASE
      WHEN ua.affinity_score > 0.5 THEN 'Based on sets you liked'
      WHEN suf.avg_similarity > 0.3 THEN 'Followed by similar users'
      ELSE 'Popular artist'
    END as reason
  FROM artists a
  LEFT JOIN user_affinity ua ON a.id = ua.artist_id
  LEFT JOIN similar_users_following suf ON a.id = suf.following_artist_id
  WHERE a.id NOT IN (SELECT following_artist_id FROM already_following)
    AND (ua.affinity_score > 0 OR suf.avg_similarity > 0 OR a.followers_count > 10)
  ORDER BY recommendation_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Get Recommended Users
-- Returns users with similar taste
-- ============================================
CREATE OR REPLACE FUNCTION get_recommended_users(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  recommendation_score DECIMAL,
  common_likes INTEGER,
  common_artists INTEGER,
  is_contact BOOLEAN,
  mutual_followers INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH already_following AS (
    SELECT following_user_id
    FROM follows
    WHERE follower_id = p_user_id
      AND following_user_id IS NOT NULL
  ),
  user_contacts AS (
    SELECT pc.phone_hash
    FROM phone_contacts pc
    WHERE pc.user_id = p_user_id
  ),
  mutual_follow_counts AS (
    SELECT
      f1.following_user_id as potential_user,
      COUNT(*) as mutual_count
    FROM follows f1
    JOIN follows f2 ON f1.following_user_id = f2.follower_id
    WHERE f2.following_user_id IN (
      SELECT following_user_id FROM follows WHERE follower_id = p_user_id
    )
    AND f1.follower_id = p_user_id
    GROUP BY f1.following_user_id
  )
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    -- Score: 40% similarity, 30% common artists, 20% mutual followers, 10% is contact
    (
      COALESCE(us.similarity_score, 0) * 0.4 +
      LEAST(COALESCE(us.common_artists_count, 0)::DECIMAL / 10, 1.0) * 0.3 +
      LEAST(COALESCE(mfc.mutual_count, 0)::DECIMAL / 5, 1.0) * 0.2 +
      CASE WHEN p.phone_hash IN (SELECT phone_hash FROM user_contacts) THEN 0.1 ELSE 0 END
    )::DECIMAL(5,4) as recommendation_score,
    COALESCE(us.common_likes_count, 0)::INTEGER,
    COALESCE(us.common_artists_count, 0)::INTEGER,
    p.phone_hash IN (SELECT phone_hash FROM user_contacts),
    COALESCE(mfc.mutual_count, 0)::INTEGER
  FROM profiles p
  LEFT JOIN user_similarity us ON us.similar_user_id = p.id AND us.user_id = p_user_id
  LEFT JOIN mutual_follow_counts mfc ON mfc.potential_user = p.id
  WHERE p.id != p_user_id
    AND p.id NOT IN (SELECT following_user_id FROM already_following)
    AND p.is_public = true
    AND (
      us.similarity_score > 0.05
      OR p.phone_hash IN (SELECT phone_hash FROM user_contacts)
      OR mfc.mutual_count > 0
    )
  ORDER BY recommendation_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Find Friends From Contacts
-- Returns users matching provided phone hashes
-- ============================================
CREATE OR REPLACE FUNCTION find_friends_from_contacts(
  p_user_id UUID,
  p_phone_hashes TEXT[]
)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  is_following BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    EXISTS(
      SELECT 1 FROM follows f
      WHERE f.follower_id = p_user_id
        AND f.following_user_id = p.id
    )
  FROM profiles p
  WHERE p.phone_hash = ANY(p_phone_hashes)
    AND p.id != p_user_id
    AND p.is_public = true
  ORDER BY p.display_name, p.username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGER: Recalculate on Like/Unlike
-- ============================================
CREATE OR REPLACE FUNCTION trigger_recalculate_on_like()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Mark user's recommendations as needing update
    UPDATE profiles
    SET last_recommendation_update = NULL
    WHERE id = NEW.user_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles
    SET last_recommendation_update = NULL
    WHERE id = OLD.user_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if not exists
DROP TRIGGER IF EXISTS trigger_recommendation_on_like ON likes;
CREATE TRIGGER trigger_recommendation_on_like
AFTER INSERT OR DELETE ON likes
FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_on_like();

-- ============================================
-- TRIGGER: Recalculate on Follow/Unfollow Artist
-- ============================================
CREATE OR REPLACE FUNCTION trigger_recalculate_on_follow()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.following_artist_id IS NOT NULL THEN
    UPDATE profiles
    SET last_recommendation_update = NULL
    WHERE id = NEW.follower_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' AND OLD.following_artist_id IS NOT NULL THEN
    UPDATE profiles
    SET last_recommendation_update = NULL
    WHERE id = OLD.follower_id;
    RETURN OLD;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger if not exists
DROP TRIGGER IF EXISTS trigger_recommendation_on_follow ON follows;
CREATE TRIGGER trigger_recommendation_on_follow
AFTER INSERT OR DELETE ON follows
FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_on_follow();
