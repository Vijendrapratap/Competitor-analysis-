'use client';

import { useEffect, useState } from 'react';
import { api, type Alert } from '../../lib/api';

export default function AlertsPage() {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [filter, setFilter] = useState<string>('');
    const [loading, setLoading] = useState(true);

    const load = (f?: string) => {
        setLoading(true);
        api.getAlerts(f)
            .then((res) => setAlerts(res.data))
            .catch(() => { })
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(filter); }, [filter]);

    const acknowledge = async (id: number) => {
        try {
            await api.acknowledgeAlert(id);
            load(filter);
        } catch {
            alert('Failed to acknowledge');
        }
    };

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Alerts</h1>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                        {alerts.length} alert{alerts.length !== 1 ? 's' : ''} found
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {['', 'unsent', 'critical'].map((f) => (
                        <button
                            key={f}
                            className={filter === f ? 'btn-primary' : 'btn-secondary'}
                            onClick={() => setFilter(f)}
                            style={{ fontSize: 13, padding: '8px 16px' }}
                        >
                            {f === '' ? 'All' : f === 'unsent' ? 'Unsent' : 'Critical'}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                    <div className="loading-spinner" />
                </div>
            ) : alerts.length === 0 ? (
                <div className="glass-card" style={{ padding: 48, textAlign: 'center' }}>
                    <p style={{ fontSize: 48, marginBottom: 8 }}>✅</p>
                    <p style={{ color: 'var(--text-secondary)' }}>No alerts to show. Everything looks good!</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {alerts.map((alert) => (
                        <div key={alert.id} className="glass-card" style={{ padding: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                        <span
                                            className={`badge badge-${alert.severity === 'critical' ? 'critical' : alert.severity === 'warning' ? 'warning' : 'info'}`}
                                        >
                                            {alert.severity}
                                        </span>
                                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                            {alert.alertType}
                                        </span>
                                    </div>
                                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px' }}>{alert.title}</h3>
                                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                        {alert.description}
                                    </p>
                                    <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                                        {new Date(alert.createdAt).toLocaleString()}
                                    </p>
                                </div>
                                {!alert.isSent && (
                                    <button
                                        className="btn-secondary"
                                        onClick={() => acknowledge(alert.id)}
                                        style={{ marginLeft: 16, whiteSpace: 'nowrap' }}
                                    >
                                        Acknowledge
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
