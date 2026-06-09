'use client';

import { useState, useEffect } from 'react';
import { useRevenue } from '@/lib/hooks/useRevenue';
import { useAnalytics } from '@/lib/hooks/useAnalytics';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import CustomDatePicker from '@/components/ui/DatePicker';
import TimePicker from '@/components/ui/TimePicker';
import {
    TrendingUp,
    TrendingDown,
    Percent,
    Calendar,
    Plus,
    RefreshCw,
    Trash2,
    ToggleLeft,
    ToggleRight,
    Edit,
    Tag,
    Moon,
    BarChart3,
    BedDouble,
    DollarSign,
} from 'lucide-react';
import type {
    PricingRule,
    DiscountRule,
    CreatePricingRulePayload,
    CreateDiscountRulePayload,
    LosDiscount,
    CreateLosDiscountPayload,
} from '@/lib/hooks/useRevenue';
import SecurityConfirmModal from '@/components/modals/SecurityConfirmModal';

// Tab Navigation
function TabNav({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
    const tabs = [
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        { id: 'pricing', label: 'Dynamic Pricing', icon: TrendingUp },
        { id: 'discounts', label: 'Discounts', icon: Tag },
        { id: 'los', label: 'LOS Discounts', icon: Moon },
    ];

    return (
        <div style={{
            display: 'flex',
            gap: 'var(--space-1)',
            borderBottom: '1px solid var(--notion-divider)',
            marginBottom: 'var(--space-6)',
        }}>
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-3) var(--space-4)',
                        fontSize: '14px',
                        fontWeight: activeTab === tab.id ? '600' : '400',
                        color: activeTab === tab.id ? 'var(--notion-text)' : 'var(--notion-text-secondary)',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderBottom: activeTab === tab.id ? '2px solid var(--notion-blue)' : '2px solid transparent',
                        cursor: 'pointer',
                    }}
                >
                    <tab.icon size={16} />
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

// Pricing Rule Card
function PricingRuleCard({ rule, onToggle, onDelete, onEdit }: {
    rule: PricingRule;
    onToggle: () => void;
    onDelete: () => void;
    onEdit: () => void;
}) {
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-4)',
            opacity: rule.isActive ? 1 : 0.6,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                <div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--notion-text)' }}>
                        {rule.name}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                        {rule.type} • {rule.adjustmentType === 'PERCENTAGE' ? `${rule.adjustmentValue}%` : `Rs ${rule.adjustmentValue}`}
                    </div>
                </div>
                <div style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: '500',
                    backgroundColor: rule.adjustmentValue > 0 ? 'var(--notion-green-bg)' : 'var(--notion-red-bg)',
                    color: rule.adjustmentValue > 0 ? 'var(--notion-green)' : 'var(--notion-red)',
                    borderRadius: 'var(--radius-sm)',
                }}>
                    {rule.adjustmentValue > 0 ? '+' : ''}{rule.adjustmentType === 'PERCENTAGE' ? `${rule.adjustmentValue}%` : `Rs ${rule.adjustmentValue}`}
                </div>
            </div>

            {rule.daysOfWeek && rule.daysOfWeek.length > 0 && (
                <div style={{ display: 'flex', gap: '4px', marginBottom: 'var(--space-3)' }}>
                    {daysOfWeek.map((day, i) => (
                        <span
                            key={day}
                            style={{
                                padding: '2px 6px',
                                fontSize: '11px',
                                borderRadius: '4px',
                                backgroundColor: rule.daysOfWeek?.includes(i) ? 'var(--notion-blue-bg)' : 'var(--notion-bg-tertiary)',
                                color: rule.daysOfWeek?.includes(i) ? 'var(--notion-blue)' : 'var(--notion-text-secondary)',
                            }}
                        >
                            {day}
                        </span>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button size="sm" variant="secondary" onClick={onToggle}>
                    {rule.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                </Button>
                <Button size="sm" variant="secondary" onClick={onEdit}>
                    <Edit size={14} />
                </Button>
                <Button size="sm" variant="secondary" onClick={onDelete}>
                    <Trash2 size={14} />
                </Button>
            </div>
        </div>
    );
}

// Discount Rule Card
function DiscountRuleCard({ rule, onToggle, onDelete, onEdit }: {
    rule: DiscountRule;
    onToggle: () => void;
    onDelete: () => void;
    onEdit: () => void;
}) {
    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-4)',
            opacity: rule.isActive ? 1 : 0.6,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                <div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--notion-text)' }}>
                        {rule.name}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                        {rule.description || rule.discountType}
                    </div>
                </div>
                <div style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: '600',
                    backgroundColor: 'var(--notion-orange-bg)',
                    color: 'var(--notion-orange)',
                    borderRadius: 'var(--radius-sm)',
                }}>
                    {rule.discountType === 'BOGO' ? 'BOGO' :
                        rule.discountType === 'PERCENTAGE' ? `-${rule.discountValue}%` : `-Rs ${rule.discountValue}`}
                </div>
            </div>

            {rule.startTime && rule.endTime && (
                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)' }}>
                    Time: {rule.startTime} - {rule.endTime}
                </div>
            )}

            {rule.minOrderAmount && (
                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)' }}>
                    Min order: Rs ${rule.minOrderAmount}
                </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button size="sm" variant="secondary" onClick={onToggle}>
                    {rule.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                </Button>
                <Button size="sm" variant="secondary" onClick={onEdit}>
                    <Edit size={14} />
                </Button>
                <Button size="sm" variant="secondary" onClick={onDelete}>
                    <Trash2 size={14} />
                </Button>
            </div>
        </div>
    );
}

// LOS Discount Card
function LosDiscountCard({ rule, onToggle, onDelete, onEdit }: {
    rule: LosDiscount;
    onToggle: () => void;
    onDelete: () => void;
    onEdit: () => void;
}) {
    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-4)',
            opacity: rule.isActive ? 1 : 0.6,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                <div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--notion-text)' }}>
                        {rule.name}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                        {rule.minNights}–{rule.maxNights ?? '∞'} nights
                    </div>
                </div>
                <div style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: '600',
                    backgroundColor: 'var(--notion-blue-bg)',
                    color: 'var(--notion-blue)',
                    borderRadius: 'var(--radius-sm)',
                }}>
                    {rule.discountType === 'PERCENTAGE' ? `-${rule.discountValue}%` : `-Rs ${rule.discountValue}`}
                </div>
            </div>

            {rule.startDate && rule.endDate && (
                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)' }}>
                    Valid: {new Date(rule.startDate).toLocaleDateString()} – {new Date(rule.endDate).toLocaleDateString()}
                </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button size="sm" variant="secondary" onClick={onToggle}>
                    {rule.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                </Button>
                <Button size="sm" variant="secondary" onClick={onEdit}>
                    <Edit size={14} />
                </Button>
                <Button size="sm" variant="secondary" onClick={onDelete}>
                    <Trash2 size={14} />
                </Button>
            </div>
        </div>
    );
}

// Analytics Metric Card
function AnalyticsMetricCard({ label, value, icon: Icon, trend, trendLabel, color }: {
    label: string;
    value: string;
    icon: React.ElementType;
    trend?: number;
    trendLabel?: string;
    color: string;
}) {
    const isPositive = trend !== undefined && trend >= 0;

    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--notion-text-secondary)' }}>
                    {label}
                </span>
                <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: color + '1a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <Icon size={18} style={{ color }} />
                </div>
            </div>

            <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--notion-text)', letterSpacing: '-0.5px' }}>
                {value}
            </div>

            {trend !== undefined && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {isPositive ? (
                        <TrendingUp size={14} style={{ color: 'var(--notion-green)' }} />
                    ) : (
                        <TrendingDown size={14} style={{ color: 'var(--notion-red)' }} />
                    )}
                    <span style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: isPositive ? 'var(--notion-green)' : 'var(--notion-red)',
                    }}>
                        {isPositive ? '+' : ''}{trend.toFixed(1)}%
                    </span>
                    {trendLabel && (
                        <span style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                            {trendLabel}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

// Custom recharts tooltip
function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            border: '1px solid var(--notion-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
            fontSize: '13px',
        }}>
            <div style={{ color: 'var(--notion-text-secondary)', marginBottom: '4px' }}>{label}</div>
            <div style={{ color: 'var(--notion-text)', fontWeight: '600' }}>
                Rs {(Number(payload[0]?.value) || 0).toLocaleString('en-IN')}
            </div>
        </div>
    );
}

// Analytics Tab Content
function AnalyticsTab() {
    const { revenueData, occupancyData, metrics, isLoading, fetchRevenue, fetchOccupancy, fetchMetrics } = useAnalytics();
    const [period, setPeriod] = useState(30);

    useEffect(() => {
        fetchRevenue(period);
        fetchOccupancy(period);
        fetchMetrics(period);
    }, [period, fetchRevenue, fetchOccupancy, fetchMetrics]);

    const formatCurrency = (val: number | undefined | null) => {
        const v = Number(val) || 0;
        if (v >= 100000) return `Rs ${(v / 100000).toFixed(1)}L`;
        if (v >= 1000) return `Rs ${(v / 1000).toFixed(1)}K`;
        return `Rs ${v.toFixed(0)}`;
    };

    if (isLoading && !metrics) {
        return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} style={{
                        height: '140px',
                        backgroundColor: 'var(--notion-bg-secondary)',
                        borderRadius: 'var(--radius-lg)',
                        animation: 'pulse 1.5s ease-in-out infinite',
                    }} />
                ))}
            </div>
        );
    }

    const revenueChange = revenueData?.comparison
        ? revenueData.comparison.change
        : undefined;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {/* Period selector */}
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {[7, 14, 30, 90].map(d => (
                    <button
                        key={d}
                        onClick={() => setPeriod(d)}
                        style={{
                            padding: '6px 14px',
                            fontSize: '13px',
                            fontWeight: period === d ? '600' : '400',
                            color: period === d ? 'var(--notion-text)' : 'var(--notion-text-secondary)',
                            backgroundColor: period === d ? 'var(--notion-bg-tertiary)' : 'transparent',
                            border: '1px solid',
                            borderColor: period === d ? 'var(--notion-border)' : 'transparent',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                        }}
                    >
                        {d}d
                    </button>
                ))}
            </div>

            {/* Metric cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                <AnalyticsMetricCard
                    label="RevPAR"
                    value={metrics ? formatCurrency(metrics.revpar ?? 0) : '—'}
                    icon={BarChart3}
                    trend={revenueChange}
                    trendLabel="vs prev period"
                    color="#6c9cfc"
                />
                <AnalyticsMetricCard
                    label="ADR"
                    value={metrics ? formatCurrency(metrics.adr ?? 0) : '—'}
                    icon={DollarSign}
                    color="#e09e50"
                />
                <AnalyticsMetricCard
                    label="Occupancy"
                    value={metrics ? `${(metrics.occupancyRate ?? 0).toFixed(1)}%` : '—'}
                    icon={BedDouble}
                    trend={occupancyData && metrics ? (occupancyData.averageOccupancy ?? 0) - (metrics.occupancyRate ?? 0) : undefined}
                    trendLabel="vs average"
                    color="#5bbf7f"
                />
                <AnalyticsMetricCard
                    label="Avg Length of Stay"
                    value={metrics ? `${(metrics.averageLos ?? 0).toFixed(1)} nights` : '—'}
                    icon={Moon}
                    color="#c084fc"
                />
            </div>

            {/* Revenue breakdown */}
            {revenueData && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 'var(--space-4)',
                }}>
                    {[
                        { label: 'Room Revenue', value: revenueData.roomRevenue ?? 0, color: 'var(--notion-blue)' },
                        { label: 'F&B Revenue', value: revenueData.fbRevenue ?? 0, color: 'var(--notion-orange)' },
                        { label: 'Other Revenue', value: revenueData.otherRevenue ?? 0, color: 'var(--notion-text-secondary)' },
                    ].map(item => (
                        <div key={item.label} style={{
                            backgroundColor: 'var(--notion-bg-secondary)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--notion-border)',
                            padding: 'var(--space-4)',
                        }}>
                            <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-1)' }}>
                                {item.label}
                            </div>
                            <div style={{ fontSize: '20px', fontWeight: '600', color: item.color }}>
                                {formatCurrency(item.value)}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Revenue trend chart */}
            {revenueData?.trend && revenueData.trend.length > 0 && (
                <div style={{
                    backgroundColor: 'var(--notion-bg-secondary)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--notion-border)',
                    padding: 'var(--space-5)',
                }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--notion-text)', marginBottom: 'var(--space-4)' }}>
                        Revenue Trend
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={revenueData.trend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6c9cfc" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#6c9cfc" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--notion-divider)" />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 11, fill: 'var(--notion-text-secondary)' }}
                                tickLine={false}
                                axisLine={{ stroke: 'var(--notion-divider)' }}
                                tickFormatter={(v: string) => {
                                    const d = new Date(v);
                                    return `${d.getDate()}/${d.getMonth() + 1}`;
                                }}
                            />
                            <YAxis
                                tick={{ fontSize: 11, fill: 'var(--notion-text-secondary)' }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
                            />
                            <Tooltip content={<ChartTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="amount"
                                stroke="#6c9cfc"
                                strokeWidth={2}
                                fill="url(#revGradient)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Occupancy trend chart */}
            {occupancyData?.trend && occupancyData.trend.length > 0 && (
                <div style={{
                    backgroundColor: 'var(--notion-bg-secondary)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--notion-border)',
                    padding: 'var(--space-5)',
                }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--notion-text)', marginBottom: 'var(--space-4)' }}>
                        Occupancy Trend
                    </div>
                    <ResponsiveContainer width="100%" height={240}>
                        <AreaChart data={occupancyData.trend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="occGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#5bbf7f" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#5bbf7f" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--notion-divider)" />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 11, fill: 'var(--notion-text-secondary)' }}
                                tickLine={false}
                                axisLine={{ stroke: 'var(--notion-divider)' }}
                                tickFormatter={(v: string) => {
                                    const d = new Date(v);
                                    return `${d.getDate()}/${d.getMonth() + 1}`;
                                }}
                            />
                            <YAxis
                                tick={{ fontSize: 11, fill: 'var(--notion-text-secondary)' }}
                                tickLine={false}
                                axisLine={false}
                                domain={[0, 100]}
                                tickFormatter={(v: number) => `${v}%`}
                            />
                            <Tooltip
                                content={({ active, payload, label }: any) => {
                                    if (!active || !payload?.length) return null;
                                    return (
                                        <div style={{
                                            backgroundColor: 'var(--notion-bg-secondary)',
                                            border: '1px solid var(--notion-border)',
                                            borderRadius: 'var(--radius-md)',
                                            padding: 'var(--space-3)',
                                            fontSize: '13px',
                                        }}>
                                            <div style={{ color: 'var(--notion-text-secondary)', marginBottom: '4px' }}>{label}</div>
                                            <div style={{ color: 'var(--notion-text)', fontWeight: '600' }}>
                                                {(Number(payload[0]?.value) || 0).toFixed(1)}%
                                            </div>
                                        </div>
                                    );
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="occupancy"
                                stroke="#5bbf7f"
                                strokeWidth={2}
                                fill="url(#occGradient)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}

// Create Pricing Rule Modal
function CreatePricingRuleModal({ isOpen, onClose, onSubmit }: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CreatePricingRulePayload) => Promise<boolean>;
}) {
    const [formData, setFormData] = useState<CreatePricingRulePayload>({
        name: '',
        type: 'WEEKEND',
        adjustmentType: 'PERCENTAGE',
        adjustmentValue: 10,
        isActive: true,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const success = await onSubmit(formData);
        setIsSubmitting(false);
        if (success) {
            setFormData({ name: '', type: 'WEEKEND', adjustmentType: 'PERCENTAGE', adjustmentValue: 10, isActive: true });
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create Pricing Rule">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Rule Name *
                    </label>
                    <Input
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Weekend Premium"
                        required
                    />
                </div>

                <Select
                    label="Type"
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    fullWidth
                    options={[
                        { value: 'WEEKEND', label: 'Weekend' },
                        { value: 'HOLIDAY', label: 'Holiday' },
                        { value: 'SEASON', label: 'Seasonal' },
                        { value: 'OCCUPANCY', label: 'Occupancy Based' },
                        { value: 'ADVANCE', label: 'Advance Booking' },
                    ]}
                />

                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <div style={{ flex: 1 }}>
                        <Select
                            label="Adjustment Type"
                            value={formData.adjustmentType}
                            onChange={e => setFormData({ ...formData, adjustmentType: e.target.value as 'FLAT' | 'PERCENTAGE' })}
                            fullWidth
                            options={[
                                { value: 'PERCENTAGE', label: 'Percentage' },
                                { value: 'FLAT', label: 'Flat Amount' },
                            ]}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                            Value {formData.adjustmentType === 'PERCENTAGE' ? '(%)' : '(Rs )'}
                        </label>
                        <Input
                            type="number"
                            value={formData.adjustmentValue}
                            onChange={e => setFormData({ ...formData, adjustmentValue: parseFloat(e.target.value) || 0 })}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting || !formData.name.trim()} style={{ flex: 1 }}>
                        {isSubmitting ? 'Creating...' : 'Create Rule'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// Create Discount Rule Modal
function CreateDiscountRuleModal({ isOpen, onClose, onSubmit }: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CreateDiscountRulePayload) => Promise<boolean>;
}) {
    const [formData, setFormData] = useState<CreateDiscountRulePayload>({
        name: '',
        discountType: 'PERCENTAGE',
        discountValue: 10,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const success = await onSubmit(formData);
        setIsSubmitting(false);
        if (success) {
            setFormData({ name: '', discountType: 'PERCENTAGE', discountValue: 10 });
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create Discount">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Name *
                    </label>
                    <Input
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Happy Hour 20%"
                        required
                    />
                </div>

                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Description
                    </label>
                    <Input
                        value={formData.description || ''}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Optional description"
                    />
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <div style={{ flex: 1 }}>
                        <Select
                            label="Type"
                            value={formData.discountType}
                            onChange={e => setFormData({ ...formData, discountType: e.target.value as 'PERCENTAGE' | 'FLAT' | 'BOGO' })}
                            fullWidth
                            options={[
                                { value: 'PERCENTAGE', label: 'Percentage' },
                                { value: 'FLAT', label: 'Flat Amount' },
                                { value: 'BOGO', label: 'Buy One Get One' },
                            ]}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                            Value
                        </label>
                        <Input
                            type="number"
                            value={formData.discountValue}
                            onChange={e => setFormData({ ...formData, discountValue: parseFloat(e.target.value) || 0 })}
                            disabled={formData.discountType === 'BOGO'}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <div style={{ flex: 1 }}>
                        <TimePicker
                            label="Start Time"
                            value={formData.startTime || ''}
                            onChange={v => setFormData({ ...formData, startTime: v })}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <TimePicker
                            label="End Time"
                            value={formData.endTime || ''}
                            onChange={v => setFormData({ ...formData, endTime: v })}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting || !formData.name.trim()} style={{ flex: 1 }}>
                        {isSubmitting ? 'Creating...' : 'Create Discount'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// Edit Pricing Rule Modal
function EditPricingRuleModal({ isOpen, onClose, rule, onSubmit }: {
    isOpen: boolean;
    onClose: () => void;
    rule: PricingRule | null;
    onSubmit: (id: number, data: Partial<CreatePricingRulePayload>) => Promise<boolean>;
}) {
    const [formData, setFormData] = useState<CreatePricingRulePayload>({
        name: '',
        type: 'WEEKEND',
        adjustmentType: 'PERCENTAGE',
        adjustmentValue: 10,
        isActive: true,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (rule) {
            setFormData({
                name: rule.name,
                type: rule.type,
                adjustmentType: rule.adjustmentType,
                adjustmentValue: rule.adjustmentValue,
                isActive: rule.isActive,
                startDate: rule.startDate,
                endDate: rule.endDate,
                daysOfWeek: rule.daysOfWeek,
                minOccupancy: rule.minOccupancy,
                maxOccupancy: rule.maxOccupancy,
            });
        }
    }, [rule]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rule) return;
        setIsSubmitting(true);
        const success = await onSubmit(rule.id, formData);
        setIsSubmitting(false);
        if (success) onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Pricing Rule">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Rule Name *
                    </label>
                    <Input
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Weekend Premium"
                        required
                    />
                </div>

                <Select
                    label="Type"
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    fullWidth
                    options={[
                        { value: 'WEEKEND', label: 'Weekend' },
                        { value: 'HOLIDAY', label: 'Holiday' },
                        { value: 'SEASON', label: 'Seasonal' },
                        { value: 'OCCUPANCY', label: 'Occupancy Based' },
                        { value: 'ADVANCE', label: 'Advance Booking' },
                    ]}
                />

                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <div style={{ flex: 1 }}>
                        <Select
                            label="Adjustment Type"
                            value={formData.adjustmentType}
                            onChange={e => setFormData({ ...formData, adjustmentType: e.target.value as 'FLAT' | 'PERCENTAGE' })}
                            fullWidth
                            options={[
                                { value: 'PERCENTAGE', label: 'Percentage' },
                                { value: 'FLAT', label: 'Flat Amount' },
                            ]}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                            Value {formData.adjustmentType === 'PERCENTAGE' ? '(%)' : '(Rs )'}
                        </label>
                        <Input
                            type="number"
                            value={formData.adjustmentValue}
                            onChange={e => setFormData({ ...formData, adjustmentValue: parseFloat(e.target.value) || 0 })}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting || !formData.name.trim()} style={{ flex: 1 }}>
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// Edit Discount Rule Modal
function EditDiscountRuleModal({ isOpen, onClose, rule, onSubmit }: {
    isOpen: boolean;
    onClose: () => void;
    rule: DiscountRule | null;
    onSubmit: (id: number, data: Partial<CreateDiscountRulePayload & { isActive?: boolean }>) => Promise<boolean>;
}) {
    const [formData, setFormData] = useState<CreateDiscountRulePayload>({
        name: '',
        discountType: 'PERCENTAGE',
        discountValue: 10,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (rule) {
            setFormData({
                name: rule.name,
                description: rule.description,
                discountType: rule.discountType,
                discountValue: rule.discountValue,
                startTime: rule.startTime,
                endTime: rule.endTime,
                daysOfWeek: rule.daysOfWeek,
                startDate: rule.startDate,
                endDate: rule.endDate,
                minOrderAmount: rule.minOrderAmount,
                applicableCategories: rule.applicableCategories,
                applicableItems: rule.applicableItems,
                priority: rule.priority,
                outletId: rule.outletId,
            });
        }
    }, [rule]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rule) return;
        setIsSubmitting(true);
        const success = await onSubmit(rule.id, formData);
        setIsSubmitting(false);
        if (success) onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Discount">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Name *
                    </label>
                    <Input
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Happy Hour 20%"
                        required
                    />
                </div>

                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Description
                    </label>
                    <Input
                        value={formData.description || ''}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Optional description"
                    />
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <div style={{ flex: 1 }}>
                        <Select
                            label="Type"
                            value={formData.discountType}
                            onChange={e => setFormData({ ...formData, discountType: e.target.value as 'PERCENTAGE' | 'FLAT' | 'BOGO' })}
                            fullWidth
                            options={[
                                { value: 'PERCENTAGE', label: 'Percentage' },
                                { value: 'FLAT', label: 'Flat Amount' },
                                { value: 'BOGO', label: 'Buy One Get One' },
                            ]}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                            Value
                        </label>
                        <Input
                            type="number"
                            value={formData.discountValue}
                            onChange={e => setFormData({ ...formData, discountValue: parseFloat(e.target.value) || 0 })}
                            disabled={formData.discountType === 'BOGO'}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <div style={{ flex: 1 }}>
                        <TimePicker
                            label="Start Time"
                            value={formData.startTime || ''}
                            onChange={v => setFormData({ ...formData, startTime: v })}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <TimePicker
                            label="End Time"
                            value={formData.endTime || ''}
                            onChange={v => setFormData({ ...formData, endTime: v })}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting || !formData.name.trim()} style={{ flex: 1 }}>
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// Create LOS Discount Modal
function CreateLosDiscountModal({ isOpen, onClose, onSubmit }: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CreateLosDiscountPayload) => Promise<boolean>;
}) {
    const [formData, setFormData] = useState<CreateLosDiscountPayload>({
        name: '',
        minNights: 2,
        discountType: 'PERCENTAGE',
        discountValue: 10,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const success = await onSubmit(formData);
        setIsSubmitting(false);
        if (success) {
            setFormData({ name: '', minNights: 2, discountType: 'PERCENTAGE', discountValue: 10 });
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create LOS Discount">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Name *
                    </label>
                    <Input
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Weekly Stay Discount"
                        required
                    />
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                            Min Nights *
                        </label>
                        <Input
                            type="number"
                            value={formData.minNights}
                            onChange={e => setFormData({ ...formData, minNights: parseInt(e.target.value) || 1 })}
                            min={1}
                            required
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                            Max Nights
                        </label>
                        <Input
                            type="number"
                            value={formData.maxNights ?? ''}
                            onChange={e => {
                                const val = e.target.value ? parseInt(e.target.value) : undefined;
                                setFormData({ ...formData, maxNights: val });
                            }}
                            placeholder="No limit"
                            min={formData.minNights}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <div style={{ flex: 1 }}>
                        <Select
                            label="Discount Type"
                            value={formData.discountType}
                            onChange={e => setFormData({ ...formData, discountType: e.target.value as 'PERCENTAGE' | 'FLAT' })}
                            fullWidth
                            options={[
                                { value: 'PERCENTAGE', label: 'Percentage' },
                                { value: 'FLAT', label: 'Flat Amount' },
                            ]}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                            Value {formData.discountType === 'PERCENTAGE' ? '(%)' : '(Rs )'}
                        </label>
                        <Input
                            type="number"
                            value={formData.discountValue}
                            onChange={e => setFormData({ ...formData, discountValue: parseFloat(e.target.value) || 0 })}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <div style={{ flex: 1 }}>
                        <CustomDatePicker
                            label="Start Date"
                            selected={formData.startDate ? new Date(formData.startDate) : null}
                            onChange={date => setFormData({ ...formData, startDate: date ? date.toISOString().split('T')[0] : '' })}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <CustomDatePicker
                            label="End Date"
                            selected={formData.endDate ? new Date(formData.endDate) : null}
                            onChange={date => setFormData({ ...formData, endDate: date ? date.toISOString().split('T')[0] : '' })}
                            minDate={formData.startDate ? new Date(formData.startDate) : undefined}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting || !formData.name.trim()} style={{ flex: 1 }}>
                        {isSubmitting ? 'Creating...' : 'Create LOS Discount'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// Edit LOS Discount Modal
function EditLosDiscountModal({ isOpen, onClose, rule, onSubmit }: {
    isOpen: boolean;
    onClose: () => void;
    rule: LosDiscount | null;
    onSubmit: (id: number, data: Partial<CreateLosDiscountPayload>) => Promise<boolean>;
}) {
    const [formData, setFormData] = useState<CreateLosDiscountPayload>({
        name: '',
        minNights: 2,
        discountType: 'PERCENTAGE',
        discountValue: 10,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (rule) {
            setFormData({
                name: rule.name,
                minNights: rule.minNights,
                maxNights: rule.maxNights,
                discountType: rule.discountType,
                discountValue: rule.discountValue,
                startDate: rule.startDate,
                endDate: rule.endDate,
            });
        }
    }, [rule]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rule) return;
        setIsSubmitting(true);
        const success = await onSubmit(rule.id, formData);
        setIsSubmitting(false);
        if (success) onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit LOS Discount">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Name *
                    </label>
                    <Input
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Weekly Stay Discount"
                        required
                    />
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                            Min Nights *
                        </label>
                        <Input
                            type="number"
                            value={formData.minNights}
                            onChange={e => setFormData({ ...formData, minNights: parseInt(e.target.value) || 1 })}
                            min={1}
                            required
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                            Max Nights
                        </label>
                        <Input
                            type="number"
                            value={formData.maxNights ?? ''}
                            onChange={e => {
                                const val = e.target.value ? parseInt(e.target.value) : undefined;
                                setFormData({ ...formData, maxNights: val });
                            }}
                            placeholder="No limit"
                            min={formData.minNights}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <div style={{ flex: 1 }}>
                        <Select
                            label="Discount Type"
                            value={formData.discountType}
                            onChange={e => setFormData({ ...formData, discountType: e.target.value as 'PERCENTAGE' | 'FLAT' })}
                            fullWidth
                            options={[
                                { value: 'PERCENTAGE', label: 'Percentage' },
                                { value: 'FLAT', label: 'Flat Amount' },
                            ]}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                            Value {formData.discountType === 'PERCENTAGE' ? '(%)' : '(Rs )'}
                        </label>
                        <Input
                            type="number"
                            value={formData.discountValue}
                            onChange={e => setFormData({ ...formData, discountValue: parseFloat(e.target.value) || 0 })}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <div style={{ flex: 1 }}>
                        <CustomDatePicker
                            label="Start Date"
                            selected={formData.startDate ? new Date(formData.startDate) : null}
                            onChange={date => setFormData({ ...formData, startDate: date ? date.toISOString().split('T')[0] : '' })}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <CustomDatePicker
                            label="End Date"
                            selected={formData.endDate ? new Date(formData.endDate) : null}
                            onChange={date => setFormData({ ...formData, endDate: date ? date.toISOString().split('T')[0] : '' })}
                            minDate={formData.startDate ? new Date(formData.startDate) : undefined}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting || !formData.name.trim()} style={{ flex: 1 }}>
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// Main Page
export default function RevenuePage() {
    const {
        pricingRules,
        discountRules,
        losDiscounts,
        isLoading,
        fetchPricingRules,
        fetchDiscountRules,
        fetchLosDiscounts,
        createPricingRule,
        updatePricingRule,
        deletePricingRule,
        createDiscountRule,
        updateDiscountRule,
        deleteDiscountRule,
        createLosDiscount,
        updateLosDiscount,
        deleteLosDiscount,
    } = useRevenue();

    const [activeTab, setActiveTab] = useState('analytics');
    const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
    const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
    const [isLosModalOpen, setIsLosModalOpen] = useState(false);

    const [editingPricingRule, setEditingPricingRule] = useState<PricingRule | null>(null);
    const [editingDiscountRule, setEditingDiscountRule] = useState<DiscountRule | null>(null);
    const [editingLosDiscount, setEditingLosDiscount] = useState<LosDiscount | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{ type: 'pricing' | 'discount' | 'los'; id: number; name: string } | null>(null);

    useEffect(() => {
        fetchPricingRules();
        fetchDiscountRules();
        fetchLosDiscounts();
    }, [fetchPricingRules, fetchDiscountRules, fetchLosDiscounts]);

    const handleTogglePricingRule = async (rule: PricingRule) => {
        await updatePricingRule(rule.id, { isActive: !rule.isActive });
    };

    const handleToggleDiscountRule = async (rule: DiscountRule) => {
        await updateDiscountRule(rule.id, { isActive: !rule.isActive });
    };

    const handleToggleLosDiscount = async (rule: LosDiscount) => {
        await updateLosDiscount(rule.id, { isActive: !rule.isActive });
    };

    const handleAddRule = () => {
        if (activeTab === 'pricing') setIsPricingModalOpen(true);
        else if (activeTab === 'discounts') setIsDiscountModalOpen(true);
        else setIsLosModalOpen(true);
    };

    return (
        <>
        <div style={{ padding: 'var(--space-8)' }}>
                {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                        <div>
                            <h1 style={{
                                fontSize: '28px',
                                fontWeight: '600',
                                color: 'var(--notion-text)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-3)',
                            }}>
                                <TrendingUp size={28} />
                                Revenue Management
                            </h1>
                            <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: 'var(--space-1)' }}>
                                Dynamic pricing and discount rules
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                            {activeTab !== 'analytics' && (
                                <>
                                    <Button variant="secondary" onClick={() => { fetchPricingRules(); fetchDiscountRules(); fetchLosDiscounts(); }} disabled={isLoading}>
                                        <RefreshCw size={14} style={{ marginRight: '6px' }} />
                                        Refresh
                                    </Button>
                                    <Button onClick={handleAddRule}>
                                        <Plus size={14} style={{ marginRight: '6px' }} />
                                        Add Rule
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Stats */}
                    <div style={{ display: 'flex', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-text)' }}>
                                {pricingRules.filter(r => r.isActive).length}
                            </span>
                            <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Active Pricing Rules</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-orange)' }}>
                                {discountRules.filter(r => r.isActive).length}
                            </span>
                            <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Active Discounts</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-blue)' }}>
                                {losDiscounts.filter(r => r.isActive).length}
                            </span>
                            <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Active LOS Discounts</span>
                        </div>
                    </div>

                    {/* Tabs */}
                    <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

                    {/* Analytics */}
                    {activeTab === 'analytics' && <AnalyticsTab />}

                    {/* Pricing Rules */}
                    {activeTab === 'pricing' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
                            {isLoading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} style={{
                                        height: '140px',
                                        backgroundColor: 'var(--notion-bg-secondary)',
                                        borderRadius: 'var(--radius-lg)',
                                        animation: 'pulse 1.5s ease-in-out infinite',
                                    }} />
                                ))
                            ) : pricingRules.length === 0 ? (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-12)', color: 'var(--notion-text-secondary)' }}>
                                    <TrendingUp size={48} style={{ opacity: 0.3, marginBottom: 'var(--space-4)' }} />
                                    <p>No pricing rules yet</p>
                                    <Button onClick={() => setIsPricingModalOpen(true)} style={{ marginTop: 'var(--space-4)' }}>
                                        Create Your First Rule
                                    </Button>
                                </div>
                            ) : (
                                pricingRules.map(rule => (
                                    <PricingRuleCard
                                        key={rule.id}
                                        rule={rule}
                                        onToggle={() => handleTogglePricingRule(rule)}
                                        onDelete={() => setDeleteTarget({ type: 'pricing', id: rule.id, name: rule.name })}
                                        onEdit={() => setEditingPricingRule(rule)}
                                    />
                                ))
                            )}
                        </div>
                    )}

                    {/* Discount Rules */}
                    {activeTab === 'discounts' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
                            {isLoading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} style={{
                                        height: '140px',
                                        backgroundColor: 'var(--notion-bg-secondary)',
                                        borderRadius: 'var(--radius-lg)',
                                        animation: 'pulse 1.5s ease-in-out infinite',
                                    }} />
                                ))
                            ) : discountRules.length === 0 ? (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-12)', color: 'var(--notion-text-secondary)' }}>
                                    <Tag size={48} style={{ opacity: 0.3, marginBottom: 'var(--space-4)' }} />
                                    <p>No discount rules yet</p>
                                    <Button onClick={() => setIsDiscountModalOpen(true)} style={{ marginTop: 'var(--space-4)' }}>
                                        Create Your First Discount
                                    </Button>
                                </div>
                            ) : (
                                discountRules.map(rule => (
                                    <DiscountRuleCard
                                        key={rule.id}
                                        rule={rule}
                                        onToggle={() => handleToggleDiscountRule(rule)}
                                        onDelete={() => setDeleteTarget({ type: 'discount', id: rule.id, name: rule.name })}
                                        onEdit={() => setEditingDiscountRule(rule)}
                                    />
                                ))
                            )}
                        </div>
                    )}

                    {/* LOS Discounts */}
                    {activeTab === 'los' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
                            {isLoading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} style={{
                                        height: '140px',
                                        backgroundColor: 'var(--notion-bg-secondary)',
                                        borderRadius: 'var(--radius-lg)',
                                        animation: 'pulse 1.5s ease-in-out infinite',
                                    }} />
                                ))
                            ) : losDiscounts.length === 0 ? (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-12)', color: 'var(--notion-text-secondary)' }}>
                                    <Moon size={48} style={{ opacity: 0.3, marginBottom: 'var(--space-4)' }} />
                                    <p>No length-of-stay discounts yet</p>
                                    <Button onClick={() => setIsLosModalOpen(true)} style={{ marginTop: 'var(--space-4)' }}>
                                        Create Your First LOS Discount
                                    </Button>
                                </div>
                            ) : (
                                losDiscounts.map(rule => (
                                    <LosDiscountCard
                                        key={rule.id}
                                        rule={rule}
                                        onToggle={() => handleToggleLosDiscount(rule)}
                                        onDelete={() => setDeleteTarget({ type: 'los', id: rule.id, name: rule.name })}
                                        onEdit={() => setEditingLosDiscount(rule)}
                                    />
                                ))
                            )}
                        </div>
                    )}
            </div>

            {/* Create Modals */}
            <CreatePricingRuleModal
                isOpen={isPricingModalOpen}
                onClose={() => setIsPricingModalOpen(false)}
                onSubmit={createPricingRule}
            />
            <CreateDiscountRuleModal
                isOpen={isDiscountModalOpen}
                onClose={() => setIsDiscountModalOpen(false)}
                onSubmit={createDiscountRule}
            />
            <CreateLosDiscountModal
                isOpen={isLosModalOpen}
                onClose={() => setIsLosModalOpen(false)}
                onSubmit={createLosDiscount}
            />

            {/* Edit Modals */}
            <EditPricingRuleModal
                isOpen={editingPricingRule !== null}
                onClose={() => setEditingPricingRule(null)}
                rule={editingPricingRule}
                onSubmit={updatePricingRule}
            />
            <EditDiscountRuleModal
                isOpen={editingDiscountRule !== null}
                onClose={() => setEditingDiscountRule(null)}
                rule={editingDiscountRule}
                onSubmit={updateDiscountRule}
            />
            <EditLosDiscountModal
                isOpen={editingLosDiscount !== null}
                onClose={() => setEditingLosDiscount(null)}
                rule={editingLosDiscount}
                onSubmit={updateLosDiscount}
            />

            {/* Delete Confirmation */}
            <SecurityConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={async () => {
                    if (!deleteTarget) return;
                    if (deleteTarget.type === 'pricing') await deletePricingRule(deleteTarget.id);
                    else if (deleteTarget.type === 'discount') await deleteDiscountRule(deleteTarget.id);
                    else await deleteLosDiscount(deleteTarget.id);
                }}
                title={`Delete ${deleteTarget?.type === 'pricing' ? 'Pricing Rule' : deleteTarget?.type === 'discount' ? 'Discount Rule' : 'LOS Discount'}`}
                message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
                confirmText="Delete Rule"
                isDestructive
            />
        </>
    );
}
