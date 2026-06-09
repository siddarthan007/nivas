'use client';

import { useEffect } from 'react';
import { useBookings } from '@/lib/hooks/useBookings';
import { useLayout } from '@/lib/hooks/useLayout';
import { useRouter } from '@/lib/router';
import CustomGantt from '@/components/features/bookings/CustomGantt';

export default function BookingGanttPage() {
    const { bookings, fetchBookings, isLoading: isBookingsLoading } = useBookings();
    const { rooms, fetchVisualData, isLoading: isRoomsLoading } = useLayout();
    const router = useRouter();

    useEffect(() => {
        fetchBookings({ limit: 500 });
        fetchVisualData();
    }, [fetchBookings, fetchVisualData]);

    const isLoading = isBookingsLoading || isRoomsLoading;

    if (isLoading) return (
        <div className="page-center-column">
            <div className="animate-spin loading-spinner" />
            <span style={{ fontSize: '14px' }} className="text-notion-secondary">Loading timeline...</span>
        </div>
    );

    return (
        <div style={{ padding: 'var(--space-6)', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: 'var(--space-6)' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 600 }}>Booking Schedule</h1>
                <p style={{ fontSize: '14px' }} className="text-notion-secondary">
                    Room diary with booking bars.
                </p>
            </div>

            <div style={{
                border: '1px solid var(--notion-border)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                backgroundColor: 'var(--notion-bg)',
                flex: 1,
            }}>
                <CustomGantt
                    bookings={bookings}
                    rooms={rooms}
                    onCreateBooking={(roomId, dateISO) => router.push(`/hotel/bookings?action=new&roomId=${roomId}&checkIn=${dateISO}`)}
                />
            </div>
        </div>
    );
}
