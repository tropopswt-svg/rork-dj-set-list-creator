'use client';

import { useEffect, useState, useCallback } from 'react';

interface Stats {
  totals: {
    tracks: number;
    artists: number;
    sets: number;
    users: number;
    contributions: number;
    comments: number;
    likes: number;
  };
  bySource: {
    beatport: { tracks: number; artists: number };
    soundcloud: { tracks: number };
  };
  contributions: {
    verified: number;
    pending: number;
  };
  activity: {
    tracksToday: number;
    tracksThisWeek: number;
  };
  recentTracks: Array<{
    id: string;
    title: string;
    artist_name: string;
    label: string | null;
    created_at: string;
  }>;
  recentUsers: Array<{
    id: string;
    username: string | null;
    display_name: string | null;
    created_at: string;
  }>;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toLocaleString();
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  return Math.floor(seconds / 86400) + 'd ago';
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/stats');
      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch stats');
      }
      
      setStats(data.stats);
      setLastUpdated(new Date().toLocaleTimeString());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading && !stats) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (error && !stats) {
    return (
      <div className="container">
        <div className="error">
          <p>{error}</p>
          <button className="refresh-btn" onClick={fetchStats} style={{ marginTop: '1rem' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1>DJ Setlist Dashboard</h1>
            <p>Real-time stats for your music database</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {lastUpdated && <span className="timestamp">Updated {lastUpdated}</span>}
            <button className="refresh-btn" onClick={fetchStats} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Stats */}
      <div className="grid grid-4">
        <div className="card">
          <div className="card-header">
            <div className="card-icon purple">🎵</div>
            <span className="card-title">Total Tracks</span>
          </div>
          <div className="card-value">{formatNumber(stats?.totals.tracks || 0)}</div>
          <div className="card-subtitle">+{stats?.activity.tracksThisWeek || 0} this week</div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-icon green">🎤</div>
            <span className="card-title">Artists</span>
          </div>
          <div className="card-value">{formatNumber(stats?.totals.artists || 0)}</div>
          <div className="card-subtitle">{stats?.bySource.beatport.artists || 0} from Beatport</div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-icon blue">📀</div>
            <span className="card-title">Sets</span>
          </div>
          <div className="card-value">{formatNumber(stats?.totals.sets || 0)}</div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-icon orange">👥</div>
            <span className="card-title">Users</span>
          </div>
          <div className="card-value">{formatNumber(stats?.totals.users || 0)}</div>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="section">
        <h2 className="section-title">Activity & Engagement</h2>
        <div className="grid grid-4">
          <div className="card">
            <div className="card-header">
              <div className="card-icon yellow">⚡</div>
              <span className="card-title">Tracks Today</span>
            </div>
            <div className="card-value">{stats?.activity.tracksToday || 0}</div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-icon green">✓</div>
              <span className="card-title">Contributions</span>
            </div>
            <div className="card-value">{formatNumber(stats?.totals.contributions || 0)}</div>
            <div className="card-subtitle">
              <span className="badge green">{stats?.contributions.verified || 0} verified</span>{' '}
              <span className="badge yellow">{stats?.contributions.pending || 0} pending</span>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-icon purple">❤️</div>
              <span className="card-title">Likes</span>
            </div>
            <div className="card-value">{formatNumber(stats?.totals.likes || 0)}</div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-icon blue">💬</div>
              <span className="card-title">Comments</span>
            </div>
            <div className="card-value">{formatNumber(stats?.totals.comments || 0)}</div>
          </div>
        </div>
      </div>

      {/* Source Breakdown */}
      <div className="section">
        <h2 className="section-title">By Source</h2>
        <div className="grid grid-3">
          <div className="card">
            <div className="card-header">
              <div className="card-icon orange">🔶</div>
              <span className="card-title">Beatport Tracks</span>
            </div>
            <div className="card-value">{formatNumber(stats?.bySource.beatport.tracks || 0)}</div>
            <div className="card-subtitle">
              {((stats?.bySource.beatport.tracks || 0) / (stats?.totals.tracks || 1) * 100).toFixed(1)}% of total
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-icon orange">🔷</div>
              <span className="card-title">SoundCloud Tracks</span>
            </div>
            <div className="card-value">{formatNumber(stats?.bySource.soundcloud.tracks || 0)}</div>
            <div className="card-subtitle">
              {((stats?.bySource.soundcloud.tracks || 0) / (stats?.totals.tracks || 1) * 100).toFixed(1)}% of total
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-icon green">🎤</div>
              <span className="card-title">Beatport Artists</span>
            </div>
            <div className="card-value">{formatNumber(stats?.bySource.beatport.artists || 0)}</div>
            <div className="card-subtitle">
              {((stats?.bySource.beatport.artists || 0) / (stats?.totals.artists || 1) * 100).toFixed(1)}% of total
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="section">
        <h2 className="section-title">Recent Activity</h2>
        <div className="grid grid-2">
          <div className="list-card">
            <div className="list-card-header">Recent Tracks</div>
            {stats?.recentTracks.map((track) => (
              <div key={track.id} className="list-item">
                <div>
                  <div className="list-item-title">{track.title}</div>
                  <div className="list-item-subtitle">
                    {track.artist_name} {track.label && `• ${track.label}`}
                  </div>
                </div>
                <span className="list-item-time">{timeAgo(track.created_at)}</span>
              </div>
            ))}
            {(!stats?.recentTracks || stats.recentTracks.length === 0) && (
              <div className="list-item">
                <span className="list-item-subtitle">No recent tracks</span>
              </div>
            )}
          </div>

          <div className="list-card">
            <div className="list-card-header">Recent Users</div>
            {stats?.recentUsers.map((user) => (
              <div key={user.id} className="list-item">
                <div>
                  <div className="list-item-title">
                    {user.display_name || user.username || 'Anonymous'}
                  </div>
                  {user.username && (
                    <div className="list-item-subtitle">@{user.username}</div>
                  )}
                </div>
                <span className="list-item-time">{timeAgo(user.created_at)}</span>
              </div>
            ))}
            {(!stats?.recentUsers || stats.recentUsers.length === 0) && (
              <div className="list-item">
                <span className="list-item-subtitle">No recent users</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
