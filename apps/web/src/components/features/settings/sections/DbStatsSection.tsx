'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Settings } from 'lucide-react';
import { SettingsSection } from '@/components/features/settings/SettingsPrimitives';

// SaaS-admin: storage usage by table.
export function DbStatsSection() {
    const [data, setData] = useState<{ totalBytes: number; tables: { table: string; size: string; bytes: number; estRows: number }[] } | null>(null);
    useEffect(() => { api.get<any>('/saas-admin/database-stats').then(r => setData(r.data)).catch(() => {}); }, []);
    if (!data) return null;
    const gb = (b: number) => b > 1073741824 ? `${(b / 1073741824).toFixed(2)} GB` : `${(b / 1048576).toFixed(1)} MB`;
    return (
        <SettingsSection title="Storage Usage" icon={Settings}>
            <div style={{ fontSize: 14, marginBottom: 'var(--space-3)', color: 'var(--notion-text)' }}>Total database size: <strong>{gb(data.totalBytes)}</strong></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {data.tables.slice(0, 10).map(t => (
                    <div key={t.table} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--notion-divider)' }}>
                        <span style={{ color: 'var(--notion-text)' }}>{t.table}</span>
                        <span style={{ color: 'var(--notion-text-secondary)' }}>{t.size} · {t.estRows.toLocaleString()} rows</span>
                    </div>
                ))}
            </div>
        </SettingsSection>
    );
}
