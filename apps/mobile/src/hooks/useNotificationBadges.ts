import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useSocketContext } from '@/components/providers/SocketProvider';

export function useNotificationBadges() {
    const { unreadCount: socketUnread } = useSocketContext();

    const { data: notifications = [] } = useQuery({
        queryKey: ['notifications'],
        queryFn: async () => {
            const res = await api.notifications.get();
            if (res.error) return [];
            return res.data?.data || [];
        },
        refetchInterval: 60_000,
    });

    const { data: conversations = [] } = useQuery({
        queryKey: ['messages_conversations'],
        queryFn: async () => {
            const res = await (api as any).messages.conversations.get();
            if (res.error) return [];
            return res.data?.data || [];
        },
        refetchInterval: 60_000,
    });

    const notificationUnread = notifications.filter((n: any) => !n.isRead).length;
    const messageUnread = conversations.reduce((sum: number, c: any) => sum + (c.unreadCount || 0), 0);
    const totalUnread = Math.max(notificationUnread, socketUnread) + messageUnread;

    useEffect(() => {
        Notifications.setBadgeCountAsync(totalUnread).catch(() => { /* ignore */ });
    }, [totalUnread]);

    return {
        notificationUnread: Math.max(notificationUnread, socketUnread),
        messageUnread,
        totalUnread,
    };
}
