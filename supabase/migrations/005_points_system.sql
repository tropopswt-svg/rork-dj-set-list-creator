-- Point transactions table for history and breakdown
CREATE TABLE point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  related_id TEXT,
  category TEXT NOT NULL,
  is_synced_from_anonymous BOOLEAN DEFAULT false,
  anonymous_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_point_transactions_user ON point_transactions(user_id);
CREATE INDEX idx_point_transactions_user_reason ON point_transactions(user_id, reason);
CREATE INDEX idx_point_transactions_related ON point_transactions(user_id, reason, related_id);

-- Enable Row Level Security
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transactions
CREATE POLICY "Users can view own transactions" ON point_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own transactions
CREATE POLICY "Users can insert own transactions" ON point_transactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add breakdown columns to profiles (for quick access without aggregating)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS points_voting INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS points_contributions INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS points_track_ids INTEGER DEFAULT 0;
