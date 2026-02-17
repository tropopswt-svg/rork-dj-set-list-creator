import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey);
}

export async function GET() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return NextResponse.json({
      error: 'Database not configured',
      debug: {
        hasUrl: !!process.env.SUPABASE_URL,
        hasKey: !!process.env.SUPABASE_SERVICE_KEY,
      }
    }, { status: 500 });
  }

  try {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    // User stats
    const [
      { count: totalUsers },
      { count: usersToday },
      { count: usersThisWeek },
      { count: usersThisMonth },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', monthAgo.toISOString()),
    ]);

    // Content stats
    const [
      { count: totalSets },
      { count: totalTracks },
      { count: totalArtists },
    ] = await Promise.all([
      supabase.from('sets').select('*', { count: 'exact', head: true }),
      supabase.from('tracks').select('*', { count: 'exact', head: true }),
      supabase.from('artists').select('*', { count: 'exact', head: true }),
    ]);

    // Engagement stats
    const [
      { count: totalLikes },
      { count: totalComments },
      { count: totalContributions },
      { count: likesToday },
      { count: commentsToday },
    ] = await Promise.all([
      supabase.from('likes').select('*', { count: 'exact', head: true }),
      supabase.from('comments').select('*', { count: 'exact', head: true }),
      supabase.from('contributions').select('*', { count: 'exact', head: true }),
      supabase.from('likes').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      supabase.from('comments').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
    ]);

    // Recent users (last 10)
    const { data: recentUsers } = await supabase
      .from('profiles')
      .select('id, username, display_name, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    // Recent activity (comments, likes combined view)
    const { data: recentComments } = await supabase
      .from('comments')
      .select('id, content, created_at, user_id, set_id')
      .order('created_at', { ascending: false })
      .limit(5);

    // Recent tracks
    const { data: recentTracks } = await supabase
      .from('tracks')
      .select('id, title, artist_name, label, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    // Tracks added today/this week
    const { count: tracksToday } = await supabase
      .from('tracks')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    const { count: tracksThisWeek } = await supabase
      .from('tracks')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString());

    // API Usage stats
    const { data: apiUsageByService } = await supabase
      .from('api_usage')
      .select('service, status_code, response_time_ms, tokens_used, cost_estimate, created_at')
      .gte('created_at', weekAgo.toISOString())
      .order('created_at', { ascending: false });

    // Aggregate API usage
    const apiUsageMap: Record<string, {
      calls: number;
      errors: number;
      avgResponseTime: number;
      totalTokens: number;
      totalCost: number;
      responseTimes: number[];
    }> = {};

    (apiUsageByService || []).forEach((log: any) => {
      if (!apiUsageMap[log.service]) {
        apiUsageMap[log.service] = {
          calls: 0,
          errors: 0,
          avgResponseTime: 0,
          totalTokens: 0,
          totalCost: 0,
          responseTimes: [],
        };
      }
      apiUsageMap[log.service].calls++;
      if (log.status_code >= 400) apiUsageMap[log.service].errors++;
      if (log.response_time_ms) apiUsageMap[log.service].responseTimes.push(log.response_time_ms);
      if (log.tokens_used) apiUsageMap[log.service].totalTokens += log.tokens_used;
      if (log.cost_estimate) apiUsageMap[log.service].totalCost += parseFloat(log.cost_estimate);
    });

    // Calculate averages
    const apiUsageStats = Object.entries(apiUsageMap).map(([service, data]) => ({
      service,
      calls: data.calls,
      errors: data.errors,
      errorRate: data.calls > 0 ? ((data.errors / data.calls) * 100).toFixed(1) : '0',
      avgResponseTime: data.responseTimes.length > 0
        ? Math.round(data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length)
        : 0,
      totalTokens: data.totalTokens,
      totalCost: data.totalCost.toFixed(4),
    })).sort((a, b) => b.calls - a.calls);

    // Today's API usage
    const { count: apiCallsToday } = await supabase
      .from('api_usage')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    // Total API cost this week
    const totalApiCostThisWeek = apiUsageStats.reduce((sum, s) => sum + parseFloat(s.totalCost), 0);

    // Daily user signups for the past 7 days
    const dailySignups = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', dayStart.toISOString())
        .lte('created_at', dayEnd.toISOString());

      dailySignups.push({
        date: dayStart.toISOString().split('T')[0],
        day: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
        count: count || 0,
      });
    }

    return NextResponse.json({
      success: true,
      stats: {
        users: {
          total: totalUsers || 0,
          today: usersToday || 0,
          thisWeek: usersThisWeek || 0,
          thisMonth: usersThisMonth || 0,
          dailySignups,
        },
        content: {
          sets: totalSets || 0,
          tracks: totalTracks || 0,
          artists: totalArtists || 0,
          tracksToday: tracksToday || 0,
          tracksThisWeek: tracksThisWeek || 0,
        },
        engagement: {
          likes: totalLikes || 0,
          comments: totalComments || 0,
          contributions: totalContributions || 0,
          likesToday: likesToday || 0,
          commentsToday: commentsToday || 0,
        },
        recentUsers: recentUsers || [],
        recentComments: recentComments || [],
        recentTracks: recentTracks || [],
        apiUsage: {
          byService: apiUsageStats,
          callsToday: apiCallsToday || 0,
          totalCostThisWeek: totalApiCostThisWeek.toFixed(4),
        },
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({
      error: 'Failed to fetch stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
