'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import CustomDatePicker from '@/components/ui/DatePicker';
import { exportObjectsToCsv } from '@/lib/utils/export';
import { toLocalDateString } from '@/lib/utils/format';
import { RefreshCw, Download, LogIn, LogOut, Users } from 'lucide-react';

type OpsSubTab = 'arrivals' | 'departures' | 'in-house';

interface OpsRow {
    [key: string]: string | number | null | undefined;
}

export default function OperationsReportsTab() {
    const [subTab, setSubTab] = useState<OpsSubTab>('arrivals');
    const [date, setDate] = useState(toLocalDateString(new Date()));
    const [rows, setRows] = useState<OpsRow[]>([]);
    const [loading, setLoading] = useState(false);

    const endpoint = subTab === 'arrivals' ? '/reports/arrivals' : subTab === 'departures' ? '/reports/departures' : '/reports/in-house';

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const q = subTab === 'in-house' ? '' : `?date=${date}`;
            const res = await api.get<OpsRow[]>(`${endpoint}${q}`);
            const payload = res.data;
            const list = Array.isArray(payload) ? payload : [];
            setRows(list);
        } catch (e: any) {
            toast.error(e?.message || 'Failed to load report');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [date, endpoint, subTab]);

    useEffect(() => { load(); }, [load]);

    const columns = rows.length > 0 ? Object.keys(rows[0]!) : [];

    const handleExport = () => {
        if (!rows.length) return;
        exportObjectsToCsv(
            `${subTab}-${date || 'today'}`,
            columns.map(col => ({ header: col, value: (row: OpsRow) => row[col] ?? '' })),
            rows,
        );
    };

    const tabs: { id: OpsSubTab; label: string; icon: typeof LogIn }[] = [
        { id: 'arrivals', label: 'Arrivals', icon: LogIn },
        { id: 'departures', label: 'Departures', icon: LogOut },
        { id: 'in-house', label: 'In-house', icon: Users },
    ];

    return (
        <div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: 'var(--space-4)', alignItems: 'center', borderBottom: '1px solid var(--notion-divider)' }}>
                {tabs.map(t => {
                    const Icon = t.icon;
                    const active = subTab === t.id;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setSubTab(t.id)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: 'var(--space-3) var(--space-4)',
                                fontSize: '14px',
                                fontWeight: active ? 600 : 400,
                                color: active ? 'var(--notion-text)' : 'var(--notion-text-secondary)',
                                background: 'transparent',
                                border: 'none',
                                borderBottom: active ? '2px solid var(--notion-blue)' : '2px solid transparent',
                                cursor: 'pointer',
                                marginBottom: '-1px',
                            }}
                        >
                            <Icon size={14} /> {t.label}
                        </button>
                    );
                })}
                {subTab !== 'in-house' && (
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 'var(--space-2)' }}>
                        <CustomDatePicker
                            selected={date ? new Date(date + 'T00:00:00') : null}
                            onChange={(d) => setDate(d ? toLocalDateString(d) : toLocalDateString(new Date()))}
                        />
                        <Button variant="secondary" size="sm" onClick={load} disabled={loading}><RefreshCw size={14} style={{ marginRight: 4 }} />Refresh</Button>
                        <Button variant="secondary" size="sm" onClick={handleExport} disabled={!rows.length}><Download size={14} style={{ marginRight: 4 }} />CSV</Button>
                    </div>
                )}
                {subTab === 'in-house' && (
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 'var(--space-2)' }}>
                        <Button variant="secondary" size="sm" onClick={load} disabled={loading}><RefreshCw size={14} style={{ marginRight: 4 }} />Refresh</Button>
                        <Button variant="secondary" size="sm" onClick={handleExport} disabled={!rows.length}><Download size={14} style={{ marginRight: 4 }} />CSV</Button>
                    </div>
                )}
            </div>

            {loading ? (
                <div style={{ color: 'var(--notion-text-secondary)' }}>Loading…</div>
            ) : rows.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--notion-text-muted)', border: '1px dashed var(--notion-border)', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ fontSize: 14, marginBottom: 8 }}>No records for this report.</div>
                    <div style={{ fontSize: 12, color: 'var(--notion-text-secondary)' }}>
                        {subTab === 'arrivals' && `No guest arrivals on ${date}. Try the check-in date (e.g. Jun 13) or confirm bookings exist.`}
                        {subTab === 'departures' && `No departures scheduled on ${date}. Try the checkout date (e.g. Jun 16).`}
                        {subTab === 'in-house' && 'No guests are currently checked in. Check in a booking from the Bookings page.'}
                    </div>
                </div>
            ) : (
                <div style={{ overflowX: 'auto', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: 'var(--notion-bg-secondary)' }}>
                                {columns.map(col => (
                                    <th key={col} style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--notion-border)', color: 'var(--notion-text-secondary)', fontWeight: 600, textTransform: 'capitalize' }}>
                                        {col.replace(/([A-Z])/g, ' $1').trim()}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                    {columns.map(col => (
                                        <td key={col} style={{ padding: '10px 12px', color: 'var(--notion-text)' }}>
                                            {row[col] != null ? String(row[col]) : '—'}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
