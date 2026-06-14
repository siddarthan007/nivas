import { ArrowUp, ArrowDown, HelpCircle } from 'lucide-react';

interface StatsCardProps {
    title: string;
    value: string | number;
    trend?: {
        value: number;
        label: string;
        isPositive: boolean;
    };
    description?: string;
    icon?: React.ReactNode;
}

export default function StatsCard({ title, value, trend, description, icon }: StatsCardProps) {
    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            minWidth: '240px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                    fontSize: '14px',
                    color: 'var(--notion-text-secondary)',
                    fontWeight: 500
                }}>
                    {title}
                </span>
                {icon && <span style={{ color: 'var(--notion-text-muted)' }}>{icon}</span>}
            </div>

            <div style={{
                fontSize: '28px',
                fontWeight: 600,
                color: 'var(--notion-text)',
                fontFamily: 'Inter, sans-serif'
            }}>
                {value}
            </div>

            {trend && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                    <span style={{
                        color: trend.isPositive ? 'var(--notion-green)' : 'var(--notion-red)',
                        display: 'flex',
                        alignItems: 'center',
                        fontWeight: 500
                    }}>
                        {trend.isPositive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                        {Math.abs(trend.value)}%
                    </span>
                    <span style={{ color: 'var(--notion-text-muted)' }}>{trend.label}</span>
                </div>
            )}

            {description && (
                <p style={{ fontSize: '12px', color: 'var(--notion-text-muted)', marginTop: '4px' }}>
                    {description}
                </p>
            )}
        </div>
    );
}
