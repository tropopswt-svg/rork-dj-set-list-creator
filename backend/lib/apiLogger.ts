import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

export type ApiService = 'acrcloud' | 'soundcloud' | 'youtube' | 'openai' | 'beatport' | 'supabase' | 'other';

interface ApiLogEntry {
  service: ApiService;
  endpoint?: string;
  method?: string;
  status_code?: number;
  response_time_ms?: number;
  tokens_used?: number;
  cost_estimate?: number;
  user_id?: string;
  metadata?: Record<string, any>;
}

// Cost estimates per API call (approximate USD)
export const API_COSTS: Record<string, number> = {
  acrcloud_identify: 0.001,      // ~$0.001 per identification
  openai_gpt4: 0.00003,          // ~$0.03 per 1K tokens (input)
  openai_gpt35: 0.000002,        // ~$0.002 per 1K tokens
  soundcloud_resolve: 0,         // Free API
  youtube_stream: 0,             // Free (uses yt-dlp)
};

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabaseClient && supabaseUrl && supabaseServiceKey) {
    supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabaseClient;
}

export async function logApiCall(entry: ApiLogEntry): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    // Silently skip if not configured
    return;
  }

  try {
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
    // Silently ignore logging errors - don't break the main flow
    console.warn('[ApiLogger] Failed to log API call:', error);
  }
}

// Helper to wrap fetch calls with logging
export async function fetchWithLogging(
  url: string,
  options: RequestInit,
  logOptions: {
    service: ApiService;
    endpoint?: string;
    costPerCall?: number;
    metadata?: Record<string, any>;
  }
): Promise<Response> {
  const startTime = Date.now();
  let statusCode = 0;

  try {
    const response = await fetch(url, options);
    statusCode = response.status;
    return response;
  } catch (error) {
    statusCode = 0; // Network error
    throw error;
  } finally {
    const responseTime = Date.now() - startTime;

    // Log asynchronously - don't block the response
    logApiCall({
      service: logOptions.service,
      endpoint: logOptions.endpoint || new URL(url).pathname,
      method: options.method || 'GET',
      status_code: statusCode,
      response_time_ms: responseTime,
      cost_estimate: statusCode >= 200 && statusCode < 400 ? logOptions.costPerCall : 0,
      metadata: logOptions.metadata,
    }).catch(() => {});
  }
}

// Specific loggers for common services
export async function logACRCloudCall(
  endpoint: string,
  statusCode: number,
  responseTimeMs: number,
  metadata?: Record<string, any>
): Promise<void> {
  await logApiCall({
    service: 'acrcloud',
    endpoint,
    method: 'POST',
    status_code: statusCode,
    response_time_ms: responseTimeMs,
    cost_estimate: statusCode >= 200 && statusCode < 400 ? API_COSTS.acrcloud_identify : 0,
    metadata,
  });
}

export async function logSoundCloudCall(
  endpoint: string,
  statusCode: number,
  responseTimeMs: number,
  metadata?: Record<string, any>
): Promise<void> {
  await logApiCall({
    service: 'soundcloud',
    endpoint,
    method: 'GET',
    status_code: statusCode,
    response_time_ms: responseTimeMs,
    cost_estimate: 0, // SoundCloud API is free
    metadata,
  });
}

export async function logYouTubeCall(
  endpoint: string,
  statusCode: number,
  responseTimeMs: number,
  metadata?: Record<string, any>
): Promise<void> {
  await logApiCall({
    service: 'youtube',
    endpoint,
    method: 'GET',
    status_code: statusCode,
    response_time_ms: responseTimeMs,
    cost_estimate: 0, // Using yt-dlp, no API cost
    metadata,
  });
}
