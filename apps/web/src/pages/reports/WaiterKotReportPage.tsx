'use client';

import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import CustomDatePicker from '@/components/ui/DatePicker';
import { api } from '@/lib/api';
import { exportObjectsToCsv } from '@/lib/utils/export';
import { toast } from 'sonner';
import {
    ClipboardList, RefreshCw, Download, Search, ArrowUp, ArrowDown, ChevronsUpDown,
    ChevronDown, ChevronRight, Clock, User, UtensilsCrossed, Hash, Banknote,
} from 'lucide-react';

interface KotItem {
    name: string;
    quantity: number;
    price: number;
    lineTotal: number;
    notes: string | null;
    status?: string;
}

interface WaiterKotRow {
    id: string;
    orderNumber: string;
    orderType: string;
    status: string;
    paymentStatus?: string;
    customerName?: string | null;
    waiterId: string | null;
    waiterName: string;
    tableNumber: string | null;
    roomNumber?: number | null;
    subTotal?: number;
    totalAmount?: number;
    itemCount?: number;
    items: KotItem[];
    notes: string | null;
    createdAt: string;
    updatedAt?: string;
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

const PAYMENT_COLOR: Record<string, { bg: string; text: string }> = {
    PAID: { bg: 'var(--notion-green-bg)', text: 'var(--notion-green)' },
    PARTIAL: { bg: 'var(--notion-orange-bg)', text: 'var(--notion-orange)' },
    UNPAID: { bg: 'var(--notion-red-bg)', text: 'var(--notion-red)' },
    ON_FOLIO: { bg: 'var(--notion-blue-bg)', text: 'var(--notion-blue)' },
};

type SortField = 'orderNumber' | 'waiterName' | 'orderType' | 'status' | 'createdAt' | 'totalAmount';

const todayIso = () => new Date().toISOString().split('T')[0] || '';

const fmtNpr = (n: number) => `NPR ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

function orderTypeLabel(row: WaiterKotRow) {
    const base = (row.orderType || '').replace(/_/g, ' ');
    if (row.tableNumber) return `${base} · Table ${row.tableNumber}`;
    if (row.roomNumber) return `${base} · Room ${row.roomNumber}`;
    return base;
}

export default function WaiterKotReportPage() {
    const [rows, setRows] = useState<WaiterKotRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [waiterId, setWaiterId] = useState('');
    const [status, setStatus] = useState('');
    const [date, setDate] = useState<string>(todayIso());
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<SortField>('createdAt');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
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

    const toggleExpand = (id: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

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
            (r.customerName || '').toLowerCase().includes(q) ||
            r.items.some(i => i.name.toLowerCase().includes(q)) ||
            (r.notes || '').toLowerCase().includes(q)
        );
        data = [...data].sort((a, b) => {
            let cmp = 0;
            if (sortField === 'createdAt') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            else if (sortField === 'totalAmount') cmp = (a.totalAmount || 0) - (b.totalAmount || 0);
            else cmp = String(a[sortField]).localeCompare(String(b[sortField]));
            return sortDir === 'asc' ? cmp : -cmp;
        });
        return data;
    }, [rows, search, sortField, sortDir]);

    const summary = useMemo(() => ({
        orders: view.length,
        items: view.reduce((s, r) => s + (r.itemCount ?? r.items.reduce((n, i) => n + i.quantity, 0)), 0),
        revenue: view.reduce((s, r) => s + (r.totalAmount || 0), 0),
        waiters: new Set(view.map(r => r.waiterId || r.waiterName)).size,
    }), [view]);

    const handleExport = () => {
        if (view.length === 0) { toast.error('Nothing to export'); return; }
        exportObjectsToCsv(`waiter-kot-${date || 'all'}.csv`, [
            { header: 'Order No', value: r => r.orderNumber },
            { header: 'Waiter', value: r => r.waiterName },
            { header: 'Customer', value: r => r.customerName || '' },
            { header: 'Order Type', value: r => orderTypeLabel(r) },
            { header: 'Status', value: r => r.status },
            { header: 'Payment', value: r => r.paymentStatus || '' },
            { header: 'Total', value: r => r.totalAmount ?? '' },
            { header: 'Items', value: r => r.items.map(i => `${i.name} x${i.quantity}`).join('; ') },
            { header: 'Notes', value: r => r.notes || '' },
            { header: 'Created', value: r => fmtTime(r.createdAt) },
            { header: 'Updated', value: r => r.updatedAt ? fmtTime(r.updatedAt) : '' },
        ], view);
        toast.success(`Exported ${view.length} orders`);
    };

    const SortHeader = ({ field, label, align = 'left' }: { field: SortField; label: string; align?: 'left' | 'right' }) => (
        <th style={{ padding: '12px 16px', textAlign: align, fontWeight: 500, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => toggleSort(field)}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                {label}
                {sortField === field ? (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} style={{ opacity: 0.4 }} />}
            </span>
        </th>
    );

    return (
        <div className="dashboard-page-pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: '24px', fontWeight: 600, color: 'var(--notion-text)' }}>
                        <ClipboardList size={26} /> Waiter KOT Report
                    </h1>
                    <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: '4px' }}>
                        Kitchen orders by waiter — expand any row for line-item detail, payment, and timing
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <Button variant="secondary" onClick={fetchReport} disabled={loading}><RefreshCw size={14} style={{ marginRight: '6px' }} /> Refresh</Button>
                    <Button variant="secondary" onClick={handleExport} disabled={view.length === 0}><Download size={14} style={{ marginRight: '6px' }} /> Export</Button>
                </div>
            </div>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: 'var(--space-5)' }}>
                {[
                    { label: 'Orders', value: summary.orders, icon: Hash },
                    { label: 'Items sold', value: summary.items, icon: UtensilsCrossed },
                    { label: 'Revenue', value: fmtNpr(summary.revenue), icon: Banknote },
                    { label: 'Waiters', value: summary.waiters, icon: User },
                ].map(card => (
                    <div key={card.label} style={{ padding: '14px 16px', background: 'var(--notion-bg-secondary)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                            <card.icon size={12} /> {card.label}
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--notion-text)' }}>{card.value}</div>
                    </div>
                ))}
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
                    <CustomDatePicker label="Date" selected={date ? new Date(date) : null} onChange={d => setDate(d ? d.toISOString().split('T')[0] || '' : '')} maxDate={new Date()} />
                </div>
                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                    <Input placeholder="Search order, waiter, guest, item…" value={search} onChange={e => setSearch(e.target.value)} icon={<Search size={16} />} />
                </div>
            </div>

            {/* Table */}
            <div style={{ background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                        <thead style={{ background: 'var(--notion-bg-secondary)', borderBottom: '1px solid var(--notion-border)', color: 'var(--notion-text-secondary)' }}>
                            <tr>
                                <th style={{ width: 36, padding: '12px 8px' }} />
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500 }}>S.N</th>
                                <SortHeader field="waiterName" label="Waiter" />
                                <SortHeader field="orderType" label="Service" />
                                <SortHeader field="orderNumber" label="Order No" />
                                <SortHeader field="status" label="Status" />
                                <SortHeader field="totalAmount" label="Total" align="right" />
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500 }}>Items</th>
                                <SortHeader field="createdAt" label="Time" />
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>Loading…</td></tr>
                            ) : view.length === 0 ? (
                                <tr><td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>No orders match these filters.</td></tr>
                            ) : view.map((r, idx) => {
                                const sc = STATUS_COLOR[r.status] || { bg: 'var(--notion-bg-tertiary)', text: 'var(--notion-text-secondary)' };
                                const pc = PAYMENT_COLOR[r.paymentStatus || 'UNPAID'] || PAYMENT_COLOR.UNPAID;
                                const isOpen = expanded.has(r.id);
                                const itemPreview = r.items.slice(0, 2).map(i => `${i.name} ×${i.quantity}`).join(', ');
                                const moreItems = r.items.length > 2 ? ` +${r.items.length - 2} more` : '';

                                return (
                                    <Fragment key={r.id}>
                                        <tr
                                            onClick={() => toggleExpand(r.id)}
                                            style={{ borderBottom: isOpen ? 'none' : '1px solid var(--notion-border)', cursor: 'pointer', background: isOpen ? 'var(--notion-bg-secondary)' : 'transparent' }}
                                            className="hover-bg"
                                        >
                                            <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--notion-text-muted)' }}>
                                                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                            </td>
                                            <td style={{ padding: '12px 16px', color: 'var(--notion-text-secondary)' }}>{idx + 1}</td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ fontWeight: 500, color: 'var(--notion-text)' }}>{r.waiterName}</div>
                                                {r.customerName && <div style={{ fontSize: '12px', color: 'var(--notion-text-muted)' }}>{r.customerName}</div>}
                                            </td>
                                            <td style={{ padding: '12px 16px', color: 'var(--notion-text-secondary)', fontSize: '13px' }}>{orderTypeLabel(r)}</td>
                                            <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '13px', color: 'var(--notion-text)' }}>{r.orderNumber}</td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: sc.bg, color: sc.text }}>{r.status}</span>
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--notion-text)', whiteSpace: 'nowrap' }}>
                                                {fmtNpr(r.totalAmount || 0)}
                                            </td>
                                            <td style={{ padding: '12px 16px', color: 'var(--notion-text)', fontSize: '13px', maxWidth: '220px' }}>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                                                    {itemPreview}{moreItems}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 16px', color: 'var(--notion-text-secondary)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {fmtTime(r.createdAt)}</span>
                                            </td>
                                        </tr>
                                        {isOpen && (
                                            <tr style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                                <td colSpan={9} style={{ padding: '0 16px 16px 48px', background: 'var(--notion-bg-secondary)' }}>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', paddingTop: '8px' }}>
                                                        <div style={{ padding: '12px 14px', background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)' }}>
                                                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--notion-text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Order details</div>
                                                            <div style={{ display: 'grid', gap: '6px', fontSize: '13px' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--notion-text-secondary)' }}>Payment</span><span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: pc.bg, color: pc.text }}>{r.paymentStatus || 'UNPAID'}</span></div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--notion-text-secondary)' }}>Subtotal</span><span>{fmtNpr(r.subTotal || 0)}</span></div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}><span>Total</span><span>{fmtNpr(r.totalAmount || 0)}</span></div>
                                                                {r.notes && <div style={{ marginTop: '4px', color: 'var(--notion-text-secondary)' }}><strong>Notes:</strong> {r.notes}</div>}
                                                            </div>
                                                        </div>
                                                        <div style={{ padding: '12px 14px', background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)' }}>
                                                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--notion-text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Timing</div>
                                                            <div style={{ fontSize: '13px', display: 'grid', gap: '6px' }}>
                                                                <div><span style={{ color: 'var(--notion-text-secondary)' }}>Created:</span> {fmtTime(r.createdAt)}</div>
                                                                {r.updatedAt && <div><span style={{ color: 'var(--notion-text-secondary)' }}>Last updated:</span> {fmtTime(r.updatedAt)}</div>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div style={{ marginTop: '12px', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                                        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                                                            <thead style={{ background: 'var(--notion-bg)' }}>
                                                                <tr>
                                                                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: 'var(--notion-text-secondary)' }}>Item</th>
                                                                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500, color: 'var(--notion-text-secondary)' }}>Qty</th>
                                                                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500, color: 'var(--notion-text-secondary)' }}>Rate</th>
                                                                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500, color: 'var(--notion-text-secondary)' }}>Amount</th>
                                                                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: 'var(--notion-text-secondary)' }}>KOT notes</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {r.items.map((item, i) => (
                                                                    <tr key={i} style={{ borderTop: '1px solid var(--notion-divider)' }}>
                                                                        <td style={{ padding: '8px 12px', color: 'var(--notion-text)' }}>{item.name}</td>
                                                                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{item.quantity}</td>
                                                                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtNpr(item.price)}</td>
                                                                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500 }}>{fmtNpr(item.lineTotal)}</td>
                                                                        <td style={{ padding: '8px 12px', color: 'var(--notion-text-muted)', fontSize: '12px' }}>{item.notes || '—'}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {!loading && view.length > 0 && (
                    <div style={{ padding: '10px 16px', borderTop: '1px solid var(--notion-border)', fontSize: '13px', color: 'var(--notion-text-secondary)', background: 'var(--notion-bg-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{view.length} order{view.length === 1 ? '' : 's'}</span>
                        <span style={{ fontWeight: 600, color: 'var(--notion-text)' }}>{fmtNpr(summary.revenue)} total</span>
                    </div>
                )}
            </div>
        </div>
    );
}
