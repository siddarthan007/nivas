'use client';

import { useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { toLocalDateString } from "@/lib/utils/format";
import { useAuth } from '@/lib/contexts/AuthContext';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useAttendance, type AttendanceEntry } from '@/lib/hooks/useAttendance';
import DualDate from '@/components/ui/DualDate';
import { usePermissions } from '@/lib/hooks/usePermissions';
import CustomDatePicker from '@/components/ui/DatePicker';
import Modal from '@/components/ui/Modal';
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
    MoreVertical,
    Pencil,
    Eye,
    ChevronLeft,
    ChevronRight
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
                        <DualDate date={time} format="full" />
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                        {isClocked ? `Clocked in for ${elapsedTime}` : 'Not clocked in'}
                    </div>
                </div>
            </div>

            {/* Clock actions — both visible; inactive one disabled */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', minWidth: '280px' }}>
                <Button
                    variant="primary"
                    size="lg"
                    style={{ flex: 1, backgroundColor: isClocked ? undefined : 'var(--notion-green)' }}
                    onClick={onClockIn}
                    disabled={isLoading || isClocked}
                    icon={isLoading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                >
                    Clock In
                </Button>
                <Button
                    variant="danger"
                    size="lg"
                    style={{ flex: 1 }}
                    onClick={onClockOut}
                    disabled={isLoading || !isClocked}
                    icon={isLoading ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                >
                    Clock Out
                </Button>
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
    const { can } = usePermissions();
    const canApproveAttendance = can('users:update');
    const {
        entries, stats, currentEntry, isClocked, isLoading, error, refresh, clockIn, clockOut,
        historyEntries, isHistoryLoading, fetchHistory,
        staffSummary, isSummaryLoading, fetchStaffSummary,
        markAttendance, pendingApprovals, fetchPendingApprovals, approveEntry, rejectEntry,
    } = useAttendance();

    const [activeSubTab, setActiveSubTab] = useState<'today' | 'history'>('today');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterDept, setFilterDept] = useState('ALL');
    const [isClocking, setIsClocking] = useState(false);
    const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
    const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

    // History filters
    const [historySearch, setHistorySearch] = useState('');
    const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');
    const [historyDateFrom, setHistoryDateFrom] = useState('');
    const [historyDateTo, setHistoryDateTo] = useState('');

    // Staff summary modal
    const [summaryModalOpen, setSummaryModalOpen] = useState(false);
    const [summaryUserId, setSummaryUserId] = useState<string | null>(null);
    const [summaryMonth, setSummaryMonth] = useState(new Date().getMonth() + 1);
    const [summaryYear, setSummaryYear] = useState(new Date().getFullYear());

    useEffect(() => {
        if (canApproveAttendance) fetchPendingApprovals();
    }, [canApproveAttendance, fetchPendingApprovals]);

    const handleActionClick = useCallback((recordId: string, el: HTMLButtonElement) => {
        const rect = el.getBoundingClientRect();
        setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
        setOpenActionMenu(openActionMenu === recordId ? null : recordId);
    }, [openActionMenu]);

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

    const handleMark = async (record: AttendanceEntry, status: 'PRESENT' | 'ABSENT' | 'LATE') => {
        const today = new Date().toISOString().split('T')[0] || '';
        await markAttendance(record.staffId, today, status);
        setOpenActionMenu(null);
    };

    // History filtered data
    const filteredHistory = useMemo(() => {
        return historyEntries.filter(record => {
            const matchesSearch = (record.staffName || '').toLowerCase().includes(historySearch.toLowerCase());
            const matchesStatus = historyStatusFilter === 'ALL' || record.status === historyStatusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [historyEntries, historySearch, historyStatusFilter]);

    // Fetch history when tab/filters change
    useEffect(() => {
        if (activeSubTab === 'history') {
            const mineOnly = !can('analytics:view_staff_performance');
            fetchHistory(historyDateFrom || undefined, historyDateTo || undefined, undefined, mineOnly);
        }
    }, [activeSubTab, historyDateFrom, historyDateTo, fetchHistory, can]);

    // Fetch staff summary when modal opens
    useEffect(() => {
        if (summaryModalOpen && summaryUserId) {
            fetchStaffSummary(summaryUserId, summaryYear, summaryMonth);
        }
    }, [summaryModalOpen, summaryUserId, summaryYear, summaryMonth, fetchStaffSummary]);

    const openStaffSummary = (staffId: string) => {
        setSummaryUserId(staffId);
        setSummaryMonth(new Date().getMonth() + 1);
        setSummaryYear(new Date().getFullYear());
        setSummaryModalOpen(true);
    };

    const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

    return (
            <>
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

                    {can('users:update') && pendingApprovals.length > 0 && (
                        <div style={{
                            marginBottom: 'var(--space-6)',
                            padding: 'var(--space-4)',
                            backgroundColor: 'var(--notion-yellow-bg)',
                            border: '1px solid var(--notion-yellow)',
                            borderRadius: 'var(--radius-lg)',
                        }}>
                            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--notion-text)', marginBottom: 'var(--space-3)' }}>
                                Pending attendance approvals ({pendingApprovals.length})
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {pendingApprovals.map(entry => (
                                    <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, background: 'var(--notion-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)' }}>
                                        <UserAvatar name={entry.staffName} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--notion-text)' }}>{entry.staffName}</div>
                                            <div style={{ fontSize: 12, color: 'var(--notion-text-secondary)' }}>
                                                In {entry.clockIn ? new Date(entry.clockIn).toLocaleTimeString() : '—'}
                                                {entry.clockOut ? ` · Out ${new Date(entry.clockOut).toLocaleTimeString()}` : ''}
                                            </div>
                                        </div>
                                        <Button size="sm" variant="primary" onClick={() => approveEntry(entry.id)}>Approve</Button>
                                        <Button size="sm" variant="secondary" onClick={() => rejectEntry(entry.id, 'Rejected by manager')}>Reject</Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Sub Tabs */}
                    <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--notion-border)' }}>
                        <button
                            onClick={() => setActiveSubTab('today')}
                            style={{
                                padding: '8px 16px',
                                fontSize: '14px',
                                fontWeight: 500,
                                color: activeSubTab === 'today' ? 'var(--notion-text)' : 'var(--notion-text-secondary)',
                                borderBottom: activeSubTab === 'today' ? '2px solid var(--notion-blue)' : '2px solid transparent',
                                background: 'none',
                                border: 'none',
                                borderBottomWidth: '2px',
                                borderBottomStyle: 'solid',
                                borderBottomColor: activeSubTab === 'today' ? 'var(--notion-blue)' : 'transparent',
                                cursor: 'pointer',
                            }}
                        >
                            Today
                        </button>
                        <button
                            onClick={() => setActiveSubTab('history')}
                            style={{
                                padding: '8px 16px',
                                fontSize: '14px',
                                fontWeight: 500,
                                color: activeSubTab === 'history' ? 'var(--notion-text)' : 'var(--notion-text-secondary)',
                                background: 'none',
                                border: 'none',
                                borderBottomWidth: '2px',
                                borderBottomStyle: 'solid',
                                borderBottomColor: activeSubTab === 'history' ? 'var(--notion-blue)' : 'transparent',
                                cursor: 'pointer',
                            }}
                        >
                            History
                        </button>
                    </div>

                    {/* Today View */}
                    {activeSubTab === 'today' && (
                        <>
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
                                    options={departments.map(dept => ({ value: dept || '', label: dept || '' }))}
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
                                        <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Duration</th>
                                        <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Overtime</th>
                                        <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Status</th>
                                        <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={7} style={{ padding: '24px' }}>
                                                <TableSkeleton />
                                            </td>
                                        </tr>
                                    ) : filteredEntries.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} style={{ padding: '60px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>
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
                                                    <td style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--notion-text)' }}>
                                                        {record.duration ? `${Math.floor(record.duration / 60)}h ${record.duration % 60}m` : '--'}
                                                    </td>
                                                    <td style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--notion-text)' }}>
                                                        {record.overtime && record.overtime > 0 ? (
                                                            <span style={{ color: 'var(--notion-orange)', fontWeight: '500' }}>
                                                                {record.overtime.toFixed(1)}h
                                                            </span>
                                                        ) : '--'}
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
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            icon={<MoreVertical size={16} />}
                                                            onClick={(e) => handleActionClick(record.id, e.currentTarget as HTMLButtonElement)}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                {/* Fixed-position action menu dropdown — rendered outside table to escape overflow clipping */}
                {openActionMenu && menuPos && (
                    <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setOpenActionMenu(null)} />
                        <div style={{
                            position: 'fixed',
                            top: menuPos.top,
                            right: menuPos.right,
                            zIndex: 60,
                            backgroundColor: 'var(--notion-bg)',
                            border: '1px solid var(--notion-border)',
                            borderRadius: 'var(--radius-md)',
                            boxShadow: 'var(--shadow-popover)',
                            minWidth: '160px',
                            padding: '4px 0',
                        }}>
                            {(() => {
                                const record = filteredEntries.find(e => e.id === openActionMenu);
                                if (!record) return null;
                                return (
                                    <>
                                        <button onClick={() => { openStaffSummary(record.staffId); setOpenActionMenu(null); }} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '13px', color: 'var(--notion-text)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--notion-bg-hover)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}><Calendar size={14} /> View Calendar</button>
                                        {can('users:update') && (
                                            <>
                                                <button onClick={() => handleMark(record, 'PRESENT')} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '13px', color: 'var(--notion-text)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--notion-bg-hover)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}><CheckCircle2 size={14} /> Mark Present</button>
                                                <button onClick={() => handleMark(record, 'ABSENT')} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '13px', color: 'var(--notion-text)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--notion-bg-hover)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}><XCircle size={14} /> Mark Absent</button>
                                                <button onClick={() => handleMark(record, 'LATE')} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '13px', color: 'var(--notion-text)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--notion-bg-hover)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}><Clock size={14} /> Mark Late</button>
                                            </>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </>
                )}
                        </>
                    )}

                    {/* History View */}
                    {activeSubTab === 'history' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center', padding: 'var(--space-3)', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)' }}>
                                <div style={{ flex: 1, minWidth: '200px' }}>
                                    <Input type="text" placeholder="Search staff..." value={historySearch} onChange={e => setHistorySearch(e.target.value)} icon={<Search size={16} />} />
                                </div>
                                <Select value={historyStatusFilter} onChange={e => setHistoryStatusFilter(e.target.value)} options={[{ value: 'ALL', label: 'All Status' }, { value: 'PRESENT', label: 'Present' }, { value: 'ABSENT', label: 'Absent' }, { value: 'LATE', label: 'Late' }]} />
                                <CustomDatePicker selected={historyDateFrom ? new Date(historyDateFrom) : null} onChange={d => setHistoryDateFrom(toLocalDateString(d as Date))} placeholder="From" fullWidth={false} />
                                <CustomDatePicker selected={historyDateTo ? new Date(historyDateTo) : null} onChange={d => setHistoryDateTo(toLocalDateString(d as Date))} placeholder="To" fullWidth={false} />
                                <Button variant="secondary" onClick={() => { setHistorySearch(''); setHistoryStatusFilter('ALL'); setHistoryDateFrom(''); setHistoryDateTo(''); }}>Clear</Button>
                            </div>
                            <div style={{ backgroundColor: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead><tr style={{ backgroundColor: 'var(--notion-bg-secondary)', borderBottom: '1px solid var(--notion-border)' }}>
                                            <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Date</th>
                                            <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Staff</th>
                                            <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Dept</th>
                                            <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Clock In</th>
                                            <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Clock Out</th>
                                            <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Duration</th>
                                            <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Status</th>
                                            <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Action</th>
                                        </tr></thead>
                                        <tbody>
                                            {isHistoryLoading ? <tr><td colSpan={8} style={{ padding: '24px' }}><TableSkeleton /></td></tr>
                                            : filteredHistory.length === 0 ? <tr><td colSpan={8} style={{ padding: '60px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}><Users size={40} style={{ opacity: 0.2 }} /><div>No history records found</div></td></tr>
                                            : filteredHistory.map(record => {
                                                const statusStyle = getStatusStyle(record.status);
                                                const StatusIcon = statusStyle.icon;
                                                return (
                                                    <tr key={record.id} style={{ borderBottom: '1px solid var(--notion-divider)' }}>
                                                        <td style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--notion-text)' }}>{record.date}</td>
                                                        <td style={{ padding: '12px 20px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><UserAvatar name={record.staffName || 'Unknown'} /><div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--notion-text)' }}>{record.staffName || 'Unknown Staff'}</div></div></td>
                                                        <td style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--notion-text)' }}>{record.department || 'General'}</td>
                                                        <td style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--notion-text)' }}>{record.clockIn ? new Date(record.clockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</td>
                                                        <td style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--notion-text)' }}>{record.clockOut ? new Date(record.clockOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</td>
                                                        <td style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--notion-text)' }}>{record.duration ? `${Math.floor(record.duration / 60)}h ${record.duration % 60}m` : '-'}</td>
                                                        <td style={{ padding: '12px 20px' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', fontSize: '12px', fontWeight: '500', borderRadius: 'var(--radius-full)', backgroundColor: statusStyle.bg, color: statusStyle.text }}><StatusIcon size={12} />{record.status}</span></td>
                                                        <td style={{ padding: '12px 20px', textAlign: 'right' }}><Button variant="ghost" size="sm" icon={<Calendar size={16} />} onClick={() => openStaffSummary(record.staffId)} title="View calendar" /></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Staff Monthly Summary Modal */}
                    <Modal isOpen={summaryModalOpen} onClose={() => setSummaryModalOpen(false)} title={staffSummary ? `${staffSummary.staffName} — Attendance` : 'Staff Attendance'} size="xl">
                        {isSummaryLoading ? <div style={{ padding: '40px', textAlign: 'center' }}><Loader2 size={24} className="animate-spin" /></div>
                        : staffSummary && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: '14px', color: 'var(--notion-text-secondary)' }}>{staffSummary.department} &middot; {staffSummary.year}-{String(staffSummary.month).padStart(2, '0')}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                        <button onClick={() => { const d = new Date(staffSummary.year, staffSummary.month - 2); setSummaryMonth(d.getMonth() + 1); setSummaryYear(d.getFullYear()); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-text)', padding: '4px' }}><ChevronLeft size={18} /></button>
                                        <button onClick={() => { const d = new Date(staffSummary.year, staffSummary.month); setSummaryMonth(d.getMonth() + 1); setSummaryYear(d.getFullYear()); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-text)', padding: '4px' }}><ChevronRight size={18} /></button>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                        <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: '600', color: 'var(--notion-text-secondary)', padding: '6px' }}>{d}</div>
                                    ))}
                                    {(() => {
                                        const totalDays = daysInMonth(staffSummary.year, staffSummary.month);
                                        const firstDay = new Date(staffSummary.year, staffSummary.month - 1, 1).getDay();
                                        const cells: ReactNode[] = [];
                                        for (let i = 0; i < firstDay; i++) cells.push(<div key={`empty-${i}`} />);
                                        for (let day = 1; day <= totalDays; day++) {
                                            const dateStr = `${staffSummary.year}-${String(staffSummary.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                            const record = staffSummary.attendanceMap[dateStr];
                                            const isPresent = record?.status === 'PRESENT';
                                            const isAbsent = record?.status === 'ABSENT';
                                            cells.push(
                                                <div key={day} style={{ padding: '6px', textAlign: 'center', borderRadius: 'var(--radius-sm)', backgroundColor: isPresent ? 'var(--notion-green-bg)' : isAbsent ? 'var(--notion-red-bg)' : 'var(--notion-bg-secondary)', border: '1px solid var(--notion-border)', minHeight: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                                                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--notion-text)' }}>{day}</div>
                                                    {isPresent && <CheckCircle2 size={12} style={{ color: 'var(--notion-green)' }} />}
                                                    {isAbsent && <XCircle size={12} style={{ color: 'var(--notion-red)' }} />}
                                                </div>
                                            );
                                        }
                                        return cells;
                                    })()}
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: '13px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: 'var(--notion-green)' }} /><span>Present</span></div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: 'var(--notion-red)' }} /><span>Absent</span></div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: 'var(--notion-bg-secondary)', border: '1px solid var(--notion-border)' }} /><span>No Record</span></div>
                                </div>
                            </div>
                        )}
                    </Modal>
                </div>
            </>
    );
}
