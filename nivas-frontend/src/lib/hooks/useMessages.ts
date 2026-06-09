import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import { toast } from 'sonner';
import { useWebSocket } from '@/lib/contexts/WebSocketContext';

export interface Message {
    id: number | string;
    content: string;
    senderId: number | string;
    senderName?: string;
    senderType: 'STAFF' | 'GUEST' | 'HOTEL_STAFF';
    recipientId?: number | string | null;
    roomId?: number | null;
    roomNumber?: string | null;
    isRead: boolean;
    createdAt: string;
}

export interface Conversation {
    id: number | string;
    participantId?: string | null;
    participantName?: string;
    roomId?: number | null;
    roomNumber?: string | null;
    guestName: string;
    lastMessage: string;
    lastMessageAt: string;
    unreadCount: number;
    messages?: Message[];
}

export interface SendMessagePayload {
    content: string;
    receiverId?: string;
    roomId?: number;
}

export interface StaffMember {
    id: string;
    name: string;
    role?: { name?: string };
}

export interface UseMessagesReturn {
    conversations: Conversation[];
    activeConversation: Conversation | null;
    messages: Message[];
    isLoading: boolean;
    error: string | null;
    staffList: StaffMember[];
    isLoadingStaff: boolean;
    refresh: () => Promise<void>;
    selectConversation: (participantId: string) => Promise<void>;
    sendMessage: (payload: SendMessagePayload) => Promise<boolean>;
    markAsRead: (participantId: string) => Promise<void>;
    fetchStaffList: () => Promise<void>;
    startNewConversation: (staffMember: StaffMember) => void;
}

export function useMessages(): UseMessagesReturn {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [staffList, setStaffList] = useState<StaffMember[]>([]);
    const [isLoadingStaff, setIsLoadingStaff] = useState(false);

    const hasHotel = useCallback(() => {
        try {
            const userStr = localStorage.getItem('nivas_user_data');
            const user = userStr ? JSON.parse(userStr) : null;
            return !!user?.hotelId;
        } catch { return false; }
    }, []);

    const fetchConversations = useCallback(async () => {
        if (!hasHotel()) { setIsLoading(false); return; }
        try {
            setIsLoading(true);
            setError(null);
            const response = await api.get<Conversation[]>('/messages/conversations');
            if (response.data) {
                const mapped = (response.data as any[]).map((c: any) => ({
                    id: c.id || c.participantId || '',
                    participantId: c.participantId,
                    participantName: c.participantName,
                    roomId: c.roomId ?? null,
                    roomNumber: c.roomNumber ?? null,
                    guestName: c.participantName || c.guestName || 'Unknown',
                    lastMessage: c.lastMessage || '',
                    lastMessageAt: c.lastMessageAt || '',
                    unreadCount: c.unreadCount || 0,
                }));
                setConversations(mapped);
            }
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to fetch conversations';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const selectConversation = useCallback(async (participantId: string) => {
        try {
            const response = await api.get<{ conversation: any; messages: Message[] }>(`/messages/conversations/${participantId}`);
            if (response.data) {
                const conv = response.data.conversation;
                setActiveConversation({
                    id: conv.id || participantId,
                    participantId: conv.participantId || participantId,
                    participantName: conv.guestName || conv.participantName,
                    roomId: conv.roomId ?? null,
                    roomNumber: conv.roomNumber ?? null,
                    guestName: conv.guestName || conv.participantName || 'Unknown',
                    lastMessage: conv.lastMessage || '',
                    lastMessageAt: conv.lastMessageAt || '',
                    unreadCount: conv.unreadCount || 0,
                });
                setMessages(response.data.messages || []);
            }
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to load conversation';
            toast.error(message);
        }
    }, []);

    const sendMessage = useCallback(async (payload: SendMessagePayload): Promise<boolean> => {
        try {
            const sendPayload: any = { content: payload.content };
            if (payload.receiverId) sendPayload.receiverId = payload.receiverId;
            if (activeConversation?.participantId && !payload.receiverId) {
                sendPayload.receiverId = activeConversation.participantId;
            }
            if (payload.roomId) sendPayload.roomId = payload.roomId;

            const response = await api.post<Message>('/messages', sendPayload);
            if (response.data) {
                const newMsg: Message = {
                    id: (response.data as any).id,
                    content: (response.data as any).content || payload.content,
                    senderId: (response.data as any).senderId,
                    senderName: 'You',
                    senderType: 'STAFF',
                    recipientId: (response.data as any).receiverId,
                    roomId: (response.data as any).roomId ?? null,
                    roomNumber: null,
                    isRead: false,
                    createdAt: (response.data as any).createdAt || new Date().toISOString(),
                };
                setMessages(prev => [...prev, newMsg]);
                return true;
            }
            return false;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to send message';
            toast.error(message);
            return false;
        }
    }, [activeConversation]);

    const markAsRead = useCallback(async (participantId: string) => {
        try {
            await api.patch(`/messages/conversations/${participantId}/read`);
            setConversations(prev => prev.map(c =>
                (c.participantId === participantId || c.id === participantId)
                    ? { ...c, unreadCount: 0 }
                    : c
            ));
        } catch (e) {
            // Silently fail - not critical
        }
    }, []);

    const fetchStaffList = useCallback(async () => {
        if (!hasHotel()) { setIsLoadingStaff(false); return; }
        try {
            setIsLoadingStaff(true);
            const response = await api.get<StaffMember[]>('/messages/staff');
            if (response.data) {
                setStaffList(response.data as StaffMember[]);
            }
        } catch (e) {
            toast.error('Failed to load staff list');
        } finally {
            setIsLoadingStaff(false);
        }
    }, []);

    const startNewConversation = useCallback((staffMember: StaffMember) => {
        const existingConv = conversations.find(c => c.participantId === staffMember.id);
        if (existingConv) {
            selectConversation(staffMember.id);
            return;
        }
        setActiveConversation({
            id: staffMember.id,
            participantId: staffMember.id,
            participantName: staffMember.name,
            guestName: staffMember.name,
            lastMessage: '',
            lastMessageAt: new Date().toISOString(),
            unreadCount: 0,
        });
        setMessages([]);
    }, [conversations, selectConversation]);

    useEffect(() => {
        if (hasHotel()) fetchConversations();
    }, [fetchConversations]);

    const ws = useWebSocket();

    const refreshActiveMessages = useCallback(async (participantId: string) => {
        try {
            const response = await api.get<{ conversation: any; messages: Message[] }>(`/messages/conversations/${participantId}`);
            if (response.data?.messages) setMessages(response.data.messages);
        } catch { /* silent */ }
    }, []);

    // Push: refresh instantly when the server signals a new message for this user.
    useEffect(() => {
        const unsub = ws.on('NEW_MESSAGE', () => {
            if (hasHotel()) fetchConversations();
            if (activeConversation?.participantId) refreshActiveMessages(activeConversation.participantId);
        });
        return unsub;
    }, [ws, fetchConversations, activeConversation?.participantId, refreshActiveMessages]);

    // Fallback polling ONLY when the socket is down (otherwise push handles it).
    useEffect(() => {
        if (!hasHotel() || ws.status === 'connected') return;
        const interval = setInterval(() => {
            fetchConversations();
            if (activeConversation?.participantId) refreshActiveMessages(activeConversation.participantId);
        }, 15000);
        return () => clearInterval(interval);
    }, [fetchConversations, ws.status, activeConversation?.participantId, refreshActiveMessages]);

    return {
        conversations,
        activeConversation,
        messages,
        isLoading,
        error,
        staffList,
        isLoadingStaff,
        refresh: fetchConversations,
        selectConversation,
        sendMessage,
        markAsRead,
        fetchStaffList,
        startNewConversation,
    };
}

export default useMessages;
