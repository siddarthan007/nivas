import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { TrendingUp } from 'lucide-react';

interface Win { days: number; otbOccupancy: number; projectedOccupancy: number; otbRevenue: number; projectedRevenue: number }
interface Forecast { totalRooms: number; adr: number; avgLeadDays: number; windows: { d30: Win; d60: Win; d90: Win } }

// Demand/occupancy + revenue forecast (on-the-books + pickup projection, no AI cost).
export default function ForecastWidget() {
    const [data, setData] = useState<Forecast | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get<Forecast>('/analytics/forecast').then(r => setData(r.data || null)).catch(() => {}).finally(() => setLoading(false));
    }, []);

    if (loading || !data) return null;
    if (!data.totalRooms) return null;

    const wins = [
        { label: 'Next 30d', w: data.windows.d30 },
        { label: 'Next 60d', w: data.windows.d60 },
        { label: 'Next 90d', w: data.windows.d90 },
    ];
    const money = (n: number) => `Rs ${Math.round(n).toLocaleString()}`;

    return (
        <div style={{ background: 'var(--notion-bg-secondary)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={18} style={{ color: 'var(--notion-blue)' }} />
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--notion-text)' }}>Demand Forecast</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--notion-text-muted)' }}>ADR Rs {data.adr.toLocaleString()} · avg lead {data.avgLeadDays}d</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
                {wins.map(({ label, w }) => (
                    <div key={label} style={{ padding: 'var(--space-3)', background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ fontSize: 12, color: 'var(--notion-text-muted)', marginBottom: 6 }}>{label}</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--notion-text)' }}>{w.projectedOccupancy}%</div>
                        <div style={{ fontSize: 11, color: 'var(--notion-text-secondary)' }}>occupancy (on books {w.otbOccupancy}%)</div>
                        {/* Occupancy bar */}
                        <div style={{ height: 6, borderRadius: 3, background: 'var(--notion-bg-tertiary)', overflow: 'hidden', margin: '8px 0' }}>
                            <div style={{ width: `${Math.min(100, w.otbOccupancy)}%`, height: '100%', background: 'var(--notion-blue)' }} />
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--notion-green)' }}>{money(w.projectedRevenue)}</div>
                        <div style={{ fontSize: 11, color: 'var(--notion-text-muted)' }}>proj. revenue (booked {money(w.otbRevenue)})</div>
                    </div>
                ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--notion-text-muted)', marginTop: 10 }}>Projection = rooms already sold + expected pickup from your booking pace. Use it to set rates, staffing & purchasing.</div>
        </div>
    );
}
