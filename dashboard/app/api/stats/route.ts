import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    // Core counts
    const [
      { count: trackCount },
      { count: artistCount },
      { count: setCount },
      { count: userCount },
      { count: contributionCount },
      { count: commentCount },
      { count: likeCount },
    ] = await Promise.all([
      supabase.from('tracks').select('*', { count: 'exact', head: true }),
      supabase.from('artists').select('*', { count: 'exact', head: true }),
      supabase.from('sets').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('contributions').select('*', { count: 'exact', head: true }),
      supabase.from('comments').select('*', { count: 'exact', head: true }),
      supabase.from('likes').select('*', { count: 'exact', head: true }),
    ]);

    // Source-specific counts
    const [
      { count: beatportTracks },
      { count: beatportArtists },
      { count: soundcloudTracks },
      { count: verifiedContributions },
      { count: pendingContributions },
    ] = await Promise.all([
      supabase.from('tracks').select('*', { count: 'exact', head: true }).not('beatport_url', 'is', null),
      supabase.from('artists').select('*', { count: 'exact', head: true }).not('beatport_url', 'is', null),
      supabase.from('tracks').select('*', { count: 'exact', head: true }).not('soundcloud_url', 'is', null),
      supabase.from('contributions').select('*', { count: 'exact', head: true }).eq('status', 'verified'),
      supabase.from('contributions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);

    // Recent tracks
    const { data: recentTracks } = await supabase
      .from('tracks')
      .select('id, title, artist_name, label, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    // Recent users
    const { data: recentUsers } = await supabase
      .from('profiles')
      .select('id, username, display_name, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    // Tracks added today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: tracksToday } = await supabase
      .from('tracks')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    // Tracks added this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { count: tracksThisWeek } = await supabase
      .from('tracks')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString());

    return NextResponse.json({
      success: true,
      stats: {
        totals: {
          tracks: trackCount || 0,
          artists: artistCount || 0,
          sets: setCount || 0,
          users: userCount || 0,
          contributions: contributionCount || 0,
          comments: commentCount || 0,
          likes: likeCount || 0,
        },
        bySource: {
          beatport: {
            tracks: beatportTracks || 0,
            artists: beatportArtists || 0,
          },
          soundcloud: {
            tracks: soundcloudTracks || 0,
          },
        },
        contributions: {
          verified: verifiedContributions || 0,
          pending: pendingContributions || 0,
        },
        activity: {
          tracksToday: tracksToday || 0,
          tracksThisWeek: tracksThisWeek || 0,
        },
        recentTracks: recentTracks || [],
        recentUsers: recentUsers || [],
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
