// Queue-based track validation via Spotify API
// Cron-invoked every 10 minutes — processes 5 jobs per run
// Uses track_validation_jobs queue from migration 018
import { getSupabaseClient, getSpotifyToken, searchTrackOnSpotify } from './_lib/spotify-core.js';
import { checkCache, writeCache, canMakeRequest, recordRateLimit } from './_lib/spotify-cache.js';

const BATCH_SIZE = 5;
const DELAY_MS = 2500; // 2.5s between API calls (conservative)
const STALE_LOCK_MINUTES = 5;
const WORKER_ID = `validate-${Date.now()}`;

export default async function handler(req, res) {
  // Verify cron secret
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  // GET: return queue stats
  if (req.method === 'GET') {
    const { count: queued } = await supabase
      .from('track_validation_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued');

    const { count: processing } = await supabase
      .from('track_validation_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing');

    const { count: done } = await supabase
      .from('track_validation_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'done');

    const { count: failed } = await supabase
      .from('track_validation_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed');

    return res.status(200).json({ queued, processing, done, failed });
  }

  const token = await getSpotifyToken();
  if (!token) {
    return res.status(500).json({ error: 'Spotify credentials not configured' });
  }

  const results = {
    processed: 0,
    verified: 0,
    unmatched: 0,
    cacheHits: 0,
    failed: 0,
    rateLimited: false,
    staleRecovered: 0,
  };

  try {
    // Recover stale locks (processing for >5 minutes)
    const staleThreshold = new Date(Date.now() - STALE_LOCK_MINUTES * 60 * 1000).toISOString();
    const { data: staleJobs } = await supabase
      .from('track_validation_jobs')
      .update({ status: 'queued', locked_at: null, locked_by: null })
      .eq('status', 'processing')
      .lt('locked_at', staleThreshold)
      .select('id');
    results.staleRecovered = staleJobs?.length || 0;

    // Pick jobs: queued, run_after <= now, ordered by priority then age
    const { data: jobs, error: pickError } = await supabase
      .from('track_validation_jobs')
      .select('id, track_id, attempts, max_attempts, payload')
      .eq('status', 'queued')
      .lte('run_after', new Date().toISOString())
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (pickError) throw pickError;
    if (!jobs || jobs.length === 0) {
      return res.status(200).json({ success: true, message: 'No jobs to process', ...results });
    }

    // Lock all picked jobs
    const jobIds = jobs.map(j => j.id);
    await supabase
      .from('track_validation_jobs')
      .update({ status: 'processing', locked_at: new Date().toISOString(), locked_by: WORKER_ID })
      .in('id', jobIds);

    // Fetch track details for all jobs
    const trackIds = jobs.map(j => j.track_id);
    const { data: tracks } = await supabase
      .from('tracks')
      .select('id, title, artist_name')
      .in('id', trackIds);

    const trackMap = new Map((tracks || []).map(t => [t.id, t]));

    for (const job of jobs) {
      if (results.rateLimited) {
        // Requeue remaining jobs with delay
        await supabase
          .from('track_validation_jobs')
          .update({
            status: 'queued',
            locked_at: null,
            locked_by: null,
            run_after: new Date(Date.now() + 60 * 1000).toISOString(),
          })
          .eq('id', job.id);
        continue;
      }

      const track = trackMap.get(job.track_id);
      if (!track || !track.artist_name || !track.title) {
        await supabase
          .from('track_validation_jobs')
          .update({ status: 'skipped', error: 'Missing track data' })
          .eq('id', job.id);
        continue;
      }

      try {
        // Cache-first: check spotify_track_cache before any API call
        const cached = await checkCache(supabase, track.artist_name, track.title);
        let spotifyData = null;

        if (cached) {
          spotifyData = cached.found ? cached.spotify_data : null;
          results.cacheHits++;
        } else {
          // Check rate limit budget before API call
          const budget = await canMakeRequest(supabase);
          if (!budget.allowed) {
            results.rateLimited = true;
            // Requeue this job
            await supabase
              .from('track_validation_jobs')
              .update({
                status: 'queued',
                locked_at: null,
                locked_by: null,
                run_after: new Date(Date.now() + 60 * 1000).toISOString(),
              })
              .eq('id', job.id);
            continue;
          }

          await new Promise(r => setTimeout(r, DELAY_MS));
          spotifyData = await searchTrackOnSpotify(token, track.artist_name, track.title);

          // Handle rate limiting from Spotify
          if (spotifyData?._rateLimited) {
            await recordRateLimit(supabase, spotifyData._retryAfter || 60);
            results.rateLimited = true;
            // Requeue this job
            await supabase
              .from('track_validation_jobs')
              .update({
                status: 'queued',
                locked_at: null,
                locked_by: null,
                run_after: new Date(Date.now() + (spotifyData._retryAfter || 60) * 1000).toISOString(),
              })
              .eq('id', job.id);
            continue;
          }

          // Write to cache
          await writeCache(supabase, track.artist_name, track.title, !!spotifyData, spotifyData);
        }

        const now = new Date().toISOString();

        if (spotifyData && !spotifyData._rateLimited) {
          // Match found — update track + external IDs
          const trackUpdate = {
            validation_status: 'verified',
            validation_confidence: 0.850,
            validation_source: 'spotify',
            last_validated_at: now,
            spotify_track_id: spotifyData.spotify_id,
          };

          // Parse release_date with format awareness
          if (spotifyData.release_date) {
            const rd = spotifyData.release_date;
            let precision = 'year';
            if (/^\d{4}-\d{2}-\d{2}$/.test(rd)) precision = 'day';
            else if (/^\d{4}-\d{2}$/.test(rd)) precision = 'month';

            trackUpdate.spotify_release_precision = precision;
            // Only set date if full precision; otherwise store year only
            if (precision === 'day') {
              trackUpdate.spotify_release_date = rd;
            } else if (precision === 'month') {
              trackUpdate.spotify_release_date = `${rd}-01`;
            } else {
              trackUpdate.spotify_release_date = `${rd}-01-01`;
            }

            const year = parseInt(rd.substring(0, 4), 10);
            if (year > 1900 && year < 2100) trackUpdate.release_year = year;
          }

          // Note: searchTrackOnSpotify returns album name and artist names,
          // not Spotify IDs for those fields. spotify_album_id and
          // spotify_artist_ids require raw API data we don't have here.

          await supabase.from('tracks').update(trackUpdate).eq('id', track.id);

          // Insert into track_external_ids
          await supabase.from('track_external_ids').upsert({
            track_id: track.id,
            provider: 'spotify',
            external_id: spotifyData.spotify_id,
            external_url: spotifyData.spotify_url || null,
            confidence: 0.850,
            is_primary: true,
          }, { onConflict: 'provider,external_id' });

          // Mark job done
          await supabase
            .from('track_validation_jobs')
            .update({ status: 'done', locked_at: null, locked_by: null, attempts: job.attempts + 1 })
            .eq('id', job.id);

          results.verified++;
        } else {
          // No match — mark unmatched (cache said not-found, or API returned null)
          await supabase.from('tracks').update({
            validation_status: 'unmatched',
            last_validated_at: now,
            validation_source: 'spotify',
          }).eq('id', track.id);

          await supabase
            .from('track_validation_jobs')
            .update({ status: 'done', locked_at: null, locked_by: null, attempts: job.attempts + 1 })
            .eq('id', job.id);

          results.unmatched++;
        }

        results.processed++;
      } catch (jobError) {
        console.error(`Validation job ${job.id} error:`, jobError.message);

        const nextAttempt = job.attempts + 1;
        if (nextAttempt >= job.max_attempts) {
          await supabase
            .from('track_validation_jobs')
            .update({ status: 'failed', error: jobError.message, attempts: nextAttempt, locked_at: null, locked_by: null })
            .eq('id', job.id);
        } else {
          // Exponential backoff: 2^attempts * 30s
          const backoffMs = Math.pow(2, nextAttempt) * 30 * 1000;
          await supabase
            .from('track_validation_jobs')
            .update({
              status: 'queued',
              attempts: nextAttempt,
              error: jobError.message,
              locked_at: null,
              locked_by: null,
              run_after: new Date(Date.now() + backoffMs).toISOString(),
            })
            .eq('id', job.id);
        }

        results.failed++;
      }
    }

    return res.status(200).json({ success: true, ...results });
  } catch (error) {
    console.error('validate-tracks error:', error);
    return res.status(500).json({ error: error.message });
  }
}
