'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
    { href: '/', label: 'Dashboard', icon: '📊' },
    { href: '/competitors', label: 'Competitors', icon: '🏨' },
    { href: '/pipeline', label: 'Pipeline', icon: '⚡' },
    { href: '/alerts', label: 'Alerts', icon: '🔔' },
    { href: '/reports', label: 'Reports', icon: '📄' },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="sidebar">
            {/* Brand */}
            <div style={{ marginBottom: 32, paddingLeft: 16 }}>
                <h1
                    style={{
                        fontSize: 20,
                        fontWeight: 800,
                        background: 'linear-gradient(135deg, #6366f1, #ec4899)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        marginBottom: 4,
                    }}
                >
                    Competitor Intel
                </h1>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                    Intelligence Dashboard
                </p>
            </div>

            {/* Nav */}
            <nav style={{ flex: 1 }}>
                {navItems.map(({ href, label, icon }) => {
                    const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={`sidebar-link ${isActive ? 'active' : ''}`}
                        >
                            <span style={{ fontSize: 18 }}>{icon}</span>
                            {label}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div
                style={{
                    padding: '16px',
                    borderTop: '1px solid var(--border)',
                    fontSize: 12,
                    color: 'var(--text-muted)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: '#10b981',
                        }}
                    />
                    System Online
                </div>
            </div>
        </aside>
    );
}
