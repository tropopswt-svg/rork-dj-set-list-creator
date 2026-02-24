-- Freshness, alerts, and ingestion pipeline tables
-- Additive only. Designed to complement existing social/recommendation schema.

-- ============================================================
-- SET FRESHNESS EVENTS (powers "recently updated" and "new IDs solved")
-- ============================================================
CREATE TABLE IF NOT EXISTS set_freshness_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id UUID NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'set_created',
    'track_added',
    'track_identified',
    'track_reclassified',
    'metadata_updated'
  )),
  track_id UUID REFERENCES tracks(id) ON DELETE SET NULL,
  set_track_id UUID REFERENCES set_tracks(id) ON DELETE SET NULL,
  previous_public_status TEXT CHECK (previous_public_status IN ('released','unreleased','id')),
  new_public_status TEXT CHECK (new_public_status IN ('released','unreleased','id')),
  source TEXT, -- spotify|manual|import|community|system
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_set_freshness_set_created ON set_freshness_events(set_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_set_freshness_type_created ON set_freshness_events(event_type, created_at DESC);

ALTER TABLE set_freshness_events ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='set_freshness_events' AND policyname='Public read access set_freshness_events'
  ) THEN
    CREATE POLICY "Public read access set_freshness_events"
      ON set_freshness_events FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='set_freshness_events' AND policyname='Allow inserts set_freshness_events'
  ) THEN
    CREATE POLICY "Allow inserts set_freshness_events"
      ON set_freshness_events FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- USER ALERT SUBSCRIPTIONS (set/artist/track alerts)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_alert_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'artist_new_set',
    'set_updated',
    'track_released',
    'track_identified'
  )),
  artist_id UUID REFERENCES artists(id) ON DELETE CASCADE,
  set_id UUID REFERENCES sets(id) ON DELETE CASCADE,
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Keep one active subscription per exact scope
  UNIQUE(user_id, alert_type, artist_id, set_id, track_id)
);

CREATE INDEX IF NOT EXISTS idx_user_alert_subscriptions_user ON user_alert_subscriptions(user_id, enabled);
CREATE INDEX IF NOT EXISTS idx_user_alert_subscriptions_artist ON user_alert_subscriptions(artist_id) WHERE artist_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_alert_subscriptions_set ON user_alert_subscriptions(set_id) WHERE set_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_alert_subscriptions_track ON user_alert_subscriptions(track_id) WHERE track_id IS NOT NULL;

ALTER TABLE user_alert_subscriptions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_alert_subscriptions' AND policyname='Users manage own alert subscriptions'
  ) THEN
    CREATE POLICY "Users manage own alert subscriptions"
      ON user_alert_subscriptions FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS user_alert_subscriptions_updated_at ON user_alert_subscriptions;
CREATE TRIGGER user_alert_subscriptions_updated_at
  BEFORE UPDATE ON user_alert_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- INGESTION PIPELINE TABLES (for scale + source tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS source_ingest_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_platform TEXT NOT NULL CHECK (source_platform IN ('1001tracklists','youtube','soundcloud','mixcloud','manual')),
  source_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','done','failed','skipped')),
  priority INTEGER NOT NULL DEFAULT 100,
  run_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  dedupe_key TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  last_error TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_platform, source_url)
);

CREATE INDEX IF NOT EXISTS idx_source_ingest_jobs_pick
  ON source_ingest_jobs(status, run_after, priority, created_at)
  WHERE status='queued';

CREATE INDEX IF NOT EXISTS idx_source_ingest_jobs_status ON source_ingest_jobs(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS source_ingest_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES source_ingest_jobs(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','done','failed','skipped')),
  sets_created INTEGER NOT NULL DEFAULT 0,
  sets_updated INTEGER NOT NULL DEFAULT 0,
  tracks_created INTEGER NOT NULL DEFAULT 0,
  tracks_linked INTEGER NOT NULL DEFAULT 0,
  tracks_reclassified INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  metrics JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_source_ingest_runs_job ON source_ingest_runs(job_id, started_at DESC);

ALTER TABLE source_ingest_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_ingest_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='source_ingest_jobs' AND policyname='Allow read ingest jobs'
  ) THEN
    CREATE POLICY "Allow read ingest jobs" ON source_ingest_jobs FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='source_ingest_jobs' AND policyname='Allow write ingest jobs'
  ) THEN
    CREATE POLICY "Allow write ingest jobs" ON source_ingest_jobs FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='source_ingest_runs' AND policyname='Allow read ingest runs'
  ) THEN
    CREATE POLICY "Allow read ingest runs" ON source_ingest_runs FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='source_ingest_runs' AND policyname='Allow write ingest runs'
  ) THEN
    CREATE POLICY "Allow write ingest runs" ON source_ingest_runs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DROP TRIGGER IF EXISTS source_ingest_jobs_updated_at ON source_ingest_jobs;
CREATE TRIGGER source_ingest_jobs_updated_at
  BEFORE UPDATE ON source_ingest_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Queue helper function
CREATE OR REPLACE FUNCTION enqueue_ingest_job(
  p_source_platform TEXT,
  p_source_url TEXT,
  p_priority INTEGER DEFAULT 100,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO source_ingest_jobs (source_platform, source_url, priority, payload, status)
  VALUES (p_source_platform, p_source_url, p_priority, COALESCE(p_payload, '{}'::jsonb), 'queued')
  ON CONFLICT (source_platform, source_url)
  DO UPDATE SET
    priority = LEAST(source_ingest_jobs.priority, EXCLUDED.priority),
    status = CASE
      WHEN source_ingest_jobs.status IN ('failed','skipped') THEN 'queued'
      ELSE source_ingest_jobs.status
    END,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Optional freshness view for feed sorting
CREATE OR REPLACE VIEW sets_freshness AS
SELECT
  s.id AS set_id,
  s.title,
  s.dj_name,
  MAX(e.created_at) AS last_activity_at,
  COUNT(*) FILTER (WHERE e.event_type='track_identified' AND e.created_at > now() - interval '7 days') AS ids_solved_7d,
  COUNT(*) FILTER (WHERE e.event_type='track_reclassified' AND e.created_at > now() - interval '7 days') AS reclassified_7d
FROM sets s
LEFT JOIN set_freshness_events e ON e.set_id = s.id
GROUP BY s.id, s.title, s.dj_name;
