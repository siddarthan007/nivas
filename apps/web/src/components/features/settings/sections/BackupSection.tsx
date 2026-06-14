'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Settings, Trash2 } from 'lucide-react';
import { SettingsSection } from '@/components/features/settings/SettingsPrimitives';

const selectStyle: React.CSSProperties = {
    width: '100%', padding: '8px', backgroundColor: 'var(--notion-bg)',
    border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)',
    fontSize: '14px', outline: 'none', color: 'var(--notion-text)',
};

// SaaS-admin: database backups (manual + scheduled) with download links.
// Restore is intentionally not exposed in-app — ops use pg_restore on downloaded dumps.
export function BackupSection() {
    const [settings, setSettings] = useState<{ autoEnabled: boolean; frequency: string; lastRunAt: string | null; keep: number } | null>(null);
    const [backups, setBackups] = useState<{ filename: string; sizeBytes: number; createdAt: string; downloadUrl: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);

    const load = async () => {
        try { const r = await api.get<any>('/saas-admin/backups'); setSettings(r.data?.settings || null); setBackups(r.data?.backups || []); }
        catch (e: any) { toast.error(e?.message || 'Failed to load backups'); } finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);

    const runNow = async () => {
        setRunning(true);
        try { const r = await api.post<any>('/saas-admin/backups', {}); toast.success('Backup created'); if (r.data?.downloadUrl) window.open(r.data.downloadUrl, '_blank'); await load(); }
        catch (e: any) { toast.error(e?.message || 'Backup failed'); } finally { setRunning(false); }
    };
    const saveSchedule = async (patch: any) => {
        try { const r = await api.patch<any>('/saas-admin/backups/settings', patch); setSettings(r.data); toast.success('Saved'); }
        catch (e: any) { toast.error(e?.message || 'Failed'); }
    };
    const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`;

    const deleteBackup = async (filename: string) => {
        if (!confirm(`Delete backup ${filename}? This cannot be undone.`)) return;
        try {
            await api.delete(`/saas-admin/backups/${encodeURIComponent(filename)}`);
            toast.success('Backup deleted');
            await load();
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Delete failed');
        }
    };

    const refreshUrl = async (filename: string) => {
        try {
            const r = await api.get<{ downloadUrl: string }>(`/saas-admin/backups/${encodeURIComponent(filename)}/url`);
            if (r.data?.downloadUrl) window.open(r.data.downloadUrl, '_blank');
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to refresh link');
        }
    };

    return (
        <SettingsSection title="Database Backups" icon={Settings}>
            <p style={{ fontSize: 13, color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
                Create a compressed, restorable copy of all data. Only the latest {settings?.keep ?? 3} are kept to save space, and the download link works for 12 hours (also emailed to admins). To restore, download a backup and follow the restore guide — restoring is done manually for safety.
            </p>

            {settings && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                        <input type="checkbox" checked={settings.autoEnabled} onChange={e => saveSchedule({ autoEnabled: e.target.checked })} /> Automatic backups
                    </label>
                    <select value={settings.frequency} disabled={!settings.autoEnabled} onChange={e => saveSchedule({ frequency: e.target.value })} style={selectStyle}>
                        <option value="DAILY">Every day</option>
                        <option value="WEEKLY">Every week</option>
                    </select>
                    <span style={{ fontSize: 12, color: 'var(--notion-text-muted)' }}>{settings.lastRunAt ? `Last: ${new Date(settings.lastRunAt).toLocaleString()}` : 'Never run'}</span>
                    <div style={{ marginLeft: 'auto' }}><Button onClick={runNow} disabled={running}>{running ? 'Backing up…' : 'Back up now'}</Button></div>
                </div>
            )}

            {loading ? <div style={{ fontSize: 13, color: 'var(--notion-text-muted)' }}>Loading…</div> : backups.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--notion-text-muted)', padding: 16, textAlign: 'center', border: '1px dashed var(--notion-border)', borderRadius: 8 }}>No backups yet.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {backups.map(b => (
                        <div key={b.filename} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 12px', border: '1px solid var(--notion-border)', borderRadius: 8, fontSize: 13 }}>
                            <span style={{ color: 'var(--notion-text)' }}>{new Date(b.createdAt).toLocaleString()} · <span style={{ color: 'var(--notion-text-muted)' }}>{mb(b.sizeBytes)}</span></span>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <button type="button" onClick={() => refreshUrl(b.filename)} style={{ color: 'var(--notion-blue)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>Download</button>
                                <button type="button" onClick={() => deleteBackup(b.filename)} title="Delete backup" style={{ color: 'var(--notion-red)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><Trash2 size={14} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </SettingsSection>
    );
}
