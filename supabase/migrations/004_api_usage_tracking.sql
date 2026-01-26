-- API Usage Tracking Table
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service TEXT NOT NULL,  -- 'acrcloud', 'supabase', 'soundcloud', 'openai', 'youtube', etc.
  endpoint TEXT,          -- specific endpoint called
  method TEXT DEFAULT 'GET',
  status_code INTEGER,
  response_time_ms INTEGER,
  tokens_used INTEGER,    -- for AI APIs
  cost_estimate DECIMAL(10, 6),  -- estimated cost in USD
  user_id UUID REFERENCES profiles(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_api_usage_service ON api_usage(service);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_service_date ON api_usage(service, created_at);

-- Enable RLS
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- Only service role can insert (from API routes)
CREATE POLICY "Service role can insert api_usage"
  ON api_usage FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Service role can read all
CREATE POLICY "Service role can read api_usage"
  ON api_usage FOR SELECT
  TO service_role
  USING (true);

-- Function to get daily API usage summary
CREATE OR REPLACE FUNCTION get_api_usage_summary(days_back INTEGER DEFAULT 7)
RETURNS TABLE (
  service TEXT,
  total_calls BIGINT,
  avg_response_time NUMERIC,
  error_count BIGINT,
  total_tokens BIGINT,
  estimated_cost NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    api_usage.service,
    COUNT(*)::BIGINT as total_calls,
    AVG(response_time_ms)::NUMERIC as avg_response_time,
    COUNT(*) FILTER (WHERE status_code >= 400)::BIGINT as error_count,
    COALESCE(SUM(tokens_used), 0)::BIGINT as total_tokens,
    COALESCE(SUM(cost_estimate), 0)::NUMERIC as estimated_cost
  FROM api_usage
  WHERE created_at >= NOW() - (days_back || ' days')::INTERVAL
  GROUP BY api_usage.service
  ORDER BY total_calls DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
