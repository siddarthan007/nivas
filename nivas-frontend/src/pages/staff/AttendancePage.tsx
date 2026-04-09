'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageContainer from '@/components/layout/PageContainer';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useAttendance, type AttendanceEntry } from '@/lib/hooks/useAttendance';
import {
    Clock,
    Timer,
    CheckCircle2,
    XCircle,
    Calendar,
    LogIn,
    LogOut,
    Search,
    Filter,
    RefreshCw,
    Loader2,
    Users,
    MoreVertical
} from 'lucide-react';

// Status badge helper
const getStatusStyle = (status: string) => {
    switch (status) {
        case 'PRESENT': return { bg: 'var(--notion-green-bg)', text: 'var(--notion-green)', icon: CheckCircle2 };
        case 'ABSENT': return { bg: 'var(--notion-red-bg)', text: 'var(--notion-red)', icon: XCircle };
        case 'LATE': return { bg: 'var(--notion-yellow-bg)', text: 'var(--notion-yellow)', icon: Clock };
        case 'LEAVE':
        case 'ON_LEAVE': return { bg: 'var(--notion-blue-bg)', text: 'var(--notion-blue)', icon: Calendar };
        default: return { bg: 'var(--notion-gray-bg)', text: 'var(--notion-text-secondary)', icon: Clock };
    }
};

// Format elapsed time
const formatElapsedTime = (startTime: string): string => {
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const hours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}h ${mins}m`;
};

// Compact Horizontal Clock Widget
function ClockWidget({ isClocked, clockInTime, onClockIn, onClockOut, isLoading }: {
    isClocked: boolean;
    clockInTime: string | null;
    onClockIn: () => void;
    onClockOut: () => void;
    isLoading: boolean;
}) {
    const [time, setTime] = useState(new Date());
    const [elapsedTime, setElapsedTime] = useState('0h 0m');

    useEffect(() => {
        const interval = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    // Update elapsed time
    useEffect(() => {
        if (!isClocked || !clockInTime) {
            setElapsedTime('0h 0m');
            return;
        }

        const updateElapsed = () => setElapsedTime(formatElapsedTime(clockInTime));
        updateElapsed();
        const interval = setInterval(updateElapsed, 60000);
        return () => clearInterval(interval);
    }, [isClocked, clockInTime]);

    return (
        <div style={{
            backgroundColor: 'var(--notion-bg)',
            border: '1px solid var(--notion-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-4)',
            flexWrap: 'wrap'
        }}>
            {/* Time Display */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <div style={{
                    backgroundColor: 'var(--notion-bg-secondary)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--notion-border)'
                }}>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--notion-text)', fontFamily: 'monospace', lineHeight: 1 }}>
                        {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--notion-text)' }}>
                        {time.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                        {isClocked ? `Clocked in for ${elapsedTime}` : 'Not clocked in'}
                    </div>
                </div>
            </div>

            {/* Action Button */}
            <div style={{ minWidth: '140px' }}>
                {isClocked ? (
                    <Button
                        variant="danger"
                        size="lg"
                        style={{ width: '100%' }}
                        onClick={onClockOut}
                        disabled={isLoading}
                        icon={isLoading ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                    >
                        Clock Out
                    </Button>
                ) : (
                    <Button
                        variant="primary"
                        size="lg"
                        style={{ width: '100%', backgroundColor: 'var(--notion-green)' }}
                        onClick={onClockIn}
                        disabled={isLoading}
                        icon={isLoading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                    >
                        Clock In
                    </Button>
                )}
            </div>
        </div>
    );
}

// Stats card
function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: any; color: string }) {
    return (
        <div style={{
            backgroundColor: 'var(--notion-bg)',
            border: '1px solid var(--notion-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            boxShadow: 'var(--shadow-sm)'
        }}>
            <div style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: `${color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <Icon size={18} color={color} />
            </div>
            <div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--notion-text)' }}>{value}</div>
                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>{label}</div>
            </div>
        </div>
    );
}

// Loading skeleton for table
function TableSkeleton() {
    return (
        <div style={{ opacity: 0.6 }}>
            {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{
                    height: '48px',
                    backgroundColor: 'var(--notion-bg-secondary)',
                    marginBottom: '8px',
                    borderRadius: 'var(--radius-sm)',
                    animation: 'pulse 2s infinite'
                }} />
            ))}
        </div>
    );
}

// Avatar helper
const getInitials = (name: string | null | undefined) => {
    return (name || 'U')
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
};

function UserAvatar({ name }: { name: string }) {
    const initials = getInitials(name);
    return (
        <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'var(--notion-bg-secondary)',
            color: 'var(--notion-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: '600',
            border: '1px solid var(--notion-border)'
        }}>
            {initials}
        </div>
    );
}

export default function AttendancePage() {
    const { user } = useAuth();
    const { entries, stats, currentEntry, isClocked, isLoading, error, refresh, clockIn, clockOut } = useAttendance();

    const [searchQuery, setSearchQuery] = useState('');
    const [filterDept, setFilterDept] = useState('ALL');
    const [isClocking, setIsClocking] = useState(false);

    // Departments from entries
    const departments = useMemo(
        () => ['ALL', ...Array.from(new Set(entries.map(a => a.department).filter(Boolean)))],
        [entries]
    );

    // Filtered records
    const filteredEntries = useMemo(() => {
        return entries.filter(record => {
            const matchesSearch = (record.staffName || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchesDept = filterDept === 'ALL' || record.department === filterDept;
            return matchesSearch && matchesDept;
        });
    }, [entries, searchQuery, filterDept]);

    const handleClockIn = async () => {
        setIsClocking(true);
        await clockIn();
        setIsClocking(false);
    };

    const handleClockOut = async () => {
        setIsClocking(true);
        await clockOut();
        setIsClocking(false);
    };

    return (
        <DashboardLayout>
            <PageContainer>
                <div style={{ padding: 'var(--space-6)', maxWidth: '1200px', margin: '0 auto' }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 'var(--space-6)',
                        gap: 'var(--space-3)'
                    }}>
                        <div>
                            <h1 style={{
                                fontSize: '24px',
                                fontWeight: '600',
                                color: 'var(--notion-text)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-2)'
                            }}>
                                <Timer size={24} />
                                Staff Attendance
                            </h1>
                            <p style={{ color: 'var(--notion-text-secondary)', fontSize: '14px' }}>
                                Manage daily staff attendance and shifts
                            </p>
                        </div>
                        <Button
                            variant="secondary"
                            onClick={refresh}
                            disabled={isLoading}
                            icon={isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        >
                            Refresh
                        </Button>
                    </div>

                    {/* Error State */}
                    {error && (
                        <div style={{
                            padding: 'var(--space-4)',
                            backgroundColor: 'var(--notion-red-bg)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--notion-red)',
                            marginBottom: 'var(--space-4)'
                        }}>
                            {error}
                        </div>
                    )}

                    {/* Top Row: Clock & Stats */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                        {/* Clock Widget */}
                        <ClockWidget
                            isClocked={isClocked}
                            clockInTime={currentEntry?.clockIn || null}
                            onClockIn={handleClockIn}
                            onClockOut={handleClockOut}
                            isLoading={isClocking}
                        />

                        {/* Quick Stats - 1x4 horizontal row */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
                            <StatCard label="Present" value={stats.present} icon={CheckCircle2} color="var(--notion-green)" />
                            <StatCard label="Absent" value={stats.absent} icon={XCircle} color="var(--notion-red)" />
                            <StatCard label="Late" value={stats.late} icon={Clock} color="var(--notion-yellow)" />
                            <StatCard label="On Leave" value={stats.onLeave} icon={Calendar} color="var(--notion-blue)" />
                        </div>
                    </div>

                    {/* Table Section */}
                    <div style={{
                        backgroundColor: 'var(--notion-bg)',
                        border: '1px solid var(--notion-border)',
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden' // contain children
                    }}>
                        {/* Filters Bar */}
                        <div style={{
                            padding: 'var(--space-4)',
                            borderBottom: '1px solid var(--notion-border)',
                            display: 'flex',
                            gap: 'var(--space-3)',
                            flexWrap: 'wrap',
                            alignItems: 'center'
                        }}>
                            <div style={{ flex: 1, minWidth: '200px' }}>
                                <Input
                                    type="text"
                                    placeholder="Search staff..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    icon={<Search size={16} />}
                                />
                            </div>

                            <div style={{ position: 'relative', minWidth: '150px' }}>
                                <Filter size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-secondary)' }} />
                                <Select
                                    value={filterDept}
                                    onChange={e => setFilterDept(e.target.value)}
                                    options={departments.map(dept => ({ value: dept, label: dept }))}
                                    fullWidth
                                />
                            </div>
                        </div>

                        {/* Full Width Table */}
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ backgroundColor: 'var(--notion-bg-secondary)', borderBottom: '1px solid var(--notion-border)' }}>
                                        <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Staff Member</th>
                                        <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Department</th>
                                        <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Clock In / Out</th>
                                        <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Status</th>
                                        <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={5} style={{ padding: '24px' }}>
                                                <TableSkeleton />
                                            </td>
                                        </tr>
                                    ) : filteredEntries.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} style={{ padding: '60px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                    <Users size={40} style={{ opacity: 0.2 }} />
                                                    <span>No attendance records found</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredEntries.map(record => {
                                            const statusStyle = getStatusStyle(record.status);
                                            const StatusIcon = statusStyle.icon;
                                            return (
                                                <tr key={record.id} style={{ borderBottom: '1px solid var(--notion-divider)' }}>
                                                    <td style={{ padding: '12px 20px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <UserAvatar name={record.staffName || 'Unknown'} />
                                                            <div>
                                                                <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--notion-text)' }}>
                                                                    {record.staffName || 'Unknown Staff'}
                                                                </div>
                                                                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                                                                    ID: {record.id.toString().slice(0, 6)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px 20px', fontSize: '14px', color: 'var(--notion-text)' }}>
                                                        <span style={{
                                                            padding: '2px 8px',
                                                            backgroundColor: 'var(--notion-bg-secondary)',
                                                            borderRadius: '4px',
                                                            fontSize: '12px',
                                                            border: '1px solid var(--notion-border)'
                                                        }}>
                                                            {record.department || 'General'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px 20px' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '13px' }}>
                                                            {record.clockIn ? (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--notion-green)' }}>
                                                                    <LogIn size={12} />
                                                                    {new Date(record.clockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                            ) : <span style={{ color: 'var(--notion-text-tertiary)' }}>--:--</span>}

                                                            {record.clockOut ? (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--notion-red)' }}>
                                                                    <LogOut size={12} />
                                                                    {new Date(record.clockOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                            ) : <span style={{ color: 'var(--notion-text-tertiary)' }}>--:--</span>}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px 20px' }}>
                                                        <span style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            padding: '4px 10px',
                                                            fontSize: '12px',
                                                            fontWeight: '500',
                                                            borderRadius: 'var(--radius-full)',
                                                            backgroundColor: statusStyle.bg,
                                                            color: statusStyle.text,
                                                            border: `1px solid ${statusStyle.bg}` // slightly darker border check if needed
                                                        }}>
                                                            <StatusIcon size={12} />
                                                            {record.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                                                        <Button variant="ghost" size="sm" icon={<MoreVertical size={16} />} />
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </PageContainer>
        </DashboardLayout>
    );
}
