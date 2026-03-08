'use client';

import { useEffect, useState } from 'react';
import { api, type MarketOverview, type LeaderboardEntry, type Alert } from '../lib/api';

export default function DashboardPage() {
  const [market, setMarket] = useState<MarketOverview | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.getMarketOverview().catch(() => null),
      api.getLeaderboard().catch(() => ({ data: [] })),
      api.getAlerts('unsent').catch(() => ({ data: [], total: 0 })),
    ])
      .then(([mkt, lb, al]) => {
        if (mkt) setMarket(mkt.data);
        setLeaderboard(lb.data);
        setAlerts(al.data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card fade-in" style={{ padding: 32, textAlign: 'center' }}>
        <p style={{ color: 'var(--danger)', fontSize: 18, marginBottom: 8 }}>⚠️ Connection Error</p>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Cannot connect to API server. Make sure the backend is running on port 3001.
        </p>
        <code style={{ display: 'block', marginTop: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
          npm run dev:api
        </code>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
          Dashboard
        </h1>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
          Market intelligence at a glance
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 32 }}>
        <StatCard
          label="Competitors"
          value={market?.totalCompetitors ?? 0}
          icon="🏨"
          color="var(--accent)"
          delay={1}
        />
        <StatCard
          label="Active Ads"
          value={market?.totalActiveAds ?? 0}
          icon="📢"
          color="var(--info)"
          delay={2}
        />
        <StatCard
          label="Avg Health Score"
          value={market?.avgHealthScore ?? 0}
          icon="💪"
          color="var(--success)"
          isScore
          delay={3}
        />
        <StatCard
          label="Open Alerts"
          value={alerts.length}
          icon="🔔"
          color="var(--warning)"
          delay={4}
        />
      </div>

      {/* Two column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Leaderboard */}
        <div className="glass-card fade-in fade-in-delay-2" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>
            🏆 Health Leaderboard
          </h2>
          {leaderboard.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No data yet. Run the pipeline first.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {leaderboard.map((entry, i) => (
                <div
                  key={entry.competitorId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: i === 0 ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                    border: `1px solid ${i === 0 ? 'rgba(99, 102, 241, 0.2)' : 'transparent'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-muted)', width: 24 }}>
                      {i + 1}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{entry.competitorName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {entry.totalActiveAds} ads · {entry.threatLevel} threat
                      </div>
                    </div>
                  </div>
                  <div
                    className={`score-ring ${entry.healthScore >= 70 ? 'score-high' : entry.healthScore >= 40 ? 'score-mid' : 'score-low'}`}
                    style={{ width: 48, height: 48, fontSize: 14 }}
                  >
                    {entry.healthScore}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Alerts */}
        <div className="glass-card fade-in fade-in-delay-3" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>
            🔔 Recent Alerts
          </h2>
          {alerts.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No pending alerts.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {alerts.slice(0, 6).map((alert) => (
                <div
                  key={alert.id}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: 'rgba(22, 22, 58, 0.5)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{alert.title}</span>
                    <span className={`badge badge-${alert.severity === 'critical' ? 'critical' : alert.severity === 'warning' ? 'warning' : 'info'}`}>
                      {alert.severity}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                    {alert.description?.slice(0, 100)}{(alert.description?.length ?? 0) > 100 ? '...' : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Stat Card Component ──────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
  isScore,
  delay,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
  isScore?: boolean;
  delay: number;
}) {
  return (
    <div className={`stat-card fade-in fade-in-delay-${delay}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
            {label}
          </p>
          <p style={{ fontSize: 32, fontWeight: 800, margin: 0, color }}>
            {isScore ? `${value}/100` : value}
          </p>
        </div>
        <span style={{ fontSize: 28 }}>{icon}</span>
      </div>
    </div>
  );
}
