import { useEffect, useState, useMemo } from 'react';
import { useNightAudit } from '@/lib/hooks/useNightAudit';
import Button from '@/components/ui/Button';
import DateField from "@/components/ui/DateField";
import { SkeletonTableRow } from '@/components/ui/Skeleton';
import {
    Moon,
    CheckCircle,
    AlertTriangle,
    Play,
    Loader2,
    Search,
} from 'lucide-react';
import DualDate from '@/components/ui/DualDate';
import type { NightAuditRecord } from '@/lib/hooks/useNightAudit';

function StatusCard({ completedToday, lastAudit }: { completedToday: boolean; lastAudit: NightAuditRecord | null }) {
    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: `1px solid ${completedToday ? 'var(--notion-green)' : 'var(--notion-orange)'}`,
            padding: 'var(--space-5)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-6)',
        }}>
            <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: completedToday ? 'var(--notion-green-bg)' : 'var(--notion-orange-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
            }}>
                {completedToday
                    ? <CheckCircle size={24} style={{ color: 'var(--notion-green)' }} />
                    : <AlertTriangle size={24} style={{ color: 'var(--notion-orange)' }} />
                }
            </div>
            <div>
                <div style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: completedToday ? 'var(--notion-green)' : 'var(--notion-orange)',
                    marginBottom: '2px',
                }}>
                    {completedToday ? 'Audit Completed Today' : 'Audit Not Yet Run'}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                    {lastAudit
                        ? <span>Last audit: <DualDate date={lastAudit.auditDate} format="compact" /> — {lastAudit.status}</span>
                        : 'No previous audit records found'}
                </div>
            </div>
        </div>
    );
}

function HistoryTable({ records, isLoading }: { records: NightAuditRecord[]; isLoading: boolean }) {
    const columns = ['Date', 'Status', 'Room Revenue', 'F&B Revenue', 'Occupancy %', 'Notes'];
    const [sortBy, setSortBy] = useState<'date' | 'revenue'>('date');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const sorted = useMemo(() => {
        const data = [...records];
        data.sort((a, b) => {
            let cmp = 0;
            if (sortBy === 'date') cmp = new Date(a.auditDate).getTime() - new Date(b.auditDate).getTime();
            else cmp = parseFloat(a.roomRevenue || '0') - parseFloat(b.roomRevenue || '0');
            return sortDir === 'asc' ? cmp : -cmp;
        });
        return data;
    }, [records, sortBy, sortDir]);

    const toggleSort = (col: 'Date' | 'Room Revenue') => {
        if (col === 'Date') {
            if (sortBy === 'date') setSortDir(d => d === 'asc' ? 'desc' : 'asc');
            else { setSortBy('date'); setSortDir('desc'); }
        } else if (col === 'Room Revenue') {
            if (sortBy === 'revenue') setSortDir(d => d === 'asc' ? 'desc' : 'asc');
            else { setSortBy('revenue'); setSortDir('desc'); }
        }
    };

    const statusBadge = (status: NightAuditRecord['status']) => {
        const styles: Record<string, { bg: string; color: string }> = {
            COMPLETED: { bg: 'var(--notion-green-bg)', color: 'var(--notion-green)' },
            FAILED: { bg: 'var(--notion-red-bg)', color: 'var(--notion-red)' },
            IN_PROGRESS: { bg: 'var(--notion-orange-bg)', color: 'var(--notion-orange)' },
        };
        const fallbackStyle = { bg: 'var(--notion-red-bg)', color: 'var(--notion-red)' };
        const s = styles[status] ?? fallbackStyle;

        return (
            <span style={{
                padding: '2px 8px',
                fontSize: '11px',
                fontWeight: '500',
                backgroundColor: s.bg,
                color: s.color,
                borderRadius: 'var(--radius-sm)',
            }}>
                {status}
            </span>
        );
    };

    if (isLoading) {
        return (
            <div style={{
                border: '1px solid var(--notion-border)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
            }}>
                {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonTableRow key={i} columns={6} />
                ))}
            </div>
        );
    }

    if (records.length === 0) {
        return (
            <div style={{
                textAlign: 'center',
                padding: 'var(--space-12)',
                color: 'var(--notion-text-secondary)',
                backgroundColor: 'var(--notion-bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--notion-border)',
            }}>
                <Moon size={48} style={{ opacity: 0.3, marginBottom: 'var(--space-4)' }} />
                <p style={{ fontSize: '16px', fontWeight: '500', marginBottom: 'var(--space-2)' }}>
                    No audit history
                </p>
                <p style={{ fontSize: '13px' }}>
                    Run your first night audit to start tracking daily financials.
                </p>
            </div>
        );
    }

    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            overflow: 'hidden',
        }}>
            <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '14px',
            }}>
                <thead>
                    <tr>
                        {columns.map(col => (
                            <th key={col}
                                onClick={() => (col === 'Date' || col === 'Room Revenue') && toggleSort(col as any)}
                                style={{
                                    textAlign: 'left',
                                    padding: 'var(--space-3) var(--space-4)',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    color: 'var(--notion-text-secondary)',
                                    borderBottom: '1px solid var(--notion-border)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    cursor: (col === 'Date' || col === 'Room Revenue') ? 'pointer' : 'default',
                                    userSelect: 'none',
                                }}
                            >
                                {col}
                                {(col === 'Date' && sortBy === 'date') || (col === 'Room Revenue' && sortBy === 'revenue') ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {sorted.map(record => (
                        <tr key={record.id} style={{
                            borderBottom: '1px solid var(--notion-divider)',
                        }}>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--notion-text)' }}>
                                <DualDate date={record.auditDate} format="compact" />
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                {statusBadge(record.status)}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--notion-green)', fontWeight: '500' }}>
                                NPR {parseFloat(record.roomRevenue || '0').toLocaleString()}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--notion-green)', fontWeight: '500' }}>
                                NPR {parseFloat(record.fnbRevenue || '0').toLocaleString()}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--notion-text)' }}>
                                {parseFloat(record.occupancyPercent || '0').toFixed(1)}%
                            </td>
                            <td style={{
                                padding: 'var(--space-3) var(--space-4)',
                                color: 'var(--notion-text-secondary)',
                                fontSize: '13px',
                                maxWidth: '200px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}>
                                {record.notes || '—'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function NightAuditPanel() {
    const {
        status,
        history,
        isLoading,
        fetchStatus,
        fetchHistory,
        triggerAudit,
    } = useNightAudit();

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | NightAuditRecord['status']>('ALL');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const filteredHistory = useMemo(() => {
        let data = [...history];
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            data = data.filter(r =>
                (r.notes || '').toLowerCase().includes(q) ||
                r.status.toLowerCase().includes(q)
            );
        }
        if (statusFilter !== 'ALL') data = data.filter(r => r.status === statusFilter);
        if (dateFrom) {
            const from = new Date(dateFrom).getTime();
            data = data.filter(r => new Date(r.auditDate).getTime() >= from);
        }
        if (dateTo) {
            const to = new Date(dateTo).getTime() + 86400000;
            data = data.filter(r => new Date(r.auditDate).getTime() <= to);
        }
        return data;
    }, [history, searchQuery, statusFilter, dateFrom, dateTo]);

    useEffect(() => {
        fetchStatus();
        fetchHistory();
    }, [fetchStatus, fetchHistory]);

    const handleTriggerAudit = async () => {
        if (status.completedToday) return;
        await triggerAudit();
    };

    return (
        <div>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-5)',
            }}>
                <div />

                <Button
                    onClick={handleTriggerAudit}
                    disabled={status.completedToday || isLoading}
                >
                    {isLoading
                        ? <Loader2 size={14} style={{ marginRight: '6px', animation: 'spin 1s linear infinite' }} />
                        : <Play size={14} style={{ marginRight: '6px' }} />
                    }
                    {isLoading ? 'Running...' : status.completedToday ? 'Already Run Today' : 'Run Night Audit'}
                </Button>
            </div>

            <StatusCard
                completedToday={status.completedToday}
                lastAudit={status.lastAudit}
            />

            <div style={{
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--notion-text)',
                marginBottom: 'var(--space-3)',
            }}>
                Audit History
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap', marginBottom: 'var(--space-4)', padding: 'var(--space-3)', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)' }}>
                <div style={{ position: 'relative', minWidth: '200px', flex: 1, maxWidth: '280px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search notes or status..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '6px 10px 6px 32px', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)', backgroundColor: 'var(--notion-bg)', color: 'var(--notion-text)', fontSize: '13px', outline: 'none' }}
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as any)}
                    style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)', backgroundColor: 'var(--notion-bg)', color: 'var(--notion-text)', fontSize: '13px', cursor: 'pointer' }}
                >
                    <option value="ALL">All Status</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="FAILED">Failed</option>
                    <option value="IN_PROGRESS">In Progress</option>
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: 150 }}><DateField value={dateFrom} onChange={setDateFrom} /></div>
                    <span style={{ color: 'var(--notion-text-muted)', fontSize: '13px' }}>to</span>
                    <div style={{ width: 150 }}><DateField value={dateTo} onChange={setDateTo} /></div>
                </div>
                {(searchQuery || statusFilter !== 'ALL' || dateFrom || dateTo) && (
                    <button onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); setDateFrom(''); setDateTo(''); }} style={{ fontSize: '12px', color: 'var(--notion-blue)', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
                )}
            </div>

            <HistoryTable records={filteredHistory} isLoading={isLoading} />
        </div>
    );
}


