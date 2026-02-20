-- Add cover_url column to sets table (missing from migration 002)
ALTER TABLE sets ADD COLUMN IF NOT EXISTS cover_url TEXT;
