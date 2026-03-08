'use client';

import { useEffect, useState } from 'react';
import { api, type Report } from '../../lib/api';

export default function ReportsPage() {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getReports()
            .then((res) => setReports(res.data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="fade-in">
            <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Reports</h1>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                    Generated intelligence reports
                </p>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                    <div className="loading-spinner" />
                </div>
            ) : reports.length === 0 ? (
                <div className="glass-card" style={{ padding: 48, textAlign: 'center' }}>
                    <p style={{ fontSize: 48, marginBottom: 8 }}>📄</p>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        No reports generated yet. Run the pipeline to generate your first report.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {reports.map((report) => (
                        <div key={report.id} className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                <div
                                    style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 12,
                                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 24,
                                    }}
                                >
                                    📄
                                </div>
                                <span className={`badge ${report.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                                    {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                                </span>
                            </div>

                            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, height: '2.4em', overflow: 'hidden' }}>
                                {report.title || 'Intelligence Report'}
                            </h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, flex: 1 }}>
                                <div>📅 {new Date(report.reportDate).toLocaleDateString()}</div>
                                {report.competitorsCount != null && (
                                    <div>🏨 {report.competitorsCount} competitors</div>
                                )}
                                {report.totalActiveAds != null && (
                                    <div>📢 {report.totalActiveAds} ads analyzed</div>
                                )}
                                {report.clientName && (
                                    <div>👤 Client: {report.clientName}</div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: 8 }}>
                                <a
                                    href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/reports/${report.reportUuid}/view`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-secondary"
                                    style={{ textDecoration: 'none', flex: 1, textAlign: 'center', fontSize: 12, padding: '8px 4px' }}
                                >
                                    👁 View
                                </a>
                                <a
                                    href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/reports/${report.reportUuid}/pdf`}
                                    className="btn-primary"
                                    style={{ textDecoration: 'none', flex: 1, textAlign: 'center', fontSize: 12, padding: '8px 4px' }}
                                >
                                    ⬇ PDF
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
