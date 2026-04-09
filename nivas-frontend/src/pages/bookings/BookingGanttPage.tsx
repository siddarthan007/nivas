'use client';

import { useState, useEffect, useMemo } from 'react';
import { useBookings } from '@/lib/hooks/useBookings';
import { useLayout } from '@/lib/hooks/useLayout';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import Button from '@/components/ui/Button';
import DashboardLayout from '@/components/layout/DashboardLayout';

// Date Helpers (Native)
const startOfDay = (d: Date) => {
    const newDate = new Date(d);
    newDate.setHours(0, 0, 0, 0);
    return newDate;
};

const addDays = (d: Date, days: number) => {
    const newDate = new Date(d);
    newDate.setDate(newDate.getDate() + days);
    return newDate;
};

const format = (d: Date, formatStr: string) => {
    // Simple formatter for required formats
    // 'MMM d': Jan 1
    // 'MMM d, yyyy': Jan 1, 2026
    // 'EEE': Mon
    // 'd': 1
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    if (formatStr === 'MMM d') return `${months[d.getMonth()]} ${d.getDate()}`;
    if (formatStr === 'MMM d, yyyy') return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    if (formatStr === 'EEE') return days[d.getDay()];
    if (formatStr === 'd') return d.getDate().toString();
    return d.toDateString();
};

const differenceInDays = (d1: Date, d2: Date) => {
    const t1 = startOfDay(d1).getTime();
    const t2 = startOfDay(d2).getTime();
    return Math.round((t1 - t2) / (1000 * 3600 * 24));
};

export default function BookingGanttPage() {
    const { bookings, fetchBookings, isLoading: isBookingsLoading } = useBookings();
    const { rooms, fetchVisualData, isLoading: isRoomsLoading } = useLayout();

    // View state
    const [startDate, setStartDate] = useState(startOfDay(new Date()));
    type ViewMode = '7' | '14' | '30';
    const [viewMode, setViewMode] = useState<ViewMode>('14');
    const daysToShow = parseInt(viewMode);

    useEffect(() => {
        // Fetch data
        fetchBookings({ limit: 100 }); // Get recent bookings
        fetchVisualData(); // Get rooms
    }, [fetchBookings, fetchVisualData]);

    const endDate = addDays(startDate, daysToShow);

    // Generate dates for header
    const dates = useMemo(() => {
        const result = [];
        for (let i = 0; i < daysToShow; i++) {
            result.push(addDays(startDate, i));
        }
        return result;
    }, [startDate, daysToShow]);

    // Process bookings for Gantt
    // Map booking to (room, start, span) relative to view window
    const roomRows = useMemo(() => {
        if (!rooms.length) return [];

        // Sort rooms by number
        const sortedRooms = [...rooms].sort((a, b) => a.number - b.number);

        return sortedRooms.map(room => {
            const roomBookings = bookings.filter(b => b.roomId === room.id);

            // Calculate positions
            const bars = roomBookings.map(booking => {
                const checkIn = new Date(booking.checkIn);
                const checkOut = new Date(booking.checkOut);

                // Intersect with view window
                const effectiveStart = checkIn < startDate ? startDate : checkIn;
                const effectiveEnd = checkOut > endDate ? endDate : checkOut;

                if (effectiveEnd <= effectiveStart) return null; // Outside view

                const offsetDays = differenceInDays(effectiveStart, startDate);
                const durationDays = differenceInDays(effectiveEnd, effectiveStart);

                return {
                    id: booking.id,
                    booking,
                    left: offsetDays,
                    width: durationDays
                };
            }).filter(Boolean) as { id: string, booking: any, left: number, width: number }[];

            return {
                room,
                bars
            };
        });
    }, [rooms, bookings, startDate, endDate]);

    const handlePrev = () => setStartDate(prev => addDays(prev, -7));
    const handleNext = () => setStartDate(prev => addDays(prev, 7));
    const handleToday = () => setStartDate(startOfDay(new Date()));

    const isLoading = isBookingsLoading || isRoomsLoading;

    if (isLoading && rooms.length === 0) return <div>Loading timeline...</div>;

    const cellWidth = 100; // px
    const sidebarWidth = 150; // px

    return (
        <DashboardLayout>
            <div style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--notion-text)' }}>Booking Schedule</h1>
                        <p style={{ color: 'var(--notion-text-secondary)', fontSize: '14px' }}>
                            Timeline view of room occupancies.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        {/* View Mode Toggle */}
                        <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--notion-bg-secondary)', padding: '3px', borderRadius: '6px' }}>
                            {(['7', '14', '30'] as ViewMode[]).map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setViewMode(mode)}
                                    style={{
                                        padding: '4px 10px',
                                        fontSize: '12px',
                                        fontWeight: 500,
                                        borderRadius: '4px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        backgroundColor: viewMode === mode ? 'var(--notion-blue)' : 'transparent',
                                        color: viewMode === mode ? 'white' : 'var(--notion-text-secondary)',
                                    }}
                                >
                                    {mode}D
                                </button>
                            ))}
                        </div>
                        <Button variant="secondary" onClick={handlePrev} size="sm"><ChevronLeft size={16} /></Button>
                        <Button variant="secondary" onClick={handleToday} size="sm">Today</Button>
                        <Button variant="secondary" onClick={handleNext} size="sm"><ChevronRight size={16} /></Button>
                        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--notion-text)' }}>
                            {format(startDate, 'MMM d')} - {format(addDays(startDate, daysToShow - 1), 'MMM d, yyyy')}
                        </span>
                    </div>
                </div>

                <div style={{
                    border: '1px solid var(--notion-border)',
                    borderRadius: '8px',
                    overflow: 'auto',
                    backgroundColor: 'var(--notion-bg)',
                    flex: 1,
                }}>
                    {/* Single scrollable table so header and body columns stay aligned */}
                    <div style={{ minWidth: `${sidebarWidth + dates.length * cellWidth}px` }}>
                        {/* Header Row */}
                        <div style={{
                            display: 'flex',
                            borderBottom: '1px solid var(--notion-border)',
                            backgroundColor: 'var(--notion-bg-secondary)',
                            position: 'sticky',
                            top: 0,
                            zIndex: 20,
                        }}>
                            <div style={{
                                width: `${sidebarWidth}px`,
                                minWidth: `${sidebarWidth}px`,
                                padding: '12px',
                                fontWeight: 600,
                                borderRight: '1px solid var(--notion-border)',
                                position: 'sticky',
                                left: 0,
                                backgroundColor: 'var(--notion-bg-secondary)',
                                zIndex: 25,
                            }}>
                                Room
                            </div>
                            {dates.map((date, i) => (
                                <div key={i} style={{
                                    width: `${cellWidth}px`,
                                    minWidth: `${cellWidth}px`,
                                    padding: '12px',
                                    textAlign: 'center',
                                    borderRight: '1px solid var(--notion-border)',
                                    fontSize: '13px',
                                    fontWeight: 500,
                                }}>
                                    <div>{format(date, 'EEE')}</div>
                                    <div style={{ color: 'var(--notion-text-secondary)' }}>{format(date, 'd')}</div>
                                </div>
                            ))}
                        </div>

                        {/* Body Rows */}
                        {roomRows.map((row) => (
                            <div key={row.room.id} style={{
                                display: 'flex',
                                borderBottom: '1px solid var(--notion-border)',
                                height: '60px',
                                position: 'relative',
                            }}>
                                {/* Room Sidebar Cell - sticky left */}
                                <div style={{
                                    width: `${sidebarWidth}px`,
                                    minWidth: `${sidebarWidth}px`,
                                    padding: '12px',
                                    borderRight: '1px solid var(--notion-border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    position: 'sticky',
                                    left: 0,
                                    backgroundColor: 'var(--notion-bg)',
                                    zIndex: 10,
                                    fontWeight: 500,
                                }}>
                                    <span>{row.room.number}</span>
                                    <span style={{
                                        fontSize: '11px',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        backgroundColor: 'var(--notion-bg-hover)',
                                    }}>
                                        {(row.room.type || '').slice(0, 3).toUpperCase()}
                                    </span>
                                </div>

                                {/* Date Grid Cells */}
                                {dates.map((_, i) => (
                                    <div key={i} style={{
                                        width: `${cellWidth}px`,
                                        minWidth: `${cellWidth}px`,
                                        borderRight: '1px solid var(--notion-border)',
                                    }} />
                                ))}

                                {/* Booking Bars (overlay) */}
                                <div style={{
                                    position: 'absolute',
                                    left: `${sidebarWidth}px`,
                                    right: 0,
                                    top: 0,
                                    bottom: 0,
                                    zIndex: 5,
                                    pointerEvents: 'none',
                                }}>
                                    {row.bars.map(bar => {
                                        const statusColors: Record<string, string> = {
                                            'CHECKED_IN': 'var(--notion-blue)',
                                            'CONFIRMED': 'var(--notion-green)',
                                            'CHECKED_OUT': '#6B7280',
                                            'CANCELLED': '#9CA3AF',
                                            'NO_SHOW': 'var(--notion-red)',
                                        };
                                        const isCancelledOrOut = bar.booking.status === 'CANCELLED' || bar.booking.status === 'CHECKED_OUT';
                                        const barColor = statusColors[bar.booking.status] || 'var(--notion-orange)';
                                        const barWidth = Math.max(bar.width * cellWidth - 8, cellWidth - 8);
                                        const sourceLabel = bar.booking.source === 'OTA' ? 'OTA' : bar.booking.source === 'PHONE' ? 'Ph' : '';

                                        return (
                                            <div
                                                key={bar.id}
                                                style={{
                                                    position: 'absolute',
                                                    left: `${bar.left * cellWidth + 4}px`,
                                                    width: `${barWidth}px`,
                                                    top: isCancelledOrOut ? '10px' : '6px',
                                                    bottom: isCancelledOrOut ? '10px' : '6px',
                                                    backgroundColor: barColor,
                                                    borderRadius: '6px',
                                                    padding: '4px 8px',
                                                    fontSize: '11px',
                                                    color: 'white',
                                                    overflow: 'hidden',
                                                    whiteSpace: 'nowrap',
                                                    textOverflow: 'ellipsis',
                                                    cursor: 'pointer',
                                                    pointerEvents: 'auto',
                                                    boxShadow: isCancelledOrOut ? 'none' : '0 1px 3px rgba(0,0,0,0.2)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    justifyContent: 'center',
                                                    gap: '1px',
                                                    opacity: isCancelledOrOut ? 0.45 : 1,
                                                    textDecoration: bar.booking.status === 'CANCELLED' ? 'line-through' : 'none',
                                                    borderStyle: isCancelledOrOut ? 'dashed' : 'solid',
                                                    borderWidth: isCancelledOrOut ? '1px' : '0',
                                                    borderColor: isCancelledOrOut ? 'rgba(255,255,255,0.3)' : 'transparent',
                                                }}
                                                title={`${bar.booking.guestName}\nStatus: ${bar.booking.status}${isCancelledOrOut ? ' (Room available for new booking)' : ''}\nSource: ${bar.booking.source || 'Walk-in'}\nAmount: ${bar.booking.totalAmount || '-'}`}
                                            >
                                                <span style={{ fontWeight: 600, lineHeight: 1.2 }}>{bar.booking.guestName}</span>
                                                {barWidth > 120 && (
                                                    <span style={{ fontSize: '9px', opacity: 0.85 }}>
                                                        {bar.booking.status}{sourceLabel ? ` · ${sourceLabel}` : ''}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
