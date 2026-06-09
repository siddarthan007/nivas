'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
    format,
    startOfDay,
    addDays,
    differenceInDays,
    isToday,
    isSameDay,
    startOfMonth,
    addMonths,
    getDaysInMonth,
    isWeekend,
} from 'date-fns';
import {
    Phone,
    Mail,
    CreditCard,
    Calendar,
    Clock,
    Search,
    Users,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import type { Booking, Room, BookingStatus } from '@/lib/types/api.types';
import Modal from '@/components/ui/Modal';
import CustomDatePicker from '@/components/ui/DatePicker';

const ROW_HEIGHT = 52;
const HEADER_HEIGHT = 48;
const SIDEBAR_WIDTH = 200;
const DAY_COL_WIDTH = 48;

const ALL_STATUSES: BookingStatus[] = ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW'];

const statusConfig: Record<string, { color: string; label: string }> = {
    CHECKED_IN: { color: 'var(--notion-blue)', label: 'Checked In' },
    CONFIRMED: { color: 'var(--notion-green)', label: 'Confirmed' },
    CHECKED_OUT: { color: 'var(--notion-text-muted)', label: 'Checked Out' },
    CANCELLED: { color: 'var(--notion-text-secondary)', label: 'Cancelled' },
    NO_SHOW: { color: 'var(--notion-red)', label: 'No Show' },
};

function getStatusColor(status: string) {
    return statusConfig[status]?.color || 'var(--notion-orange)';
}

function BarTooltip({ booking, bar, isHovered }: { booking: Booking; bar: { fullNights: number }; isHovered: boolean }) {
    if (!isHovered) return null;
    return (
        <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%) translateY(-4px)',
            zIndex: 9999,
            backgroundColor: 'var(--notion-bg-secondary)',
            border: '1px solid var(--notion-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            fontSize: '12px',
            color: 'var(--notion-text)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
        }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontWeight: 700, fontSize: '13px' }}>{booking.guestName}</div>
                <div style={{ color: 'var(--notion-text-secondary)' }}>
                    {format(new Date(booking.checkIn), 'MMM d, yyyy')} – {format(new Date(booking.checkOut), 'MMM d, yyyy')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: getStatusColor(booking.status),
                        display: 'inline-block',
                    }} />
                    <span>{statusConfig[booking.status]?.label || booking.status}</span>
                    <span style={{ opacity: 0.4 }}>·</span>
                    <span>Rs {booking.totalAmount.toLocaleString()}</span>
                    <span style={{ opacity: 0.4 }}>·</span>
                    <span>{bar.fullNights} night{bar.fullNights !== 1 ? 's' : ''}</span>
                </div>
            </div>
        </div>
    );
}

interface CustomGanttProps {
    bookings: Booking[];
    rooms: Room[];
    onCreateBooking?: (roomId: number, dateISO: string) => void;
}

export default function CustomGantt({ bookings, rooms, onCreateBooking }: CustomGanttProps) {
    const [hoveredBooking, setHoveredBooking] = useState<string | null>(null);
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<Set<BookingStatus>>(new Set(ALL_STATUSES));
    const [fromDate, setFromDate] = useState<Date>(startOfMonth(startOfDay(new Date())));
    const [focusedDay, setFocusedDay] = useState<Date>(startOfDay(new Date()));
    const scrollRef = useRef<HTMLDivElement>(null);

    const monthStart = useMemo(() => startOfMonth(fromDate), [fromDate]);
    const monthDays = useMemo(() => getDaysInMonth(fromDate), [fromDate]);
    const columns = useMemo(() => Array.from({ length: monthDays }, (_, i) => addDays(monthStart, i)), [monthStart, monthDays]);

    useEffect(() => {
        if (!scrollRef.current) return;
        const targetIdx = columns.findIndex(col => isSameDay(col, focusedDay));
        if (targetIdx >= 0) {
            const containerWidth = scrollRef.current.clientWidth - SIDEBAR_WIDTH;
            const targetOffset = targetIdx * DAY_COL_WIDTH;
            const targetScroll = targetOffset - containerWidth / 2 + DAY_COL_WIDTH / 2;
            scrollRef.current.scrollLeft = Math.max(0, targetScroll);
        }
    }, [columns, focusedDay]);

    const filteredBookings = useMemo(() => {
        let result = bookings;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(b =>
                b.guestName.toLowerCase().includes(q) ||
                b.guestPhone.includes(q) ||
                b.id.toLowerCase().includes(q)
            );
        }
        if (statusFilter.size < ALL_STATUSES.length) {
            result = result.filter(b => statusFilter.has(b.status));
        }
        return result;
    }, [bookings, searchQuery, statusFilter]);

    const roomRows = useMemo(() => {
        const sortedRooms = [...rooms].sort((a, b) => a.number - b.number);
        return sortedRooms.map(room => {
            const roomBookings = filteredBookings
                .filter(b => b.roomId === room.id)
                .sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime());
            return { room, bookings: roomBookings };
        });
    }, [filteredBookings, rooms]);

    const toggleStatus = (status: BookingStatus) => {
        setStatusFilter(prev => {
            const next = new Set(prev);
            if (next.has(status)) next.delete(status);
            else next.add(status);
            return next;
        });
    };

    const goPrev = () => setFromDate(d => addMonths(d, -1));
    const goNext = () => setFromDate(d => addMonths(d, 1));
    const goToday = () => {
        const today = startOfDay(new Date());
        setFromDate(startOfMonth(today));
        setFocusedDay(today);
    };

    const timelineWidth = monthDays * DAY_COL_WIDTH;

    const getBarStyle = useCallback((booking: Booking) => {
        const checkIn = startOfDay(new Date(booking.checkIn));
        const checkOut = startOfDay(new Date(booking.checkOut));
        const nights = Math.max(1, differenceInDays(checkOut, checkIn));
        const offset = differenceInDays(checkIn, monthStart);
        const visibleStart = Math.max(0, offset);
        const visibleEnd = Math.min(offset + nights, monthDays);
        const visibleSpan = visibleEnd - visibleStart;
        if (visibleSpan <= 0) return null;
        return {
            left: visibleStart * DAY_COL_WIDTH,
            width: visibleSpan * DAY_COL_WIDTH,
            color: getStatusColor(booking.status),
            fullNights: nights,
        };
    }, [monthStart, monthDays]);

    if (!rooms.length) {
        return (
            <div className='empty-state'>
                <p>No rooms available.</p>
            </div>
        );
    }

    const barCount = filteredBookings.length;
    const navBtn = {
        display: 'flex' as const,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        padding: '5px 10px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--notion-border)',
        backgroundColor: 'var(--notion-bg)',
        color: 'var(--notion-text)',
        fontSize: '12px',
        cursor: 'pointer',
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Toolbar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)',
                borderBottom: '1px solid var(--notion-border)',
                backgroundColor: 'var(--notion-bg-secondary)',
                flexShrink: 0,
                flexWrap: 'wrap',
            }}>
                <div style={{ position: 'relative', minWidth: '200px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-muted)' }} />
                    <input
                        type='text'
                        placeholder='Search guest...'
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '6px 10px 6px 32px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--notion-border)',
                            backgroundColor: 'var(--notion-bg)',
                            color: 'var(--notion-text)',
                            fontSize: '13px',
                            outline: 'none',
                        }}
                    />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <button onClick={goPrev} style={navBtn}><ChevronLeft size={14} /></button>
                    <button onClick={goToday} style={navBtn}>Today</button>
                    <button onClick={goNext} style={navBtn}><ChevronRight size={14} /></button>
                </div>

                <div style={{ width: '150px' }}>
                    <CustomDatePicker
                        selected={focusedDay}
                        onChange={(d) => {
                            if (!d) return;
                            const sd = startOfDay(d);
                            setFromDate(startOfMonth(sd));
                            setFocusedDay(sd);
                        }}
                        placeholder='Jump to date'
                        fullWidth={false}
                    />
                </div>

                <span style={{ fontSize: '12px', color: 'var(--notion-text-muted)', marginLeft: 'auto' }}>
                    {barCount} booking{barCount !== 1 ? 's' : ''} · {format(fromDate, 'MMMM yyyy')}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    {ALL_STATUSES.map(status => (
                        <button
                            key={status}
                            onClick={() => toggleStatus(status)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11px',
                                color: statusFilter.has(status) ? 'var(--notion-text)' : 'var(--notion-text-muted)',
                                opacity: statusFilter.has(status) ? 1 : 0.5,
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '2px 6px',
                                borderRadius: 'var(--radius-sm)',
                            }}
                            title={statusConfig[status]?.label || status}
                        >
                            <span style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: statusConfig[status]?.color || 'var(--notion-orange)',
                                display: 'inline-block',
                            }} />
                            {statusConfig[status]?.label || status}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main scrollable area */}
            <div ref={scrollRef} style={{ flex: 1, overflow: 'auto' }}>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: SIDEBAR_WIDTH + timelineWidth, position: 'relative' }}>
                    {/* Sticky header row */}
                    <div style={{
                        display: 'flex',
                        position: 'sticky',
                        top: 0,
                        zIndex: 20,
                        backgroundColor: 'var(--notion-bg-secondary)',
                        borderBottom: '1px solid var(--notion-border)',
                    }}>
                        <div style={{
                            width: SIDEBAR_WIDTH,
                            minWidth: SIDEBAR_WIDTH,
                            height: HEADER_HEIGHT,
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 var(--space-3)',
                            position: 'sticky',
                            left: 0,
                            zIndex: 30,
                            backgroundColor: 'var(--notion-bg-secondary)',
                            borderRight: '1px solid var(--notion-border)',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--notion-text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                        }}>
                            Room
                        </div>
                        <div style={{ display: 'flex', height: HEADER_HEIGHT, width: timelineWidth, flexShrink: 0 }}>
                            {columns.map((col, i) => (
                                <div key={i} style={{
                                    width: DAY_COL_WIDTH,
                                    minWidth: DAY_COL_WIDTH,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRight: '1px solid var(--notion-border)',
                                    color: isToday(col) ? 'var(--notion-blue)' : isSameDay(col, focusedDay) ? 'var(--notion-orange)' : 'var(--notion-text-secondary)',
                                    fontWeight: isToday(col) || isSameDay(col, focusedDay) ? 700 : 500,
                                    fontSize: '11px',
                                    position: 'relative',
                                    backgroundColor: isSameDay(col, focusedDay) && !isToday(col) ? 'rgba(251, 191, 36, 0.08)' : 'transparent',
                                }}>
                                    <span>{format(col, 'd')}</span>
                                    <span style={{ fontSize: '10px', opacity: 0.7 }}>{format(col, 'EEE')}</span>
                                    {isToday(col) && (
                                        <div style={{
                                            position: 'absolute',
                                            bottom: 0,
                                            left: 0,
                                            right: 0,
                                            height: '2px',
                                            backgroundColor: 'var(--notion-blue)',
                                        }} />
                                    )}
                                    {isSameDay(col, focusedDay) && !isToday(col) && (
                                        <div style={{
                                            position: 'absolute',
                                            bottom: 0,
                                            left: 0,
                                            right: 0,
                                            height: '2px',
                                            backgroundColor: 'var(--notion-orange)',
                                        }} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Body rows */}
                    {roomRows.map(({ room, bookings: roomBookings }) => (
                        <div key={room.id} style={{ display: 'flex' }}>
                            {/* Sticky sidebar cell */}
                            <div style={{
                                width: SIDEBAR_WIDTH,
                                minWidth: SIDEBAR_WIDTH,
                                position: 'sticky',
                                left: 0,
                                zIndex: 10,
                                height: ROW_HEIGHT,
                                display: 'flex',
                                alignItems: 'center',
                                padding: '0 var(--space-3)',
                                borderBottom: '1px solid var(--notion-border)',
                                borderRight: '1px solid var(--notion-border)',
                                backgroundColor: 'var(--notion-bg)',
                            }}>
                                <span style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: 'var(--radius-sm)',
                                    backgroundColor: 'var(--notion-bg-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    marginRight: 'var(--space-2)',
                                    flexShrink: 0,
                                }}>
                                    {room.number}
                                </span>
                                <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', lineHeight: 1.3, flex: 1, minWidth: 0 }}>
                                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--notion-text)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                        {room.name || room.type}
                                    </span>
                                    {room.name && (
                                        <span style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                            {room.type}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {/* Timeline row — click an empty cell to start a booking for that room+date */}
                            <div
                                title={onCreateBooking ? 'Click an empty day to create a booking' : undefined}
                                onClick={onCreateBooking ? (e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const dayIdx = Math.floor((e.clientX - rect.left) / DAY_COL_WIDTH);
                                    const day = addDays(monthStart, dayIdx);
                                    onCreateBooking(room.id, format(day, 'yyyy-MM-dd'));
                                } : undefined}
                                style={{ position: 'relative', width: timelineWidth, height: ROW_HEIGHT, borderBottom: '1px solid var(--notion-border)', cursor: onCreateBooking ? 'cell' : 'default' }}>
                                {/* Grid lines */}
                                <div style={{ display: 'flex', position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                                    {columns.map((col, i) => (
                                        <div key={i} style={{
                                            width: DAY_COL_WIDTH,
                                            minWidth: DAY_COL_WIDTH,
                                            borderRight: '1px solid var(--notion-border)',
                                            backgroundColor: isToday(col)
                                                ? 'rgba(59,130,246,0.06)'
                                                : isSameDay(col, focusedDay)
                                                    ? 'rgba(251, 191, 36, 0.06)'
                                                    : isWeekend(col)
                                                        ? 'rgba(120,120,120,0.05)'
                                                        : 'transparent',
                                        }} />
                                    ))}
                                </div>
                                {/* Today indicator line */}
                                {(() => {
                                    const today = new Date();
                                    const todayIdx = differenceInDays(startOfDay(today), monthStart);
                                    if (todayIdx >= 0 && todayIdx < monthDays) {
                                        return (
                                            <div style={{
                                                position: 'absolute',
                                                top: 0,
                                                bottom: 0,
                                                left: todayIdx * DAY_COL_WIDTH + DAY_COL_WIDTH / 2 - 1,
                                                width: '2px',
                                                backgroundColor: 'var(--notion-red)',
                                                opacity: 0.3,
                                                pointerEvents: 'none',
                                                zIndex: 5,
                                            }} />
                                        );
                                    }
                                    return null;
                                })()}
                                {/* Focused day indicator line */}
                                {(() => {
                                    const focusedIdx = differenceInDays(startOfDay(focusedDay), monthStart);
                                    if (focusedIdx >= 0 && focusedIdx < monthDays && !isToday(focusedDay)) {
                                        return (
                                            <div style={{
                                                position: 'absolute',
                                                top: 0,
                                                bottom: 0,
                                                left: focusedIdx * DAY_COL_WIDTH + DAY_COL_WIDTH / 2 - 1,
                                                width: '2px',
                                                backgroundColor: 'var(--notion-orange)',
                                                opacity: 0.3,
                                                pointerEvents: 'none',
                                                zIndex: 5,
                                            }} />
                                        );
                                    }
                                    return null;
                                })()}
                                {/* Bars */}
                                {roomBookings.map(booking => {
                                    const bar = getBarStyle(booking);
                                    if (!bar) return null;
                                    const isHovered = hoveredBooking === booking.id;
                                    return (
                                        <div
                                            key={booking.id}
                                            onMouseEnter={() => setHoveredBooking(booking.id)}
                                            onMouseLeave={() => setHoveredBooking(null)}
                                            onClick={(e) => { e.stopPropagation(); setSelectedBooking(booking); }}
                                            style={{
                                                position: 'absolute',
                                                left: bar.left,
                                                top: '50%',
                                                width: bar.width,
                                                height: '34px',
                                                borderRadius: 'var(--radius-sm)',
                                                backgroundColor: bar.color,
                                                opacity: booking.status === 'CANCELLED' || booking.status === 'CHECKED_OUT' ? 0.5 : 1,
                                                cursor: 'pointer',
                                                transition: 'transform 0.1s ease, box-shadow 0.1s ease',
                                                boxShadow: isHovered ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
                                                transform: isHovered ? 'translateY(-50%) scale(1.01)' : 'translateY(-50%)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                padding: '0 8px',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            <span style={{
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                color: 'var(--foreground-inverse)',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                            }}>
                                                {booking.guestName}
                                            </span>
                                            <BarTooltip booking={booking} bar={bar} isHovered={isHovered} />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal */}
            <Modal
                isOpen={!!selectedBooking}
                onClose={() => setSelectedBooking(null)}
                title='Booking Details'
                size='md'
            >
                {selectedBooking && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-3)',
                            padding: 'var(--space-3)',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--notion-bg-secondary)',
                            border: '1px solid var(--notion-border)',
                        }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                backgroundColor: getStatusColor(selectedBooking.status),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--foreground-inverse)',
                                fontWeight: 700,
                                fontSize: '14px',
                                flexShrink: 0,
                            }}>
                                {selectedBooking.guestName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--notion-text)' }}>{selectedBooking.guestName}</div>
                                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                                    {statusConfig[selectedBooking.status]?.label || selectedBooking.status}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <Phone size={14} style={{ color: 'var(--notion-text-muted)', flexShrink: 0 }} />
                                <span style={{ fontSize: '13px', color: 'var(--notion-text)' }}>{selectedBooking.guestPhone}</span>
                            </div>
                            {selectedBooking.guestEmail && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                    <Mail size={14} style={{ color: 'var(--notion-text-muted)', flexShrink: 0 }} />
                                    <span style={{ fontSize: '13px', color: 'var(--notion-text)' }}>{selectedBooking.guestEmail}</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <Calendar size={14} style={{ color: 'var(--notion-text-muted)', flexShrink: 0 }} />
                                <span style={{ fontSize: '13px', color: 'var(--notion-text)' }}>
                                    {format(new Date(selectedBooking.checkIn), 'MMM d, yyyy')} – {format(new Date(selectedBooking.checkOut), 'MMM d, yyyy')}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <Users size={14} style={{ color: 'var(--notion-text-muted)', flexShrink: 0 }} />
                                <span style={{ fontSize: '13px', color: 'var(--notion-text)' }}>{selectedBooking.guestCount} guest{selectedBooking.guestCount > 1 ? 's' : ''}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <CreditCard size={14} style={{ color: 'var(--notion-text-muted)', flexShrink: 0 }} />
                                <span style={{ fontSize: '13px', color: 'var(--notion-text)' }}>Rs {selectedBooking.totalAmount.toLocaleString()}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <Clock size={14} style={{ color: 'var(--notion-text-muted)', flexShrink: 0 }} />
                                <span style={{ fontSize: '13px', color: 'var(--notion-text)' }}>{selectedBooking.source}</span>
                            </div>
                        </div>

                        {(selectedBooking.advancePayment || selectedBooking.balanceAmount !== undefined) && (
                            <div style={{
                                display: 'flex',
                                gap: 'var(--space-4)',
                                padding: 'var(--space-3)',
                                borderRadius: 'var(--radius-md)',
                                backgroundColor: 'var(--notion-bg-secondary)',
                                border: '1px solid var(--notion-border)',
                            }}>
                                {selectedBooking.advancePayment !== undefined && (
                                    <div>
                                        <div style={{ fontSize: '11px', color: 'var(--notion-text-muted)', textTransform: 'uppercase' }}>Advance</div>
                                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--notion-green)' }}>Rs {selectedBooking.advancePayment.toLocaleString()}</div>
                                    </div>
                                )}
                                {selectedBooking.balanceAmount !== undefined && (
                                    <div>
                                        <div style={{ fontSize: '11px', color: 'var(--notion-text-muted)', textTransform: 'uppercase' }}>Balance</div>
                                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--notion-orange)' }}>Rs {selectedBooking.balanceAmount.toLocaleString()}</div>
                                    </div>
                                )}
                            </div>
                        )}

                        {selectedBooking.notes && (
                            <div>
                                <div style={{ fontSize: '11px', color: 'var(--notion-text-muted)', marginBottom: '4px' }}>Notes</div>
                                <div style={{ fontSize: '13px', color: 'var(--notion-text)', lineHeight: 1.5 }}>{selectedBooking.notes}</div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
}
