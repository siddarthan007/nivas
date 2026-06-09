import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface RevenueChartProps {
    data: Array<{ name: string; value: number }>;
}

export default function RevenueChart({ data }: RevenueChartProps) {
    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-4)',
            height: '300px',
            width: '100%',
            minWidth: 0 // Prevent flex/grid overflow issues
        }}>
            <h3 style={{
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--notion-text)',
                marginBottom: 'var(--space-4)'
            }}>
                Revenue Growth
            </h3>
            <div style={{ width: '100%', height: 'calc(100% - 32px)' }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                    <AreaChart
                        data={data}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--notion-blue)" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="var(--notion-blue)" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--notion-border)" />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--notion-text-secondary)', fontSize: 12 }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--notion-text-secondary)', fontSize: 12 }}
                            tickFormatter={(value) => `Rs ${value}`}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'var(--notion-bg-tertiary)',
                                border: '1px solid var(--notion-border)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--notion-text)'
                            }}
                            itemStyle={{ color: 'var(--notion-text)' }}
                            labelStyle={{ color: 'var(--notion-text-secondary)' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke="var(--notion-blue)"
                            fillOpacity={1}
                            fill="url(#colorRevenue)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
