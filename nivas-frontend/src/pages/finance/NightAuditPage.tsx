import { useEffect } from 'react';
import { useNightAudit } from '@/lib/hooks/useNightAudit';
import Button from '@/components/ui/Button';
import { SkeletonTableRow } from '@/components/ui/Skeleton';
import {
    Moon,
    CheckCircle,
    AlertTriangle,
    Play,
    Loader2,
} from 'lucide-react';
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
                        ? `Last audit: ${new Date(lastAudit.auditDate).toLocaleDateString()} — ${lastAudit.status}`
                        : 'No previous audit records found'}
                </div>
            </div>
        </div>
    );
}

function HistoryTable({ records, isLoading }: { records: NightAuditRecord[]; isLoading: boolean }) {
    const columns = ['Date', 'Status', 'Room Revenue', 'F&B Revenue', 'Occupancy %', 'Notes'];

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
                            <th key={col} style={{
                                textAlign: 'left',
                                padding: 'var(--space-3) var(--space-4)',
                                fontSize: '12px',
                                fontWeight: '500',
                                color: 'var(--notion-text-secondary)',
                                borderBottom: '1px solid var(--notion-border)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                            }}>
                                {col}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {records.map(record => (
                        <tr key={record.id} style={{
                            borderBottom: '1px solid var(--notion-divider)',
                        }}>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--notion-text)' }}>
                                {new Date(record.auditDate).toLocaleDateString()}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                {statusBadge(record.status)}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--notion-green)', fontWeight: '500' }}>
                                ₹{parseFloat(record.roomRevenue || '0').toLocaleString()}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--notion-green)', fontWeight: '500' }}>
                                ₹{parseFloat(record.fnbRevenue || '0').toLocaleString()}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <Moon size={20} style={{ color: 'var(--notion-text-secondary)' }} />
                    <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--notion-text)' }}>
                        Night Audit
                    </span>
                </div>

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

            <HistoryTable records={history} isLoading={isLoading} />
        </div>
    );
}


