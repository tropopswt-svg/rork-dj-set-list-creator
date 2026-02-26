-- ACRCloud File Scanning columns on sets table
ALTER TABLE sets ADD COLUMN IF NOT EXISTS acr_scan_status TEXT DEFAULT NULL;
  -- NULL | 'submitted' | 'processing' | 'completed' | 'failed'
ALTER TABLE sets ADD COLUMN IF NOT EXISTS acr_scan_task_id TEXT DEFAULT NULL;
ALTER TABLE sets ADD COLUMN IF NOT EXISTS acr_scan_submitted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE sets ADD COLUMN IF NOT EXISTS acr_scan_completed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE sets ADD COLUMN IF NOT EXISTS acr_scan_error TEXT DEFAULT NULL;
ALTER TABLE sets ADD COLUMN IF NOT EXISTS acr_scan_result JSONB DEFAULT NULL;
  -- Raw segments stored for debugging/reprocessing
