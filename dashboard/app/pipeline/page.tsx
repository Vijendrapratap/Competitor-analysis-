'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, type PipelineRun } from '../../lib/api';

export default function PipelinePage() {
    const [runs, setRuns] = useState<PipelineRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeRunId, setActiveRunId] = useState<string | null>(null);

    const loadRuns = useCallback(() => {
        api.getPipelineRuns()
            .then((res) => setRuns(res.data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        loadRuns();
        const interval = setInterval(loadRuns, 5000);
        return () => clearInterval(interval);
    }, [loadRuns]);

    // Poll active run
    useEffect(() => {
        if (!activeRunId) return;
        const interval = setInterval(() => {
            api.getPipelineStatus(activeRunId).then((res) => {
                if (res.data.status !== 'running') {
                    setActiveRunId(null);
                    loadRuns();
                }
            });
        }, 3000);
        return () => clearInterval(interval);
    }, [activeRunId, loadRuns]);

    const triggerPipeline = async (stages: string[]) => {
        try {
            const res = await api.runPipeline(stages);
            setActiveRunId(res.data.runId);
            loadRuns();
        } catch {
            alert('Failed to trigger pipeline');
        }
    };

    return (
        <div className="fade-in">
            <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Pipeline</h1>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                    Run and monitor data collection pipelines
                </p>
            </div>

            {/* Quick Actions */}
            <div className="glass-card fade-in-delay-1" style={{ padding: 24, marginBottom: 24 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>⚡ Quick Actions</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    <ActionCard
                        title="Full Pipeline"
                        description="Scrape → Analyze → Report"
                        icon="🚀"
                        onClick={() => triggerPipeline(['scrape', 'analyze', 'generate'])}
                        disabled={!!activeRunId}
                        gradient="linear-gradient(135deg, #6366f1, #8b5cf6)"
                    />
                    <ActionCard
                        title="Scrape Only"
                        description="Collect competitor data"
                        icon="🔍"
                        onClick={() => triggerPipeline(['scrape'])}
                        disabled={!!activeRunId}
                        gradient="linear-gradient(135deg, #3b82f6, #06b6d4)"
                    />
                    <ActionCard
                        title="Analyze Only"
                        description="Process & score"
                        icon="📊"
                        onClick={() => triggerPipeline(['analyze'])}
                        disabled={!!activeRunId}
                        gradient="linear-gradient(135deg, #10b981, #34d399)"
                    />
                    <ActionCard
                        title="Generate Report"
                        description="Create PDF report"
                        icon="📄"
                        onClick={() => triggerPipeline(['generate'])}
                        disabled={!!activeRunId}
                        gradient="linear-gradient(135deg, #f59e0b, #f97316)"
                    />
                </div>
            </div>

            {/* Active Run */}
            {activeRunId && (
                <div className="glass-card pulse-glow fade-in" style={{ padding: 24, marginBottom: 24, borderColor: 'var(--accent)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="loading-spinner" style={{ width: 24, height: 24 }} />
                        <div>
                            <span style={{ fontWeight: 700, fontSize: 14 }}>Pipeline Running</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: 13, marginLeft: 12 }}>
                                Run ID: {activeRunId}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Run History */}
            <div className="glass-card fade-in-delay-2" style={{ padding: 24 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>📋 Run History</h2>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                        <div className="loading-spinner" />
                    </div>
                ) : runs.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No pipeline runs yet. Use the buttons above to trigger a run.</p>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Run ID</th>
                                <th>Status</th>
                                <th>Stage</th>
                                <th>Started</th>
                                <th>Duration</th>
                                <th>Results</th>
                            </tr>
                        </thead>
                        <tbody>
                            {runs.map((run) => {
                                const errors = extractErrors(run.results);
                                return (
                                    <tr key={run.id}>
                                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{run.id}</td>
                                        <td>
                                            <span
                                                className={`badge ${run.status === 'completed' ? 'badge-success' : run.status === 'failed' ? 'badge-critical' : 'badge-warning'}`}
                                            >
                                                {run.status}
                                            </span>
                                        </td>
                                        <td style={{ textTransform: 'capitalize' }}>{run.stage}</td>
                                        <td>{new Date(run.startedAt).toLocaleTimeString()}</td>
                                        <td>
                                            {run.completedAt
                                                ? `${Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s`
                                                : '—'}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                                    {summarizeResults(run.results)}
                                                </span>
                                                {errors.length > 0 && (
                                                    <span
                                                        className="badge badge-critical"
                                                        title={errors.join('\n')}
                                                        style={{ cursor: 'help' }}
                                                    >
                                                        {errors.length} error{errors.length > 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

// ── Result helpers ────────────────────────────────────────────────────────────

function summarizeResults(results: Record<string, unknown>): string {
    const s = results.scrape as any;
    const a = results.analyze as any;
    const g = results.generate as any;
    if (s) return `${s.adsScraped ?? 0} ads · ${s.postsScraped ?? 0} posts · ${s.pagesScraped ?? 0} pages`;
    if (a) return `${a.competitorsAnalyzed ?? 0} analyzed · ${a.alertsGenerated ?? 0} alerts`;
    if (g) return `Report generated`;
    return '—';
}

function extractErrors(results: Record<string, unknown>): string[] {
    return Object.values(results).flatMap((v: any) => v?.errors ?? []);
}

function ActionCard({
    title,
    description,
    icon,
    onClick,
    disabled,
    gradient,
}: {
    title: string;
    description: string;
    icon: string;
    onClick: () => void;
    disabled: boolean;
    gradient: string;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                padding: '20px',
                borderRadius: 16,
                border: '1px solid var(--border)',
                background: 'rgba(22, 22, 58, 0.6)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                textAlign: 'left',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
                if (!disabled) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99, 102, 241, 0.5)';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                }
            }}
            onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            }}
        >
            <div
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: gradient,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    marginBottom: 12,
                }}
            >
                {icon}
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
                {title}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{description}</div>
        </button>
    );
}
