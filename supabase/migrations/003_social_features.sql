-- Social Features Migration
-- Adds user profiles, following, likes, comments, and activity feed

-- ============================================
-- PROFILES TABLE
-- Extends Supabase auth.users with app-specific data
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  website TEXT,

  -- Stats (denormalized for performance)
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  sets_saved_count INTEGER DEFAULT 0,
  contributions_count INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,

  -- Preferences
  favorite_genres TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT true,
  show_contributions BOOLEAN DEFAULT true,
  show_favorites BOOLEAN DEFAULT true,

  -- Notifications
  push_notifications BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  weekly_digest BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for username lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- ============================================
-- FOLLOWS TABLE
-- Supports following both users and artists
-- ============================================
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Polymorphic: can follow a user OR an artist
  following_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  following_artist_id UUID REFERENCES artists(id) ON DELETE CASCADE,

  -- Ensure exactly one of user or artist is set
  CONSTRAINT follow_target_check CHECK (
    (following_user_id IS NOT NULL AND following_artist_id IS NULL) OR
    (following_user_id IS NULL AND following_artist_id IS NOT NULL)
  ),

  -- Prevent duplicate follows
  CONSTRAINT unique_user_follow UNIQUE (follower_id, following_user_id),
  CONSTRAINT unique_artist_follow UNIQUE (follower_id, following_artist_id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_user ON follows(following_user_id) WHERE following_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_follows_artist ON follows(following_artist_id) WHERE following_artist_id IS NOT NULL;

-- ============================================
-- LIKES TABLE
-- Users can like sets
-- ============================================
CREATE TABLE IF NOT EXISTS likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  set_id UUID NOT NULL REFERENCES sets(id) ON DELETE CASCADE,

  -- Prevent duplicate likes
  CONSTRAINT unique_like UNIQUE (user_id, set_id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_set ON likes(set_id);

-- ============================================
-- COMMENTS TABLE
-- Users can comment on sets
-- ============================================
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  set_id UUID NOT NULL REFERENCES sets(id) ON DELETE CASCADE,

  -- Comment content
  content TEXT NOT NULL,

  -- Optional: reply to another comment
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,

  -- For track-specific comments (e.g., "what's this track at 1:23:45?")
  timestamp_seconds INTEGER,

  -- Moderation
  is_edited BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_comments_set ON comments(set_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id) WHERE parent_id IS NOT NULL;

-- ============================================
-- SAVED SETS TABLE
-- Users can save sets to their library
-- ============================================
CREATE TABLE IF NOT EXISTS saved_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  set_id UUID NOT NULL REFERENCES sets(id) ON DELETE CASCADE,

  -- Optional: organize into collections
  collection_name TEXT,

  -- Prevent duplicates
  CONSTRAINT unique_saved_set UNIQUE (user_id, set_id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_sets_user ON saved_sets(user_id);

-- ============================================
-- CONTRIBUTIONS TABLE
-- Track when users contribute track IDs
-- ============================================
CREATE TABLE IF NOT EXISTS contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  set_id UUID NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  set_track_id UUID REFERENCES set_tracks(id) ON DELETE SET NULL,

  -- What they contributed
  contribution_type TEXT NOT NULL CHECK (contribution_type IN ('track_id', 'source_link', 'correction', 'verification')),

  -- For track_id contributions
  track_title TEXT,
  track_artist TEXT,
  timestamp_seconds INTEGER,

  -- For source_link contributions
  source_url TEXT,
  source_platform TEXT,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),

  -- Points awarded
  points_awarded INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES profiles(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contributions_user ON contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_contributions_set ON contributions(set_id);
CREATE INDEX IF NOT EXISTS idx_contributions_status ON contributions(status);

-- ============================================
-- ACTIVITY FEED TABLE
-- Denormalized table for efficient feed queries
-- ============================================
CREATE TABLE IF NOT EXISTS activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who performed the action
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- What type of activity
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'new_set',           -- User's followed artist released a new set
    'track_id',          -- User identified a track
    'like_set',          -- User liked a set
    'comment',           -- User commented on a set
    'follow_user',       -- User followed another user
    'follow_artist',     -- User followed an artist
    'save_set'           -- User saved a set
  )),

  -- Related entities (nullable based on activity type)
  set_id UUID REFERENCES sets(id) ON DELETE CASCADE,
  artist_id UUID REFERENCES artists(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  contribution_id UUID REFERENCES contributions(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,

  -- Denormalized data for faster feed rendering
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for feed queries
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_type ON activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_set ON activity(set_id) WHERE set_id IS NOT NULL;

-- Composite index for feed generation (activities from followed users)
CREATE INDEX IF NOT EXISTS idx_activity_feed ON activity(user_id, created_at DESC);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Notification type
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'new_follower',
    'like_on_contribution',
    'comment_reply',
    'contribution_verified',
    'contribution_rejected',
    'artist_new_set'
  )),

  -- Related entities
  from_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  set_id UUID REFERENCES sets(id) ON DELETE CASCADE,
  artist_id UUID REFERENCES artists(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  contribution_id UUID REFERENCES contributions(id) ON DELETE CASCADE,

  -- Content
  title TEXT NOT NULL,
  body TEXT,

  -- Status
  is_read BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles: Public read for public profiles, users can update own
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (is_public = true OR auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Follows: Users can manage their own follows, anyone can see public follows
CREATE POLICY "Anyone can view follows" ON follows
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own follows" ON follows
  FOR ALL USING (auth.uid() = follower_id);

-- Likes: Public read, users manage own
CREATE POLICY "Anyone can view likes" ON likes
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own likes" ON likes
  FOR ALL USING (auth.uid() = user_id);

-- Comments: Public read, users manage own
CREATE POLICY "Anyone can view comments" ON comments
  FOR SELECT USING (is_deleted = false);

CREATE POLICY "Users can manage own comments" ON comments
  FOR ALL USING (auth.uid() = user_id);

-- Saved sets: Only owner can see/manage
CREATE POLICY "Users can view own saved sets" ON saved_sets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own saved sets" ON saved_sets
  FOR ALL USING (auth.uid() = user_id);

-- Contributions: Public read, users manage own
CREATE POLICY "Anyone can view contributions" ON contributions
  FOR SELECT USING (true);

CREATE POLICY "Users can create contributions" ON contributions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Activity: Users see activity from people they follow + own
CREATE POLICY "Users can view relevant activity" ON activity
  FOR SELECT USING (
    auth.uid() = user_id OR
    user_id IN (
      SELECT following_user_id FROM follows WHERE follower_id = auth.uid()
    )
  );

CREATE POLICY "System can insert activity" ON activity
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Notifications: Only owner can see/manage
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- TRIGGERS FOR DENORMALIZATION
-- ============================================

-- Update follower/following counts
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment follower's following_count
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;

    -- Increment followed user's followers_count (if following a user)
    IF NEW.following_user_id IS NOT NULL THEN
      UPDATE profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_user_id;
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement follower's following_count
    UPDATE profiles SET following_count = following_count - 1 WHERE id = OLD.follower_id;

    -- Decrement followed user's followers_count (if following a user)
    IF OLD.following_user_id IS NOT NULL THEN
      UPDATE profiles SET followers_count = followers_count - 1 WHERE id = OLD.following_user_id;
    END IF;

    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_follow_counts
AFTER INSERT OR DELETE ON follows
FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- Update contribution counts and points
CREATE OR REPLACE FUNCTION update_contribution_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET contributions_count = contributions_count + 1 WHERE id = NEW.user_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'verified' AND OLD.status != 'verified' THEN
    -- Award points when contribution is verified
    UPDATE profiles SET points = points + NEW.points_awarded WHERE id = NEW.user_id;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_contribution_stats
AFTER INSERT OR UPDATE ON contributions
FOR EACH ROW EXECUTE FUNCTION update_contribution_stats();

-- Update saved sets count
CREATE OR REPLACE FUNCTION update_saved_sets_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET sets_saved_count = sets_saved_count + 1 WHERE id = NEW.user_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET sets_saved_count = sets_saved_count - 1 WHERE id = OLD.user_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_saved_sets_count
AFTER INSERT OR DELETE ON saved_sets
FOR EACH ROW EXECUTE FUNCTION update_saved_sets_count();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users (if not exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- Add likes_count to sets table
-- ============================================
ALTER TABLE sets ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
ALTER TABLE sets ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0;

-- Update likes count on sets
CREATE OR REPLACE FUNCTION update_set_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE sets SET likes_count = likes_count + 1 WHERE id = NEW.set_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE sets SET likes_count = likes_count - 1 WHERE id = OLD.set_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_set_likes_count
AFTER INSERT OR DELETE ON likes
FOR EACH ROW EXECUTE FUNCTION update_set_likes_count();

-- Update comments count on sets
CREATE OR REPLACE FUNCTION update_set_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE sets SET comments_count = comments_count + 1 WHERE id = NEW.set_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE sets SET comments_count = comments_count - 1 WHERE id = OLD.set_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_set_comments_count
AFTER INSERT OR DELETE ON comments
FOR EACH ROW EXECUTE FUNCTION update_set_comments_count();
