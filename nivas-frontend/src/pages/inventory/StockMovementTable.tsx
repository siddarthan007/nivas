import { useState, useMemo } from 'react';
import DateField from "@/components/ui/DateField";
import EmptyState from '@/components/ui/EmptyState';
import { History, Search, ArrowUpDown, ArrowUp, ArrowDown, Calendar } from 'lucide-react';
import type { StockMovement } from '@/lib/hooks/useInventory';

type SortField = 'date' | 'qty' | 'item';
type SortDir = 'asc' | 'desc';

interface Props {
    movements: StockMovement[];
    isLoading: boolean;
}

export default function StockMovementTable({ movements, isLoading }: Props) {
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [typeFilter, setTypeFilter] = useState('');

    const toggleSort = (field: SortField) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('desc'); }
    };

    const types = useMemo(() => Array.from(new Set(movements.map(m => m.type))), [movements]);

    const filtered = useMemo(() => {
        let data = [...movements];
        if (search.trim()) {
            const q = search.toLowerCase();
            data = data.filter(m =>
                (m.item?.name || '').toLowerCase().includes(q) ||
                (m.item?.sku || '').toLowerCase().includes(q) ||
                (m.reason || '').toLowerCase().includes(q) ||
                (m.user?.fullName || '').toLowerCase().includes(q)
            );
        }
        if (typeFilter) data = data.filter(m => m.type === typeFilter);
        if (dateFrom) data = data.filter(m => new Date(m.createdAt) >= new Date(dateFrom));
        if (dateTo) data = data.filter(m => new Date(m.createdAt) <= new Date(dateTo + 'T23:59:59'));

        data.sort((a, b) => {
            let cmp = 0;
            if (sortField === 'date') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            else if (sortField === 'qty') cmp = a.quantity - b.quantity;
            else if (sortField === 'item') cmp = (a.item?.name || '').localeCompare(b.item?.name || '');
            return sortDir === 'asc' ? cmp : -cmp;
        });
        return data;
    }, [movements, search, typeFilter, dateFrom, dateTo, sortField, sortDir]);

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown size={14} style={{ opacity: 0.4 }} />;
        return sortDir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
    };

    if (isLoading)
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>
                Loading...
            </div>
        );
    if (movements.length === 0)
        return (
            <EmptyState
                icon={<History size={40} />}
                title="No movements yet"
                description="Stock adjustments and transactions will appear here."
            />
        );

    const typeColors: Record<string, string> = {
        IN: 'var(--notion-green)',
        OUT: 'var(--notion-red)',
        ADJUSTMENT: 'var(--notion-blue)',
        RETURN: 'var(--notion-orange)',
        PURCHASE: 'var(--notion-purple)',
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search movements..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            width: '100%', padding: '7px 10px 7px 32px', borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--notion-border)', backgroundColor: 'var(--notion-bg)',
                            color: 'var(--notion-text)', fontSize: '13px', outline: 'none',
                        }}
                    />
                </div>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                    style={{ padding: '7px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)', backgroundColor: 'var(--notion-bg)', color: 'var(--notion-text)', fontSize: '13px', cursor: 'pointer' }}>
                    <option value="">All Types</option>
                    {types.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={14} style={{ color: 'var(--notion-text-muted)' }} />
                    <div style={{ width: 150 }}><DateField value={dateFrom} onChange={setDateFrom} /></div>
                    <span style={{ color: 'var(--notion-text-muted)', fontSize: '13px' }}>to</span>
                    <div style={{ width: 150 }}><DateField value={dateTo} onChange={setDateTo} /></div>
                </div>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                {filtered.length} of {movements.length} movements
            </div>

            {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--notion-text-secondary)', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)' }}>
                    <History size={40} style={{ opacity: 0.3, marginBottom: 'var(--space-4)' }} />
                    <p>No movements match your filters</p>
                </div>
            ) : (
                <div style={{ background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                            <thead style={{ backgroundColor: 'var(--notion-bg-secondary)', borderBottom: '1px solid var(--notion-border)', color: 'var(--notion-text-secondary)' }}>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: '12px 16px' }}>
                                        <button onClick={() => toggleSort('date')} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Date <SortIcon field="date" />
                                        </button>
                                    </th>
                                    <th style={{ textAlign: 'left', padding: '12px 16px' }}>
                                        <button onClick={() => toggleSort('item')} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Item <SortIcon field="item" />
                                        </button>
                                    </th>
                                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Type</th>
                                    <th style={{ textAlign: 'right', padding: '12px 16px' }}>
                                        <button onClick={() => toggleSort('qty')} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginLeft: 'auto' }}>
                                            Qty <SortIcon field="qty" />
                                        </button>
                                    </th>
                                    <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Prev</th>
                                    <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>New</th>
                                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reason</th>
                                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>By</th>
                                </tr>
                            </thead>
                            <tbody style={{ borderTop: '1px solid var(--notion-border)' }}>
                                {filtered.map(m => (
                                    <tr key={m.id} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                        <td style={{ padding: '12px 16px', color: 'var(--notion-text)' }}>
                                            {new Date(m.createdAt).toLocaleDateString()}
                                        </td>
                                        <td style={{ padding: '12px 16px', color: 'var(--notion-text)' }}>
                                            {m.item?.name}{' '}
                                            <span style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>
                                                ({m.item?.sku})
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: (typeColors[m.type] || 'var(--notion-text)') + '15', color: typeColors[m.type] || 'var(--notion-text)' }}>
                                                {m.type}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: m.quantity >= 0 ? 'var(--notion-green)' : 'var(--notion-red)' }}>
                                            {(m.quantity > 0 ? '+' : '') + m.quantity}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--notion-text-secondary)' }}>
                                            {m.previousStock}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>
                                            {m.newStock}
                                        </td>
                                        <td style={{ padding: '12px 16px', color: 'var(--notion-text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {m.reason || '-'}
                                        </td>
                                        <td style={{ padding: '12px 16px', color: 'var(--notion-text-secondary)', fontSize: '12px' }}>
                                            {m.user?.fullName || 'System'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
