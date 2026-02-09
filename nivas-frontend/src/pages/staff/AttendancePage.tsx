'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageContainer from '@/components/layout/PageContainer';
import Button from '@/components/ui/Button';
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
    Users
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

// Clock widget component
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
            padding: 'var(--space-6)',
            textAlign: 'center',
            boxShadow: 'var(--shadow-md)'
        }}>
            {/* Current Time */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ fontSize: '48px', fontWeight: '700', color: 'var(--notion-text)', fontFamily: 'monospace' }}>
                    {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                </div>
                <div style={{ fontSize: '14px', color: 'var(--notion-text-secondary)' }}>
                    {time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
            </div>

            {/* Status */}
            <div style={{
                padding: 'var(--space-3)',
                backgroundColor: isClocked ? 'var(--notion-green-bg)' : 'var(--notion-yellow-bg)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-4)'
            }}>
                <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: isClocked ? 'var(--notion-green)' : 'var(--notion-yellow)'
                }}>
                    {isClocked ? (
                        <>
                            <CheckCircle2 size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                            Clocked In • Working for {elapsedTime}
                        </>
                    ) : (
                        <>
                            <Clock size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                            Not Clocked In
                        </>
                    )}
                </div>
                {clockInTime && (
                    <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginTop: '4px' }}>
                        Clock-in time: {new Date(clockInTime).toLocaleTimeString()}
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            {isClocked ? (
                <Button
                    variant="danger"
                    size="lg"
                    style={{ width: '100%' }}
                    onClick={onClockOut}
                    disabled={isLoading}
                    icon={isLoading ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
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
                    icon={isLoading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
                >
                    Clock In
                </Button>
            )}
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
            gap: 'var(--space-3)'
        }}>
            <div style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: `${color}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <Icon size={20} color={color} />
            </div>
            <div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--notion-text)' }}>{value}</div>
                <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>{label}</div>
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
                <div style={{ padding: 'var(--space-6)' }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 'var(--space-6)',
                        flexWrap: 'wrap',
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
                                Track staff check-ins, check-outs, and attendance history
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

                    {/* Main Grid - responsive */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)' }}>
                        {/* Left Column - Clock Widget */}
                        <div style={{ maxWidth: '400px' }}> {/* Limit width for better alignment */}
                            <ClockWidget
                                isClocked={isClocked}
                                clockInTime={currentEntry?.clockIn || null}
                                onClockIn={handleClockIn}
                                onClockOut={handleClockOut}
                                isLoading={isClocking}
                            />
                        </div>

                        {/* Right Column - Stats & Table */}
                        <div style={{ flex: 1 }}>
                            {/* Stats Row - responsive */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                gap: 'var(--space-3)',
                                marginBottom: 'var(--space-6)'
                            }}>
                                <StatCard label="Present" value={stats.present} icon={CheckCircle2} color="var(--notion-green)" />
                                <StatCard label="Absent" value={stats.absent} icon={XCircle} color="var(--notion-red)" />
                                <StatCard label="Late" value={stats.late} icon={Clock} color="var(--notion-yellow)" />
                                <StatCard label="On Leave" value={stats.onLeave} icon={Calendar} color="var(--notion-blue)" />
                            </div>

                            {/* Filters */}
                            <div style={{
                                display: 'flex',
                                gap: 'var(--space-4)',
                                marginBottom: 'var(--space-4)',
                                flexWrap: 'wrap'
                            }}>
                                <div style={{ position: 'relative', flex: 1, minWidth: '200px', maxWidth: '300px' }}>
                                    <Search size={16} style={{
                                        position: 'absolute',
                                        left: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: 'var(--notion-text-secondary)'
                                    }} />
                                    <input
                                        type="text"
                                        placeholder="Search staff..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px 8px 36px',
                                            fontSize: '14px',
                                            border: '1px solid var(--notion-border)',
                                            borderRadius: 'var(--radius-md)',
                                            backgroundColor: 'var(--notion-bg)',
                                            color: 'var(--notion-text)',
                                            outline: 'none'
                                        }}
                                    />
                                </div>

                                <div style={{ position: 'relative' }}>
                                    <Filter size={16} style={{
                                        position: 'absolute',
                                        left: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: 'var(--notion-text-secondary)'
                                    }} />
                                    <select
                                        value={filterDept}
                                        onChange={e => setFilterDept(e.target.value)}
                                        style={{
                                            padding: '8px 12px 8px 36px',
                                            fontSize: '14px',
                                            border: '1px solid var(--notion-border)',
                                            borderRadius: 'var(--radius-md)',
                                            backgroundColor: 'var(--notion-bg)',
                                            color: 'var(--notion-text)',
                                            outline: 'none',
                                            cursor: 'pointer',
                                            appearance: 'none',
                                            paddingRight: '32px'
                                        }}
                                    >
                                        {departments.map(dept => (
                                            <option key={dept} value={dept}>{dept}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Table */}
                            <div style={{
                                backgroundColor: 'var(--notion-bg)',
                                border: '1px solid var(--notion-border)',
                                borderRadius: 'var(--radius-lg)',
                                overflow: 'hidden'
                            }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: 'var(--notion-bg-secondary)', borderBottom: '1px solid var(--notion-border)' }}>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Staff</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Department</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Clock In</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Clock Out</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {isLoading ? (
                                            <tr>
                                                <td colSpan={5} style={{ padding: '20px' }}>
                                                    <TableSkeleton />
                                                </td>
                                            </tr>
                                        ) : filteredEntries.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>
                                                    <Users size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                                                    <div>No attendance records found</div>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredEntries.map(record => {
                                                const statusStyle = getStatusStyle(record.status);
                                                const StatusIcon = statusStyle.icon;
                                                return (
                                                    <tr key={record.id} style={{ borderBottom: '1px solid var(--notion-divider)' }}>
                                                        <td style={{ padding: '12px 16px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                <UserAvatar name={record.staffName || 'Unknown'} />
                                                                <span style={{ fontSize: '14px', fontWeight: '500' }}>
                                                                    {record.staffName || 'Unknown Staff'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                                            {record.department || '-'}
                                                        </td>
                                                        <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                                                            {record.clockIn ? new Date(record.clockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                        </td>
                                                        <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                                                            {record.clockOut ? new Date(record.clockOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                        </td>
                                                        <td style={{ padding: '12px 16px' }}>
                                                            <span style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                                padding: '4px 10px',
                                                                fontSize: '11px',
                                                                fontWeight: '600',
                                                                borderRadius: 'var(--radius-full)',
                                                                backgroundColor: statusStyle.bg,
                                                                color: statusStyle.text
                                                            }}>
                                                                <StatusIcon size={12} />
                                                                {record.status}
                                                            </span>
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
                </div>
            </PageContainer>
        </DashboardLayout>
    );
}
