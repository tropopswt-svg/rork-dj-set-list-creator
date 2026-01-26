'use client';

import { useEffect, useState, useCallback } from 'react';

interface Stats {
  users: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    dailySignups: Array<{ date: string; day: string; count: number }>;
  };
  content: {
    sets: number;
    tracks: number;
    artists: number;
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
  engagement: {
    likes: number;
    comments: number;
    contributions: number;
    likesToday: number;
    commentsToday: number;
  };
  recentUsers: Array<{
    id: string;
    username: string | null;
    display_name: string | null;
    email?: string;
    created_at: string;
  }>;
  recentComments: Array<{
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    set_id: string;
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
    const interval = setInterval(fetchStats, 60000);
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

  const maxSignups = Math.max(...(stats?.users.dailySignups.map(d => d.count) || [1]), 1);

  return (
    <div className="container">
      <header>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1>IDentified Admin</h1>
            <p>Monitor users, engagement, and system health</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {lastUpdated && <span className="timestamp">Updated {lastUpdated}</span>}
            <button className="refresh-btn" onClick={fetchStats} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      {/* User Growth */}
      <div className="section">
        <h2 className="section-title">User Growth</h2>
        <div className="grid grid-4">
          <div className="card highlight">
            <div className="card-header">
              <div className="card-icon blue">👥</div>
              <span className="card-title">Total Users</span>
            </div>
            <div className="card-value">{formatNumber(stats?.users.total || 0)}</div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-icon green">📈</div>
              <span className="card-title">Today</span>
            </div>
            <div className="card-value">{stats?.users.today || 0}</div>
            <div className="card-subtitle">new signups</div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-icon purple">📊</div>
              <span className="card-title">This Week</span>
            </div>
            <div className="card-value">{stats?.users.thisWeek || 0}</div>
            <div className="card-subtitle">new signups</div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-icon orange">📆</div>
              <span className="card-title">This Month</span>
            </div>
            <div className="card-value">{stats?.users.thisMonth || 0}</div>
            <div className="card-subtitle">new signups</div>
          </div>
        </div>

        {/* Signup Chart */}
        <div className="chart-card">
          <div className="chart-header">Daily Signups (Last 7 Days)</div>
          <div className="chart-bars">
            {stats?.users.dailySignups.map((day, i) => (
              <div key={i} className="chart-bar-container">
                <div className="chart-bar-value">{day.count}</div>
                <div
                  className="chart-bar"
                  style={{ height: `${Math.max((day.count / maxSignups) * 100, 5)}%` }}
                />
                <div className="chart-bar-label">{day.day}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Engagement */}
      <div className="section">
        <h2 className="section-title">Engagement</h2>
        <div className="grid grid-3">
          <div className="card">
            <div className="card-header">
              <div className="card-icon red">❤️</div>
              <span className="card-title">Total Likes</span>
            </div>
            <div className="card-value">{formatNumber(stats?.engagement.likes || 0)}</div>
            <div className="card-subtitle">+{stats?.engagement.likesToday || 0} today</div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-icon blue">💬</div>
              <span className="card-title">Comments</span>
            </div>
            <div className="card-value">{formatNumber(stats?.engagement.comments || 0)}</div>
            <div className="card-subtitle">+{stats?.engagement.commentsToday || 0} today</div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-icon green">✨</div>
              <span className="card-title">Contributions</span>
            </div>
            <div className="card-value">{formatNumber(stats?.engagement.contributions || 0)}</div>
          </div>
        </div>
      </div>

      {/* Content Overview */}
      <div className="section">
        <h2 className="section-title">Content Overview</h2>
        <div className="grid grid-4">
          <div className="card">
            <div className="card-header">
              <div className="card-icon orange">🎵</div>
              <span className="card-title">Total Tracks</span>
            </div>
            <div className="card-value">{formatNumber(stats?.content.tracks || 0)}</div>
            <div className="card-subtitle">+{stats?.content.tracksThisWeek || 0} this week</div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-icon green">📥</div>
              <span className="card-title">Tracks Today</span>
            </div>
            <div className="card-value">{stats?.content.tracksToday || 0}</div>
            <div className="card-subtitle">new tracks added</div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-icon purple">📀</div>
              <span className="card-title">Sets</span>
            </div>
            <div className="card-value">{formatNumber(stats?.content.sets || 0)}</div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-icon blue">🎤</div>
              <span className="card-title">Artists</span>
            </div>
            <div className="card-value">{formatNumber(stats?.content.artists || 0)}</div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="section">
        <h2 className="section-title">Recent Activity</h2>
        <div className="grid grid-3">
          <div className="list-card">
            <div className="list-card-header">New Users</div>
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

          <div className="list-card">
            <div className="list-card-header">Recent Tracks</div>
            {stats?.recentTracks?.map((track) => (
              <div key={track.id} className="list-item">
                <div>
                  <div className="list-item-title" style={{
                    maxWidth: '180px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {track.title}
                  </div>
                  <div className="list-item-subtitle">
                    {track.artist_name}{track.label && ` • ${track.label}`}
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
            <div className="list-card-header">Recent Comments</div>
            {stats?.recentComments.map((comment) => (
              <div key={comment.id} className="list-item">
                <div>
                  <div className="list-item-title" style={{
                    maxWidth: '180px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {comment.content}
                  </div>
                  <div className="list-item-subtitle">Set: {comment.set_id.slice(0, 8)}...</div>
                </div>
                <span className="list-item-time">{timeAgo(comment.created_at)}</span>
              </div>
            ))}
            {(!stats?.recentComments || stats.recentComments.length === 0) && (
              <div className="list-item">
                <span className="list-item-subtitle">No recent comments</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{
        marginTop: '2rem',
        padding: '1rem',
        textAlign: 'center',
        color: '#666',
        fontSize: '0.875rem'
      }}>
        IDentified Admin Dashboard • Auto-refreshes every 60s
      </footer>
    </div>
  );
}
