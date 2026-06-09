'use client';

import { useState } from 'react';
import { format, startOfDay, addDays, differenceInDays, isToday, isWeekend } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DAYS = 30;
const DAY_W = 42;
const ROW_H = 46;
const HEADER_H = 46;
const SIDEBAR_W = 170;

const statusColor: Record<string, string> = {
    PENDING: 'var(--notion-orange)',
    CONFIRMED: 'var(--notion-green)',
    COMPLETED: 'var(--notion-blue)',
    CANCELLED: 'var(--notion-text-muted)',
};
const STATUS_LEGEND = [
    { key: 'PENDING', label: 'Pending' },
    { key: 'CONFIRMED', label: 'Confirmed' },
    { key: 'COMPLETED', label: 'Completed' },
];

interface VenueLite { id: number; name: string }
interface VBooking {
    id: number | string;
    banquetId: number;
    eventName: string;
    eventDate: string;
    endDate?: string | null;
    startTime?: string;
    endTime?: string;
    status: string;
}

// Venue × date timeline — same visual language as the rooms Gantt, scoped to banquet venues.
export default function VenueGantt({ venues, bookings, onSelect }: {
    venues: VenueLite[];
    bookings: VBooking[];
    onSelect?: (b: VBooking) => void;
}) {
    const [offset, setOffset] = useState(0);
    const [hovered, setHovered] = useState<string | number | null>(null);
    const start = startOfDay(addDays(new Date(), offset));
    const days = Array.from({ length: DAYS }, (_, i) => addDays(start, i));
    const todayIdx = differenceInDays(startOfDay(new Date()), start);

    const barsFor = (venueId: number) =>
        bookings
            .filter(b => b.banquetId === venueId && b.status !== 'CANCELLED')
            .map(b => {
                const s = startOfDay(new Date(b.eventDate));
                const e = b.endDate ? startOfDay(new Date(b.endDate)) : s;
                const startCol = differenceInDays(s, start);
                const span = Math.max(1, differenceInDays(e, s) + 1);
                const visStart = Math.max(0, startCol);
                const visEnd = Math.min(DAYS, startCol + span);
                if (visEnd <= 0 || visStart >= DAYS) return null;
                return { b, left: visStart * DAY_W, width: (visEnd - visStart) * DAY_W - 4 };
            })
            .filter(Boolean) as { b: VBooking; left: number; width: number }[];

    if (venues.length === 0) {
        return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--notion-text-muted)', fontSize: '13px' }}>Add a venue to see the calendar.</div>;
    }

    const cellBg = (d: Date) => isToday(d) ? 'var(--notion-blue-bg)' : isWeekend(d) ? 'var(--notion-bg-secondary)' : 'transparent';

    return (
        <div style={{ border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--notion-bg)' }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--notion-border)', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--notion-text)' }}>
                    {format(days[0]!, 'MMM d')} – {format(days[DAYS - 1]!, 'MMM d, yyyy')}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {/* Status legend */}
                    <div style={{ display: 'flex', gap: 10 }}>
                        {STATUS_LEGEND.map(s => (
                            <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--notion-text-secondary)' }}>
                                <span style={{ width: 9, height: 9, borderRadius: 2, background: statusColor[s.key] }} />{s.label}
                            </span>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => setOffset(o => o - 14)} style={navBtn} aria-label="Previous"><ChevronLeft size={16} /></button>
                        <button onClick={() => setOffset(0)} style={{ ...navBtn, width: 'auto', padding: '0 10px', fontSize: '12px' }}>Today</button>
                        <button onClick={() => setOffset(o => o + 14)} style={navBtn} aria-label="Next"><ChevronRight size={16} /></button>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', overflowX: 'auto' }}>
                {/* Sidebar */}
                <div style={{ flexShrink: 0, width: SIDEBAR_W, borderRight: '1px solid var(--notion-border)', background: 'var(--notion-bg-secondary)', position: 'sticky', left: 0, zIndex: 2 }}>
                    <div style={{ height: HEADER_H, borderBottom: '1px solid var(--notion-border)', display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--notion-text-muted)' }}>Venue</div>
                    {venues.map(v => (
                        <div key={v.id} style={{ height: ROW_H, borderBottom: '1px solid var(--notion-divider)', display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: '13px', fontWeight: 500, color: 'var(--notion-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</div>
                    ))}
                </div>

                {/* Grid */}
                <div style={{ position: 'relative' }}>
                    {/* Day header */}
                    <div style={{ display: 'flex', height: HEADER_H, borderBottom: '1px solid var(--notion-border)' }}>
                        {days.map((d, i) => (
                            <div key={i} style={{ width: DAY_W, flexShrink: 0, borderRight: '1px solid var(--notion-divider)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: cellBg(d) }}>
                                <span style={{ fontSize: '10px', color: 'var(--notion-text-muted)' }}>{format(d, 'EEE')}</span>
                                <span style={{ fontSize: '13px', fontWeight: isToday(d) ? 700 : 500, color: isToday(d) ? 'var(--notion-blue)' : 'var(--notion-text)' }}>{format(d, 'd')}</span>
                            </div>
                        ))}
                    </div>

                    {/* Today vertical line */}
                    {todayIdx >= 0 && todayIdx < DAYS && (
                        <div style={{ position: 'absolute', top: HEADER_H, bottom: 0, left: todayIdx * DAY_W + DAY_W / 2 - 1, width: 2, background: 'var(--notion-blue)', opacity: 0.35, pointerEvents: 'none', zIndex: 1 }} />
                    )}

                    {/* Rows */}
                    {venues.map(v => (
                        <div key={v.id} style={{ position: 'relative', height: ROW_H, borderBottom: '1px solid var(--notion-divider)' }}>
                            {/* day cell grid lines + weekend/today shading */}
                            <div style={{ display: 'flex', height: '100%' }}>
                                {days.map((d, i) => (
                                    <div key={i} style={{ width: DAY_W, flexShrink: 0, borderRight: '1px solid var(--notion-divider)', background: cellBg(d) }} />
                                ))}
                            </div>
                            {/* booking bars */}
                            {barsFor(v.id).map(({ b, left, width }) => {
                                const isH = hovered === b.id;
                                const timeLabel = b.startTime ? `${b.startTime}${b.endTime ? `–${b.endTime}` : ''}` : '';
                                return (
                                    <button
                                        key={b.id}
                                        onClick={() => onSelect?.(b)}
                                        onMouseEnter={() => setHovered(b.id)}
                                        onMouseLeave={() => setHovered(null)}
                                        title={`${b.eventName}${timeLabel ? ` — ${timeLabel}` : ''} (${b.status})`}
                                        style={{
                                            position: 'absolute', top: 7, left: left + 2, width, height: ROW_H - 16,
                                            background: statusColor[b.status] || 'var(--notion-text-secondary)', color: '#fff',
                                            borderRadius: '6px', border: 'none', cursor: 'pointer', padding: '0 8px',
                                            fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left',
                                            display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1.15,
                                            boxShadow: isH ? '0 2px 8px rgba(0,0,0,0.25)' : 'none',
                                            transform: isH ? 'translateY(-1px)' : 'none', transition: 'transform 0.1s, box-shadow 0.1s', zIndex: isH ? 3 : 2,
                                        }}
                                    >
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.eventName}</span>
                                        {timeLabel && width > 60 && <span style={{ fontSize: 10, opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis' }}>{timeLabel}</span>}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

const navBtn: React.CSSProperties = {
    width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', background: 'var(--notion-bg)',
    color: 'var(--notion-text-secondary)', cursor: 'pointer',
};
