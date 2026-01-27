# Supabase Setup Guide

This guide walks you through setting up Supabase for the TRACK'D artist/track database.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Choose your organization
4. Enter a project name (e.g., "trackd-db")
5. Generate a strong database password (save it!)
6. Select a region close to your users
7. Click **Create new project**

Wait for the project to be created (takes ~2 minutes).

## 2. Get Your API Keys

1. In your Supabase dashboard, go to **Project Settings** (gear icon)
2. Click **API** in the sidebar
3. Copy these values:
   - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
   - **anon public** key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## 3. Add Keys to Your Environment

Add these to your `.env` file:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
```

## 4. Run the Database Migration

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New query**
3. Copy the contents of `supabase/migrations/001_initial_schema.sql`
4. Paste it into the SQL editor
5. Click **Run** (or press Cmd+Enter)

You should see "Success. No rows returned" - this means the tables were created.

## 5. Verify the Setup

Check that tables were created:

1. Go to **Table Editor** in the sidebar
2. You should see these tables:
   - `artists`
   - `artist_aliases`
   - `tracks`
   - `track_aliases`
   - `sets`
   - `set_tracks`

## 6. (Optional) Seed with Initial Artists

You can manually add some artists to start:

```sql
INSERT INTO artists (name, slug, genres) VALUES
  ('Chris Stussy', 'chris-stussy', ARRAY['house', 'tech house']),
  ('Seth Troxler', 'seth-troxler', ARRAY['house', 'techno']),
  ('Peggy Gou', 'peggy-gou', ARRAY['house', 'techno']),
  ('John Summit', 'john-summit', ARRAY['tech house']),
  ('Fisher', 'fisher', ARRAY['tech house']);

-- Add aliases for better matching
INSERT INTO artist_aliases (artist_id, alias, alias_lower)
SELECT id, name, LOWER(name) FROM artists;
```

## Database Schema

### Artists Table
- `id` - UUID primary key
- `name` - Display name
- `slug` - URL-friendly name (e.g., "chris-stussy")
- `image_url` - Profile image
- `genres` - Array of genre tags
- `verified` - Whether this artist is verified
- Social links (Spotify, SoundCloud, Instagram, etc.)

### Tracks Table
- `id` - UUID primary key
- `title` - Track title
- `title_normalized` - Lowercase version for matching
- `artist_id` - Foreign key to artists
- `artist_name` - Denormalized for display
- `remix_artist_id` - For remixes
- `label`, `release_year`, `is_unreleased`
- Streaming links (Spotify, Beatport, etc.)

### Matching System

When a track is identified, the system:
1. **Exact match** - Checks if artist name exists exactly
2. **Alias match** - Checks `artist_aliases` for alternative names
3. **Fuzzy match** - Uses Levenshtein distance for 80%+ similarity

This allows matching:
- "Chris Stussy" → Chris Stussy ✓
- "C. Stussy" → Chris Stussy ✓ (via alias)
- "Chirs Stussy" → Chris Stussy ✓ (via fuzzy)

## API Usage

```typescript
import { 
  findArtist, 
  getOrCreateArtist, 
  findTrack,
  getOrCreateTrack 
} from '@/lib/supabase';

// Find an artist
const match = await findArtist('Chris Stussy');
if (match) {
  console.log(match.artist.name); // "Chris Stussy"
  console.log(match.confidence);  // 1 (exact match)
}

// Get or create (finds existing or creates new)
const { artist, isNew } = await getOrCreateArtist('New Artist');

// Find a track
const trackMatch = await findTrack('Bounce to Beat', 'Chris Stussy');

// Get or create track
const { track, isNew } = await getOrCreateTrack(
  'Bounce to Beat',
  'Chris Stussy',
  { label: 'PIV Records', release_year: 2023 }
);
```

## Troubleshooting

### "Supabase not configured" warning
Make sure your `.env` file has both:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### RLS Policy Errors
If you get permission errors, make sure RLS policies were created.
Run the migration SQL again - the policies are at the bottom.

### Connection Issues
- Check your Supabase project is active (not paused)
- Verify the URL doesn't have a trailing slash
- Make sure you're using the `anon` key, not the `service_role` key
