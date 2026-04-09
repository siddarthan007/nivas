'use client';

import { useState } from 'react';
import { useReports } from '@/lib/hooks/useReports';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import CustomDatePicker from '@/components/ui/DatePicker';
import {
    BarChart3,
    RefreshCw,
    TrendingUp,
    TrendingDown,
    Percent,
    DollarSign,
    BedDouble,
    Clock,
    Calendar
} from 'lucide-react';

// Metric Card Component
function MetricCard({
    title,
    value,
    prefix,
    suffix,
    icon: Icon,
    trend,
    color,
}: {
    title: string;
    value: number | string;
    prefix?: string;
    suffix?: string;
    icon: React.ElementType;
    trend?: { value: number; label: string };
    color: string;
}) {
    const isPositive = trend && trend.value >= 0;

    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-5)',
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-3)',
            }}>
                <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: `${color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: color,
                }}>
                    <Icon size={18} />
                </div>
                <span style={{
                    fontSize: '13px',
                    color: 'var(--notion-text-secondary)',
                }}>
                    {title}
                </span>
            </div>

            <div style={{
                fontSize: '28px',
                fontWeight: '700',
                color: 'var(--notion-text)',
                marginBottom: trend ? 'var(--space-2)' : 0,
            }}>
                {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
            </div>

            {trend && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    color: isPositive ? 'var(--notion-green)' : 'var(--notion-red)',
                }}>
                    {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {Math.abs(trend.value || 0).toFixed(1)}% {trend.label}
                </div>
            )}
        </div>
    );
}

// Revenue Breakdown Card
function RevenueBreakdown({
    data,
}: {
    data: { label: string; value: number; color: string }[];
}) {
    const total = data.reduce((sum, d) => sum + d.value, 0);

    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-5)',
        }}>
            <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: 'var(--notion-text)',
                marginBottom: 'var(--space-4)',
            }}>
                Revenue Breakdown
            </h3>

            {/* Stacked Bar */}
            <div style={{
                height: '12px',
                borderRadius: '6px',
                backgroundColor: 'var(--notion-bg-tertiary)',
                display: 'flex',
                overflow: 'hidden',
                marginBottom: 'var(--space-4)',
            }}>
                {data.map((item, i) => (
                    <div
                        key={item.label}
                        style={{
                            width: `${total > 0 ? (item.value / total) * 100 : 0}%`,
                            backgroundColor: item.color,
                            borderRadius: i === 0 ? '6px 0 0 6px' : i === data.length - 1 ? '0 6px 6px 0' : 0,
                        }}
                    />
                ))}
            </div>

            {/* Legend */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
            }}>
                {data.map(item => (
                    <div key={item.label} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <div style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '2px',
                                backgroundColor: item.color,
                            }} />
                            <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                {item.label}
                            </span>
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--notion-text)' }}>
                            ₹{(item.value || 0).toLocaleString()}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Occupancy by Room Type
function OccupancyByType({
    data,
}: {
    data: { type: string; occupancy: number }[];
}) {
    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-5)',
        }}>
            <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: 'var(--notion-text)',
                marginBottom: 'var(--space-4)',
            }}>
                Occupancy by Room Type
            </h3>

            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
            }}>
                {data.map(item => (
                    <div key={item.type}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '4px',
                        }}>
                            <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                {item.type}
                            </span>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--notion-text)' }}>
                                {item.occupancy}%
                            </span>
                        </div>
                        <div style={{
                            height: '8px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--notion-bg-tertiary)',
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                height: '100%',
                                width: `${item.occupancy}%`,
                                backgroundColor: item.occupancy > 70 ? 'var(--notion-green)' : item.occupancy > 40 ? 'var(--notion-yellow)' : 'var(--notion-red)',
                                borderRadius: '4px',
                                transition: 'width 300ms ease',
                            }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function ReportsPage() {
    const { revenue, occupancy, metrics, period, isLoading, fetchReports, setPeriodPreset, setCustomPeriod } = useReports();
    const [customStart, setCustomStart] = useState<Date | null>(null);
    const [customEnd, setCustomEnd] = useState<Date | null>(null);

    const handleCustomRange = (start: Date | null, end: Date | null) => {
        if (start && end) {
            setCustomPeriod(
                start.toISOString().split('T')[0]!,
                end.toISOString().split('T')[0]!
            );
        }
    };

    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-8)' }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 'var(--space-6)',
                    }}>
                        <div>
                            <h1 style={{
                                fontSize: '28px',
                                fontWeight: '600',
                                color: 'var(--notion-text)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-3)',
                            }}>
                                <BarChart3 size={28} />
                                Reports & Analytics
                            </h1>
                            <p style={{
                                fontSize: '14px',
                                color: 'var(--notion-text-secondary)',
                                marginTop: 'var(--space-1)',
                            }}>
                                View hotel performance metrics and insights
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                            <Button variant="secondary" onClick={() => fetchReports()} disabled={isLoading}>
                                <RefreshCw size={14} style={{ marginRight: '6px' }} />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {/* Period Selector */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        marginBottom: 'var(--space-6)',
                        padding: 'var(--space-3)',
                        backgroundColor: 'var(--notion-bg-secondary)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--notion-border)',
                    }}>
                        <Calendar size={16} style={{ color: 'var(--notion-text-secondary)' }} />
                        <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Period:</span>
                        {['today', 'week', 'month', 'quarter', 'year'].map(preset => (
                            <Button
                                key={preset}
                                size="sm"
                                variant={period.label !== 'Custom' && (period.label.toLowerCase().includes(preset) || (preset === 'month' && period.label === 'Last 30 Days')) ? 'primary' : 'secondary'}
                                onClick={() => {
                                    setCustomStart(null);
                                    setCustomEnd(null);
                                    setPeriodPreset(preset as 'today' | 'week' | 'month' | 'quarter' | 'year');
                                }}
                            >
                                {preset === 'today' ? 'Today' : preset === 'week' ? '7 Days' : preset === 'month' ? '30 Days' : preset === 'quarter' ? '90 Days' : '1 Year'}
                            </Button>
                        ))}

                        {/* Divider */}
                        <div style={{
                            width: '1px',
                            height: '28px',
                            backgroundColor: 'var(--notion-border)',
                            margin: '0 var(--space-1)',
                        }} />

                        {/* Custom Date Range */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <CustomDatePicker
                                selected={customStart}
                                onChange={(date) => {
                                    setCustomStart(date);
                                    handleCustomRange(date, customEnd);
                                }}
                                placeholder="From"
                                maxDate={customEnd || new Date()}
                                fullWidth={false}
                            />
                            <span style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>–</span>
                            <CustomDatePicker
                                selected={customEnd}
                                onChange={(date) => {
                                    setCustomEnd(date);
                                    handleCustomRange(customStart, date);
                                }}
                                placeholder="To"
                                minDate={customStart || undefined}
                                maxDate={new Date()}
                                fullWidth={false}
                            />
                        </div>
                    </div>

                    {/* Key Metrics Grid */}
                    {isLoading ? (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: 'var(--space-4)',
                            marginBottom: 'var(--space-6)',
                        }}>
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} style={{
                                    height: '120px',
                                    backgroundColor: 'var(--notion-bg-secondary)',
                                    borderRadius: 'var(--radius-lg)',
                                    border: '1px solid var(--notion-border)',
                                    animation: 'pulse 1.5s ease-in-out infinite',
                                }} />
                            ))}
                        </div>
                    ) : (
                        <>
                            {/* Key Metrics Row */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: 'var(--space-4)',
                                marginBottom: 'var(--space-6)',
                            }}>
                                <MetricCard
                                    title="Average Daily Rate"
                                    value={metrics?.adr || 0}
                                    prefix="₹"
                                    icon={DollarSign}
                                    color="var(--notion-green)"
                                />
                                <MetricCard
                                    title="RevPAR"
                                    value={metrics?.revpar || 0}
                                    prefix="₹"
                                    icon={TrendingUp}
                                    color="var(--notion-blue)"
                                />
                                <MetricCard
                                    title="Occupancy Rate"
                                    value={metrics?.occupancyRate || 0}
                                    suffix="%"
                                    icon={BedDouble}
                                    color="var(--notion-orange)"
                                />
                                <MetricCard
                                    title="Avg. Length of Stay"
                                    value={(metrics?.averageLos || 0).toFixed(1)}
                                    suffix=" nights"
                                    icon={Clock}
                                    color="var(--notion-purple)"
                                />
                            </div>

                            {/* Revenue Section */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: 'var(--space-4)',
                                marginBottom: 'var(--space-6)',
                            }}>
                                <MetricCard
                                    title="Total Revenue"
                                    value={revenue?.totalRevenue || 0}
                                    prefix="₹"
                                    icon={DollarSign}
                                    trend={revenue?.comparison ? {
                                        value: revenue.comparison.change,
                                        label: 'vs previous period'
                                    } : undefined}
                                    color="var(--notion-green)"
                                />

                                <RevenueBreakdown
                                    data={[
                                        { label: 'Room Revenue', value: revenue?.roomRevenue || 0, color: 'var(--notion-blue)' },
                                        { label: 'F&B Revenue', value: revenue?.fbRevenue || 0, color: 'var(--notion-green)' },
                                        { label: 'Other', value: revenue?.otherRevenue || 0, color: 'var(--notion-orange)' },
                                    ]}
                                />
                            </div>

                            {/* Occupancy Section */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: 'var(--space-4)',
                            }}>
                                <MetricCard
                                    title="Average Occupancy"
                                    value={occupancy?.averageOccupancy || 0}
                                    suffix="%"
                                    icon={Percent}
                                    color="var(--notion-blue)"
                                />

                                <OccupancyByType
                                    data={occupancy?.byRoomType || [
                                        { type: 'Standard', occupancy: 65 },
                                        { type: 'Deluxe', occupancy: 78 },
                                        { type: 'Suite', occupancy: 45 },
                                    ]}
                                />
                            </div>
                        </>
                    )}
            </div>
        </DashboardLayout>
    );
}
