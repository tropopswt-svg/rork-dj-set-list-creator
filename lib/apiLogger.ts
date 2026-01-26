import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

interface ApiLogEntry {
  service: 'acrcloud' | 'soundcloud' | 'youtube' | 'openai' | 'beatport' | 'supabase' | 'other';
  endpoint?: string;
  method?: string;
  status_code?: number;
  response_time_ms?: number;
  tokens_used?: number;
  cost_estimate?: number;
  user_id?: string;
  metadata?: Record<string, any>;
}

export async function logApiCall(entry: ApiLogEntry): Promise<void> {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('[ApiLogger] Supabase not configured, skipping log');
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    await supabase.from('api_usage').insert({
      service: entry.service,
      endpoint: entry.endpoint,
      method: entry.method || 'GET',
      status_code: entry.status_code,
      response_time_ms: entry.response_time_ms,
      tokens_used: entry.tokens_used,
      cost_estimate: entry.cost_estimate,
      user_id: entry.user_id,
      metadata: entry.metadata || {},
    });
  } catch (error) {
    console.error('[ApiLogger] Failed to log API call:', error);
  }
}

// Wrapper to time API calls
export async function withApiLogging<T>(
  service: ApiLogEntry['service'],
  endpoint: string,
  fn: () => Promise<T>,
  options?: {
    method?: string;
    user_id?: string;
    tokensUsed?: number;
    costEstimate?: number;
    metadata?: Record<string, any>;
  }
): Promise<T> {
  const startTime = Date.now();
  let statusCode = 200;

  try {
    const result = await fn();
    return result;
  } catch (error: any) {
    statusCode = error.status || error.statusCode || 500;
    throw error;
  } finally {
    const responseTime = Date.now() - startTime;

    // Log asynchronously - don't block the response
    logApiCall({
      service,
      endpoint,
      method: options?.method || 'GET',
      status_code: statusCode,
      response_time_ms: responseTime,
      tokens_used: options?.tokensUsed,
      cost_estimate: options?.costEstimate,
      user_id: options?.user_id,
      metadata: options?.metadata,
    }).catch(() => {}); // Silently ignore logging errors
  }
}

// Cost estimates per service (approximate)
export const API_COSTS = {
  acrcloud: 0.001,      // ~$0.001 per identification
  openai_gpt4: 0.03,    // ~$0.03 per 1K tokens (input)
  openai_gpt35: 0.002,  // ~$0.002 per 1K tokens
  soundcloud: 0,        // Free API
  youtube: 0,           // Free API (quota limited)
  beatport: 0,          // Scraping, no direct cost
};
