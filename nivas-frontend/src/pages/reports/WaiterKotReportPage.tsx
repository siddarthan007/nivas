'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import CustomDatePicker from '@/components/ui/DatePicker';
import { api } from '@/lib/api';
import { exportObjectsToCsv } from '@/lib/utils/export';
import { toast } from 'sonner';
import {
    ClipboardList, RefreshCw, Download, Search, ArrowUp, ArrowDown, ChevronsUpDown,
} from 'lucide-react';

interface WaiterKotRow {
    id: string;
    orderNumber: string;
    orderType: string;
    status: string;
    waiterId: string | null;
    waiterName: string;
    tableNumber: string | null;
    items: { name: string; quantity: number }[];
    notes: string | null;
    createdAt: string;
}

const STATUS_OPTIONS = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'];

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
    PENDING: { bg: 'var(--notion-yellow-bg)', text: 'var(--notion-yellow)' },
    CONFIRMED: { bg: 'var(--notion-blue-bg)', text: 'var(--notion-blue)' },
    PREPARING: { bg: 'var(--notion-blue-bg)', text: 'var(--notion-blue)' },
    READY: { bg: 'var(--notion-green-bg)', text: 'var(--notion-green)' },
    SERVED: { bg: 'var(--notion-green-bg)', text: 'var(--notion-green)' },
    CANCELLED: { bg: 'var(--notion-red-bg)', text: 'var(--notion-red)' },
};

type SortField = 'orderNumber' | 'waiterName' | 'orderType' | 'status' | 'createdAt';

const todayIso = () => new Date().toISOString().split('T')[0]!;

export default function WaiterKotReportPage() {
    const [rows, setRows] = useState<WaiterKotRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [waiterId, setWaiterId] = useState('');
    const [status, setStatus] = useState('');
    const [date, setDate] = useState<string>(todayIso());
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<SortField>('createdAt');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    // Waiter options accumulate from results so the filter stays populated.
    const [waiterOptions, setWaiterOptions] = useState<{ id: string; name: string }[]>([]);

    const fetchReport = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (waiterId) params.append('waiterId', waiterId);
            if (status) params.append('status', status);
            if (date) params.append('date', date);
            const res = await api.get<WaiterKotRow[]>(`/reports/waiter-kot?${params.toString()}`);
            const data = res.data || [];
            setRows(data);
            // Merge any newly seen waiters into the filter options.
            setWaiterOptions(prev => {
                const map = new Map(prev.map(o => [o.id, o.name]));
                for (const r of data) if (r.waiterId) map.set(r.waiterId, r.waiterName);
                return Array.from(map, ([id, name]) => ({ id, name }));
            });
        } catch {
            toast.error('Failed to load waiter KOT report');
        } finally {
            setLoading(false);
        }
    }, [waiterId, status, date]);

    useEffect(() => { fetchReport(); }, [fetchReport]);

    const toggleSort = (field: SortField) => {
        if (sortField === field) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        else { setSortField(field); setSortDir('asc'); }
    };

    const view = useMemo(() => {
        const q = search.trim().toLowerCase();
        let data = rows.filter(r =>
            !q ||
            r.orderNumber.toLowerCase().includes(q) ||
            r.waiterName.toLowerCase().includes(q) ||
            r.items.some(i => i.name.toLowerCase().includes(q)) ||
            (r.notes || '').toLowerCase().includes(q)
        );
        data = [...data].sort((a, b) => {
            let cmp = 0;
            if (sortField === 'createdAt') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            else cmp = String(a[sortField]).localeCompare(String(b[sortField]));
            return sortDir === 'asc' ? cmp : -cmp;
        });
        return data;
    }, [rows, search, sortField, sortDir]);

    const handleExport = () => {
        if (view.length === 0) { toast.error('Nothing to export'); return; }
        exportObjectsToCsv(`waiter-kot-${date || 'all'}.csv`, [
            { header: 'Order No', value: r => r.orderNumber },
            { header: 'Waiter', value: r => r.waiterName },
            { header: 'Order Type', value: r => r.orderType },
            { header: 'Table', value: r => r.tableNumber || '' },
            { header: 'Status', value: r => r.status },
            { header: 'Items', value: r => r.items.map(i => `${i.name} x${i.quantity}`).join('; ') },
            { header: 'Notes', value: r => r.notes || '' },
            { header: 'Time', value: r => new Date(r.createdAt).toLocaleString() },
        ], view);
        toast.success(`Exported ${view.length} orders`);
    };

    const SortHeader = ({ field, label, align = 'left' }: { field: SortField; label: string; align?: 'left' | 'right' }) => (
        <th style={{ padding: '12px 16px', textAlign: align, fontWeight: 500, cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort(field)}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                {label}
                {sortField === field ? (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} style={{ opacity: 0.4 }} />}
            </span>
        </th>
    );

    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-8)' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                    <div>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: '24px', fontWeight: 600, color: 'var(--notion-text)' }}>
                            <ClipboardList size={26} /> Waiter KOT Report
                        </h1>
                        <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: '4px' }}>Orders attributed to each waiter, by status and date</p>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <Button variant="secondary" onClick={fetchReport} disabled={loading}><RefreshCw size={14} style={{ marginRight: '6px' }} /> Refresh</Button>
                        <Button variant="secondary" onClick={handleExport} disabled={view.length === 0}><Download size={14} style={{ marginRight: '6px' }} /> Export</Button>
                    </div>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 'var(--space-5)', padding: 'var(--space-4)', background: 'var(--notion-bg-secondary)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ minWidth: '180px' }}>
                        <Select label="Waiter" value={waiterId} onChange={e => setWaiterId(e.target.value)} fullWidth
                            options={[{ value: '', label: 'All Waiters' }, ...waiterOptions.map(w => ({ value: w.id, label: w.name }))]} />
                    </div>
                    <div style={{ minWidth: '160px' }}>
                        <Select label="KOT Status" value={status} onChange={e => setStatus(e.target.value)} fullWidth
                            options={[{ value: '', label: 'All Statuses' }, ...STATUS_OPTIONS.map(s => ({ value: s, label: s }))]} />
                    </div>
                    <div style={{ minWidth: '160px' }}>
                        <CustomDatePicker label="Date" selected={date ? new Date(date) : null} onChange={d => setDate(d ? d.toISOString().split('T')[0]! : '')} maxDate={new Date()} />
                    </div>
                    <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                        <Input placeholder="Search order, waiter, item, notes..." value={search} onChange={e => setSearch(e.target.value)} icon={<Search size={16} />} />
                    </div>
                </div>

                {/* Table */}
                <div style={{ background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                            <thead style={{ background: 'var(--notion-bg-secondary)', borderBottom: '1px solid var(--notion-border)', color: 'var(--notion-text-secondary)' }}>
                                <tr>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500 }}>S.N</th>
                                    <SortHeader field="waiterName" label="Waiter" />
                                    <SortHeader field="orderType" label="Order Type" />
                                    <SortHeader field="orderNumber" label="Order No" />
                                    <SortHeader field="status" label="Status" />
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500 }}>Items</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500 }}>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>Loading…</td></tr>
                                ) : view.length === 0 ? (
                                    <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>No orders match these filters.</td></tr>
                                ) : view.map((r, idx) => {
                                    const sc = STATUS_COLOR[r.status] || { bg: 'var(--notion-bg-tertiary)', text: 'var(--notion-text-secondary)' };
                                    return (
                                        <tr key={r.id} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                            <td style={{ padding: '12px 16px', color: 'var(--notion-text-secondary)' }}>{idx + 1}</td>
                                            <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--notion-text)' }}>{r.waiterName}</td>
                                            <td style={{ padding: '12px 16px', color: 'var(--notion-text-secondary)' }}>
                                                {r.orderType?.replace('_', ' ')}{r.tableNumber ? ` · T${r.tableNumber}` : ''}
                                            </td>
                                            <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '13px', color: 'var(--notion-text)' }}>{r.orderNumber}</td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: sc.bg, color: sc.text }}>{r.status}</span>
                                            </td>
                                            <td style={{ padding: '12px 16px', color: 'var(--notion-text)' }}>
                                                {r.items.map((i, k) => (
                                                    <div key={k} style={{ fontSize: '13px' }}>{i.name} <span style={{ color: 'var(--notion-text-secondary)' }}>x{i.quantity}</span></div>
                                                ))}
                                            </td>
                                            <td style={{ padding: '12px 16px', color: 'var(--notion-text-secondary)', fontSize: '13px' }}>{r.notes || '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {!loading && view.length > 0 && (
                        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--notion-border)', fontSize: '13px', color: 'var(--notion-text-secondary)', background: 'var(--notion-bg-secondary)' }}>
                            {view.length} order{view.length === 1 ? '' : 's'}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
