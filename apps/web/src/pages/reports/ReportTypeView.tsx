'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, tokenStorage } from '@/lib/api';
import { exportToCsv } from '@/lib/utils/export';
import Button from '@/components/ui/Button';
import CustomDatePicker from '@/components/ui/DatePicker';
import { RefreshCw, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface ReportPayload {
    type: string;
    title: string;
    from: string;
    to: string;
    columns: string[];
    rows: (string | number)[][];
    summary: { label: string; value: string }[];
}

const startOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0] || ''; };
const today = () => new Date().toISOString().split('T')[0] || '';

export default function ReportTypeView({ type }: { type: string }) {
    const [data, setData] = useState<ReportPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [from, setFrom] = useState(startOfMonth());
    const [to, setTo] = useState(today());
    const [downloading, setDownloading] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<ReportPayload>(`/reports/data?type=${type}&from=${from}&to=${to}`);
            if (res.data) setData(res.data);
        } catch {
            toast.error('Failed to load report');
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [type, from, to]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const exportCsv = () => {
        if (!data) return;
        exportToCsv(`${type}-${from}_${to}.csv`, [
            [data.title, `${from} to ${to}`],
            [],
            data.columns,
            ...data.rows,
            [],
            ...data.summary.map(s => [s.label, s.value]),
        ]);
        toast.success('Exported');
    };

    const downloadPdf = async () => {
        setDownloading(true);
        try {
            const token = tokenStorage.getToken();
            const res = await fetch(`/api/v1/reports/pdf?type=${type}&from=${from}&to=${to}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!res.ok) throw new Error('PDF generation failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${type}-${from}_${to}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e: any) {
            toast.error(e?.message || 'PDF failed');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            {/* Filters + actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
                    <CustomDatePicker label="From" selected={new Date(from)} onChange={d => d && setFrom(d.toISOString().split('T')[0] || '')} maxDate={new Date(to)} fullWidth={false} />
                    <CustomDatePicker label="To" selected={new Date(to)} onChange={d => d && setTo(d.toISOString().split('T')[0] || '')} maxDate={new Date()} fullWidth={false} />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <Button variant="secondary" onClick={fetchData} disabled={loading}><RefreshCw size={14} style={{ marginRight: '6px' }} /> Refresh</Button>
                    <Button variant="secondary" onClick={exportCsv} disabled={!data || data.rows.length === 0}><Download size={14} style={{ marginRight: '6px' }} /> Excel/CSV</Button>
                    <Button variant="secondary" onClick={downloadPdf} disabled={downloading || !data}><FileText size={14} style={{ marginRight: '6px' }} /> {downloading ? 'Generating…' : 'PDF'}</Button>
                </div>
            </div>

            {/* Summary */}
            {data && data.summary.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                    {data.summary.map((s, i) => (
                        <div key={i} style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--notion-bg-secondary)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', minWidth: '140px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--notion-text)', marginTop: '2px' }}>{s.value}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Table */}
            <div style={{ background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                        <thead style={{ background: 'var(--notion-bg-secondary)', borderBottom: '1px solid var(--notion-border)', color: 'var(--notion-text-secondary)' }}>
                            <tr>
                                {(data?.columns || []).map((c, i) => (
                                    <th key={i} style={{ padding: '10px 14px', textAlign: i === (data!.columns.length - 1) ? 'right' : 'left', fontWeight: 600 }}>{c}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={data?.columns.length || 5} style={{ padding: '28px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>Loading…</td></tr>
                            ) : !data || data.rows.length === 0 ? (
                                <tr><td colSpan={data?.columns.length || 5} style={{ padding: '28px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>No records in this period.</td></tr>
                            ) : data.rows.map((r, ri) => (
                                <tr key={ri} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                    {r.map((cell, ci) => (
                                        <td key={ci} style={{ padding: '8px 14px', textAlign: ci === r.length - 1 ? 'right' : 'left', color: 'var(--notion-text)' }}>{cell}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
