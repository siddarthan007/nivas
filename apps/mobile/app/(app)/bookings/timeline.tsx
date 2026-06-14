import React, { useMemo, useState } from 'react';
import { View, ActivityIndicator, TouchableOpacity, FlatList } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { TimelineCalendar, EventItem } from '@howljs/calendar-kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, CalendarDays, List } from 'lucide-react-native';
import { Heading, Text, Caption } from '@/components/ui/Typography';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';

type ViewMode = 'calendar' | 'list';

const STATUS_COLOR: Record<string, string> = {
    CHECKED_IN: '#0f7b6c',
    CONFIRMED: '#2eaadc',
    CHECKED_OUT: '#9ca3af',
    CANCELLED: '#e03e3e',
};

export default function BookingsTimelineScreen() {
    const router = useRouter();
    const [viewMode, setViewMode] = useState<ViewMode>('list');

    const { data: roomsResponse, isLoading: isRoomsLoading } = useQuery({
        queryKey: ['rooms'],
        queryFn: async () => {
            const res = await api.rooms.get();
            if (res.error) throw res.error;
            return res.data?.data;
        },
    });

    const { data: bookingsResponse, isLoading: isBookingsLoading, refetch, isRefetching } = useQuery({
        queryKey: ['bookings', 'timeline'],
        queryFn: async () => {
            const res = await api.bookings.get({ query: { limit: '100' } });
            if (res.error) throw res.error;
            return res.data?.data;
        },
    });

    const isLoading = isRoomsLoading || isBookingsLoading;

    const events: EventItem[] = useMemo(() => {
        if (!bookingsResponse) return [];
        const rooms = roomsResponse || [];

        return bookingsResponse.map((booking) => {
            const room = rooms.find((r) => r.id === booking.roomId);
            const roomName = room ? room.name : `Room ${booking.roomId}`;

            return {
                id: booking.id,
                title: `${booking.guestName} (${roomName})`,
                start: new Date(booking.checkIn).toISOString(),
                end: new Date(booking.checkOut).toISOString(),
                color: STATUS_COLOR[booking.status || ''] || '#2eaadc',
                data: booking,
            };
        });
    }, [bookingsResponse, roomsResponse]);

    const sortedBookings = useMemo(() => {
        if (!bookingsResponse) return [];
        return [...bookingsResponse].sort(
            (a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime()
        );
    }, [bookingsResponse]);

    const roomName = (roomId: number) => {
        const room = (roomsResponse || []).find((r) => r.id === roomId);
        return room ? room.name : `Room ${roomId}`;
    };

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-notion-bg justify-center items-center">
                <ActivityIndicator size="large" color="#37352f" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-notion-bg" edges={['top', 'bottom']}>
            <View className="flex-row items-center px-4 py-3 border-b border-notion-border bg-notion-bg">
                <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
                    <ChevronLeft size={24} color="#37352f" />
                </TouchableOpacity>
                <Heading className="mb-0 flex-1">Bookings</Heading>
                <View className="flex-row bg-notion-bg-secondary rounded-lg border border-notion-border overflow-hidden">
                    <TouchableOpacity
                        onPress={() => setViewMode('list')}
                        className={`px-3 py-1.5 ${viewMode === 'list' ? 'bg-notion-blue' : ''}`}
                    >
                        <List size={18} color={viewMode === 'list' ? '#fff' : '#37352f'} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setViewMode('calendar')}
                        className={`px-3 py-1.5 ${viewMode === 'calendar' ? 'bg-notion-blue' : ''}`}
                    >
                        <CalendarDays size={18} color={viewMode === 'calendar' ? '#fff' : '#37352f'} />
                    </TouchableOpacity>
                </View>
            </View>

            {viewMode === 'calendar' ? (
                <View className="flex-1">
                    <TimelineCalendar
                        viewMode="week"
                        events={events}
                        allowPinchToZoom
                        allowDragToCreate={false}
                        theme={{
                            colors: {
                                background: '#ffffff',
                                onBackground: '#37352f',
                                surface: '#f9f9f8',
                                onSurface: '#37352f',
                                primary: '#2eaadc',
                            },
                        } as any}
                    />
                </View>
            ) : sortedBookings.length === 0 ? (
                <EmptyState title="No bookings" description="Upcoming and recent stays will appear here." />
            ) : (
                <FlatList
                    data={sortedBookings}
                    keyExtractor={(item) => String(item.id)}
                    contentContainerStyle={{ padding: 16, gap: 10 }}
                    refreshing={isRefetching}
                    onRefresh={() => refetch()}
                    renderItem={({ item }) => (
                        <Card className="p-4">
                            <View className="flex-row justify-between items-start">
                                <View className="flex-1 mr-3">
                                    <Text className="font-semibold text-notion-text">{item.guestName || 'Guest'}</Text>
                                    <Caption className="text-notion-text-secondary mt-0.5">{roomName(item.roomId)}</Caption>
                                </View>
                                <View
                                    className="px-2 py-0.5 rounded"
                                    style={{ backgroundColor: `${STATUS_COLOR[item.status || ''] || '#2eaadc'}22` }}
                                >
                                    <Caption style={{ color: STATUS_COLOR[item.status || ''] || '#2eaadc' }}>
                                        {(item.status || 'UNKNOWN').replace(/_/g, ' ')}
                                    </Caption>
                                </View>
                            </View>
                            <View className="mt-2 flex-row justify-between">
                                <Caption className="text-notion-text-secondary">
                                    In {new Date(item.checkIn).toLocaleDateString()}
                                </Caption>
                                <Caption className="text-notion-text-secondary">
                                    Out {new Date(item.checkOut).toLocaleDateString()}
                                </Caption>
                            </View>
                        </Card>
                    )}
                />
            )}
        </SafeAreaView>
    );
}
