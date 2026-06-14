'use client';

import { useState, useEffect, useCallback } from 'react';
import { Moon, Play, RefreshCw, CheckCircle, Clock } from 'lucide-react';
import Button from '@/components/ui/Button';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { usePermissions } from '@/lib/hooks/usePermissions';

interface NightAuditRecord {
    id: number;
    auditDate: string;
    status: string;
    totalRoomRevenue: string;
    totalFnbRevenue: string;
    occupancyPercentage: string;
    notes?: string;
}

export default function NightAuditPanel() {
    const { can } = usePermissions();
    const [history, setHistory] = useState<NightAuditRecord[]>([]);
    const [completedToday, setCompletedToday] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isRunning, setIsRunning] = useState(false);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [statusRes, historyRes] = await Promise.all([
                api.get<{ completedToday: boolean }>('/night-audit/status'),
                api.get<NightAuditRecord[]>('/night-audit/history'),
            ]);
            setCompletedToday(!!statusRes.data?.completedToday);
            setHistory(Array.isArray(historyRes.data) ? historyRes.data : []);
        } catch {
            toast.error('Failed to load night audit data');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleRun = async () => {
        setIsRunning(true);
        try {
            await api.post('/night-audit/trigger');
            toast.success('Night audit completed');
            await fetchData();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Night audit failed';
            toast.error(msg);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div style={{
                padding: 'var(--space-5)',
                backgroundColor: 'var(--notion-bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--notion-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--space-4)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div style={{
                        width: 48, height: 48, borderRadius: '50%',
                        backgroundColor: completedToday ? 'var(--notion-green-bg)' : 'var(--notion-blue-bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        {completedToday ? <CheckCircle size={24} style={{ color: 'var(--notion-green)' }} /> : <Moon size={24} style={{ color: 'var(--notion-blue)' }} />}
                    </div>
                    <div>
                        <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--notion-text)' }}>Night Audit</div>
                        <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                            {completedToday ? 'Completed for today' : 'Not yet run for today — posts room charges and F&B revenue'}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <Button variant="secondary" onClick={fetchData} disabled={isLoading}>
                        <RefreshCw size={14} style={{ marginRight: '6px' }} /> Refresh
                    </Button>
                    {can('operations:run_night_audit') && (
                        <Button onClick={handleRun} disabled={isRunning}>
                            <Play size={14} style={{ marginRight: '6px' }} />
                            {isRunning ? 'Running...' : 'Run audit'}
                        </Button>
                    )}
                </div>
            </div>

            <div style={{ backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--notion-border)', fontSize: '14px', fontWeight: 600, color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={16} /> Recent audits
                </div>
                {isLoading ? (
                    <div style={{ padding: '24px', color: 'var(--notion-text-secondary)', fontSize: '13px' }}>Loading...</div>
                ) : history.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--notion-text-secondary)', fontSize: '13px' }}>No audit history yet</div>
                ) : (
                    <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                        <thead style={{ backgroundColor: 'var(--notion-bg-tertiary)', color: 'var(--notion-text-secondary)' }}>
                            <tr>
                                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500 }}>Date</th>
                                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 500 }}>Room revenue</th>
                                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 500 }}>F&B revenue</th>
                                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 500 }}>Occupancy</th>
                                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500 }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map(row => (
                                <tr key={row.id} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                    <td style={{ padding: '10px 16px' }}>{row.auditDate}</td>
                                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>NPR {(parseFloat(row.totalRoomRevenue) || 0).toLocaleString()}</td>
                                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>NPR {(parseFloat(row.totalFnbRevenue) || 0).toLocaleString()}</td>
                                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>{row.occupancyPercentage}%</td>
                                    <td style={{ padding: '10px 16px' }}>{row.status}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
