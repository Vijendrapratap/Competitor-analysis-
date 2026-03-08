'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, type Competitor } from '../../lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface FormData {
    name: string;
    facebookPageUrl: string;
    adsLibraryUrl: string;
    category: string;
    priceTier: string;
    isCustomer: boolean;
}

const EMPTY_FORM: FormData = {
    name: '',
    facebookPageUrl: '',
    adsLibraryUrl: '',
    category: 'hotel',
    priceTier: 'mid-range',
    isCustomer: false,
};

// ── Main Page ────────────────────────────────────────────────────────────────

export default function CompetitorsPage() {
    const [competitors, setCompetitors] = useState<Competitor[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const load = useCallback(() => {
        setLoading(true);
        api.getCompetitors()
            .then((res) => setCompetitors(res.data))
            .catch(() => showToast('Failed to load competitors', 'error'))
            .finally(() => setLoading(false));
    }, [showToast]);

    useEffect(() => { load(); }, [load]);

    const handleToggle = async (id: number) => {
        try {
            const res = await api.toggleCompetitor(id);
            showToast(res.data.isActive ? 'Competitor activated' : 'Competitor paused');
            load();
        } catch {
            showToast('Failed to toggle status', 'error');
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await api.deleteCompetitor(id);
            showToast('Competitor deleted');
            setDeleteConfirm(null);
            load();
        } catch {
            showToast('Failed to delete competitor', 'error');
        }
    };

    const startEdit = (competitor: Competitor) => {
        setEditingId(competitor.id);
        setShowForm(true);
    };

    const cancelForm = () => {
        setShowForm(false);
        setEditingId(null);
    };

    const editingCompetitor = editingId ? competitors.find(c => c.id === editingId) : null;

    return (
        <div className="fade-in">
            {/* Toast Notification */}
            {toast && (
                <div style={{
                    position: 'fixed', top: 20, right: 20, zIndex: 1000,
                    padding: '14px 24px', borderRadius: 12,
                    background: toast.type === 'success'
                        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.9), rgba(5, 150, 105, 0.9))'
                        : 'linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(220, 38, 38, 0.9))',
                    color: 'white', fontWeight: 600, fontSize: 14,
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    animation: 'fadeInUp 0.3s ease-out',
                }}>
                    {toast.type === 'success' ? '✓' : '✕'} {toast.message}
                </div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Competitors</h1>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                        Manage your tracked competitors • {competitors.length} total
                    </p>
                </div>
                <button className="btn-primary" onClick={() => { setEditingId(null); setShowForm(!showForm); }}>
                    {showForm ? '✕ Close' : '+ Add Competitor'}
                </button>
            </div>

            {/* Add / Edit Form */}
            {showForm && (
                <CompetitorForm
                    editingCompetitor={editingCompetitor}
                    onSuccess={(msg) => { cancelForm(); showToast(msg); load(); }}
                    onCancel={cancelForm}
                />
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm !== null && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 999,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <div className="glass-card" style={{ padding: 32, maxWidth: 420, width: '90%', textAlign: 'center' }}>
                        <p style={{ fontSize: 48, marginBottom: 8 }}>⚠️</p>
                        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Delete Competitor?</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
                            This will permanently remove <strong>{competitors.find(c => c.id === deleteConfirm)?.name}</strong> and
                            all their associated data (ads, posts, analyses, alerts).
                        </p>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                            <button className="btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                            <button className="btn-danger" onClick={() => handleDelete(deleteConfirm)}>
                                🗑 Delete Forever
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Competitor Table */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                    <div className="loading-spinner" />
                </div>
            ) : competitors.length === 0 ? (
                <div className="glass-card" style={{ padding: 48, textAlign: 'center' }}>
                    <p style={{ fontSize: 48, marginBottom: 8 }}>🏨</p>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No competitors yet</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                        Add your first competitor to start tracking their marketing activity.
                    </p>
                    <button className="btn-primary" onClick={() => setShowForm(true)}>+ Add Your First Competitor</button>
                </div>
            ) : (
                <div className="glass-card" style={{ overflow: 'hidden' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Category</th>
                                <th>Price Tier</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {competitors.map((c) => (
                                <tr key={c.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div
                                                style={{
                                                    width: 36, height: 36, borderRadius: 10,
                                                    background: `linear-gradient(135deg, hsl(${c.id * 47 % 360}, 60%, 50%), hsl(${(c.id * 47 + 60) % 360}, 60%, 40%))`,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: 'white', fontWeight: 700, fontSize: 14,
                                                    opacity: c.isActive ? 1 : 0.5,
                                                }}
                                            >
                                                {c.name.charAt(0)}
                                            </div>
                                            <div>
                                                <span style={{ fontWeight: 600, color: 'var(--text-primary)', opacity: c.isActive ? 1 : 0.5 }}>
                                                    {c.name}
                                                </span>
                                                {c.facebookPageUrl && (
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                                        {c.facebookPageUrl.replace('https://www.facebook.com/', 'fb.com/')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ textTransform: 'capitalize', opacity: c.isActive ? 1 : 0.5 }}>
                                        {c.category}
                                    </td>
                                    <td>
                                        <span className="badge badge-info" style={{ textTransform: 'capitalize', opacity: c.isActive ? 1 : 0.5 }}>
                                            {c.priceTier}
                                        </span>
                                    </td>
                                    <td>
                                        {c.isCustomer ? (
                                            <span className="badge badge-success">⭐ Your Hotel</span>
                                        ) : (
                                            <span className="badge badge-warning">Competitor</span>
                                        )}
                                    </td>
                                    <td>
                                        <button
                                            onClick={() => handleToggle(c.id)}
                                            style={{
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', gap: 8,
                                                color: c.isActive ? 'var(--success)' : 'var(--text-muted)',
                                                fontSize: 13, fontWeight: 500,
                                            }}
                                            title={c.isActive ? 'Click to pause tracking' : 'Click to resume tracking'}
                                        >
                                            <div style={{
                                                width: 36, height: 20, borderRadius: 10,
                                                background: c.isActive ? 'var(--success)' : 'var(--border)',
                                                position: 'relative', transition: 'all 0.3s ease',
                                            }}>
                                                <div style={{
                                                    width: 16, height: 16, borderRadius: '50%',
                                                    background: 'white', position: 'absolute',
                                                    top: 2, left: c.isActive ? 18 : 2,
                                                    transition: 'all 0.3s ease',
                                                }} />
                                            </div>
                                            {c.isActive ? 'Active' : 'Paused'}
                                        </button>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                            <button
                                                className="btn-secondary"
                                                onClick={() => startEdit(c)}
                                                style={{ padding: '6px 14px' }}
                                            >
                                                ✏️ Edit
                                            </button>
                                            <button
                                                className="btn-danger"
                                                onClick={() => setDeleteConfirm(c.id)}
                                                style={{ padding: '6px 14px' }}
                                            >
                                                🗑
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ── Competitor Form Component ────────────────────────────────────────────────

function CompetitorForm({
    editingCompetitor,
    onSuccess,
    onCancel,
}: {
    editingCompetitor: Competitor | null | undefined;
    onSuccess: (message: string) => void;
    onCancel: () => void;
}) {
    const isEditing = !!editingCompetitor;

    const [form, setForm] = useState<FormData>(() => {
        if (editingCompetitor) {
            return {
                name: editingCompetitor.name,
                facebookPageUrl: editingCompetitor.facebookPageUrl ?? '',
                adsLibraryUrl: editingCompetitor.adsLibraryUrl ?? '',
                category: editingCompetitor.category,
                priceTier: editingCompetitor.priceTier,
                isCustomer: editingCompetitor.isCustomer,
            };
        }
        return { ...EMPTY_FORM };
    });

    const [saving, setSaving] = useState(false);

    const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (isEditing && editingCompetitor) {
                await api.updateCompetitor(editingCompetitor.id, {
                    name: form.name,
                    facebookPageUrl: form.facebookPageUrl || null,
                    adsLibraryUrl: form.adsLibraryUrl || null,
                    category: form.category,
                    priceTier: form.priceTier,
                    isCustomer: form.isCustomer,
                });
                onSuccess(`"${form.name}" updated successfully`);
            } else {
                await api.createCompetitor({
                    name: form.name,
                    facebookPageUrl: form.facebookPageUrl || null,
                    adsLibraryUrl: form.adsLibraryUrl || null,
                    category: form.category,
                    priceTier: form.priceTier,
                    isCustomer: form.isCustomer,
                });
                onSuccess(`"${form.name}" added successfully`);
            }
        } catch {
            alert('Failed to save competitor');
        } finally {
            setSaving(false);
        }
    };

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '10px 14px', borderRadius: 10,
        border: '1px solid var(--border)', background: 'var(--bg-primary)',
        color: 'var(--text-primary)', fontSize: 14, outline: 'none',
        transition: 'border-color 0.2s ease',
    };

    const labelStyle: React.CSSProperties = {
        display: 'block', fontSize: 12, fontWeight: 600,
        color: 'var(--text-muted)', marginBottom: 6,
        textTransform: 'uppercase', letterSpacing: 0.5,
    };

    return (
        <div className="glass-card fade-in" style={{ padding: 24, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                    {isEditing ? `✏️ Edit "${editingCompetitor?.name}"` : '➕ Add New Competitor'}
                </h3>
                <button className="btn-secondary" onClick={onCancel} style={{ padding: '6px 14px' }}>
                    ✕ Cancel
                </button>
            </div>
            <form onSubmit={submit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                    <div>
                        <label style={labelStyle}>Name *</label>
                        <input style={inputStyle} value={form.name} onChange={(e) => updateField('name', e.target.value)}
                            placeholder="e.g. Grand Hyatt Hua Hin" required />
                    </div>
                    <div>
                        <label style={labelStyle}>Facebook Page URL</label>
                        <input style={inputStyle} value={form.facebookPageUrl} onChange={(e) => updateField('facebookPageUrl', e.target.value)}
                            placeholder="https://facebook.com/..." />
                    </div>
                    <div>
                        <label style={labelStyle}>Meta Ads Library URL</label>
                        <input style={inputStyle} value={form.adsLibraryUrl} onChange={(e) => updateField('adsLibraryUrl', e.target.value)}
                            placeholder="https://www.facebook.com/ads/library/..." />
                    </div>
                    <div>
                        <label style={labelStyle}>Category</label>
                        <select style={inputStyle} value={form.category} onChange={(e) => updateField('category', e.target.value)}>
                            <option value="hotel">Hotel</option>
                            <option value="resort">Resort</option>
                            <option value="hostel">Hostel</option>
                            <option value="villa">Villa</option>
                            <option value="boutique">Boutique</option>
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>Price Tier</label>
                        <select style={inputStyle} value={form.priceTier} onChange={(e) => updateField('priceTier', e.target.value)}>
                            <option value="budget">Budget</option>
                            <option value="mid-range">Mid-Range</option>
                            <option value="luxury">Luxury</option>
                            <option value="ultra-luxury">Ultra Luxury</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 20 }}>
                        <button
                            type="button"
                            onClick={() => updateField('isCustomer', !form.isCustomer)}
                            style={{
                                width: 44, height: 24, borderRadius: 12,
                                background: form.isCustomer ? 'var(--success)' : 'var(--border)',
                                border: 'none', cursor: 'pointer',
                                position: 'relative', transition: 'all 0.3s ease',
                            }}
                        >
                            <div style={{
                                width: 18, height: 18, borderRadius: '50%',
                                background: 'white', position: 'absolute',
                                top: 3, left: form.isCustomer ? 23 : 3,
                                transition: 'all 0.3s ease',
                            }} />
                        </button>
                        <label style={{ fontSize: 14, color: 'var(--text-secondary)', cursor: 'pointer' }}
                            onClick={() => updateField('isCustomer', !form.isCustomer)}>
                            {form.isCustomer ? '⭐ This is MY hotel (not a competitor)' : 'This is a competitor'}
                        </label>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn-primary" type="submit" disabled={saving || !form.name}>
                        {saving ? '⏳ Saving...' : isEditing ? '💾 Save Changes' : '➕ Create Competitor'}
                    </button>
                </div>
            </form>
        </div>
    );
}
