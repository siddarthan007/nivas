import { db } from '../../db';
import { messages, users } from '../../db/schema';
import { eq, and, or, desc } from 'drizzle-orm';
import { NotFoundError } from '../../utils/errors';

export const MessagesService = {
    async sendMessage(hotelId: number, senderId: string, data: { receiverId?: string; roomId?: number; content: string; messageType?: string }) {
        const [msg] = await db.insert(messages).values({
            hotelId,
            senderId,
            receiverId: data.receiverId,
            roomId: data.roomId,
            content: data.content,
            messageType: data.messageType || 'TEXT'
        }).returning();

        return msg;
    },

    async getUserInbox(hotelId: number, userId: string) {
        return await db.query.messages.findMany({
            where: and(
                eq(messages.hotelId, hotelId),
                eq(messages.receiverId, userId)
            ),
            with: {
                sender: {
                    columns: { fullName: true, userType: true }
                }
            },
            orderBy: (msgs, { desc }) => [desc(msgs.createdAt)]
        });
    },

    async deleteMessage(hotelId: number, userId: string, messageId: string) {
        const [deleted] = await db.delete(messages)
            .where(and(
                eq(messages.id, messageId),
                eq(messages.hotelId, hotelId),
                or(eq(messages.senderId, userId), eq(messages.receiverId, userId))
            ))
            .returning();
        if (!deleted) throw new NotFoundError('Message');
        return deleted;
    },

    async markAsRead(hotelId: number, userId: string, messageId: string) {
        const [updated] = await db.update(messages)
            .set({ isRead: true })
            .where(and(
                eq(messages.id, messageId),
                eq(messages.hotelId, hotelId),
                eq(messages.receiverId, userId)
            ))
            .returning();
        if (!updated) throw new NotFoundError('Message');
        return updated;
    },

    async getConversations(hotelId: number, userId: string) {
        const allMessages = await db.query.messages.findMany({
            where: and(
                eq(messages.hotelId, hotelId),
                or(eq(messages.senderId, userId), eq(messages.receiverId, userId))
            ),
            with: {
                sender: { columns: { id: true, fullName: true, userType: true } },
                receiver: { columns: { id: true, fullName: true, userType: true } },
                room: { columns: { id: true, roomNumber: true } }
            },
            orderBy: (msgs, { desc }) => [desc(msgs.createdAt)]
        });

        const conversationMap = new Map<string, {
            id: string;
            participantId: string | null;
            participantName: string;
            roomId: number | null;
            roomNumber: string | null;
            lastMessage: string;
            lastMessageAt: string;
            unreadCount: number;
        }>();

        for (const msg of allMessages) {
            const isOwnMessage = msg.senderId === userId;
            const otherUserId = isOwnMessage ? msg.receiverId : msg.senderId;
            const otherUser = isOwnMessage ? msg.receiver : msg.sender;
            const key = otherUserId || `room-${msg.roomId}`;

            if (!conversationMap.has(key!)) {
                conversationMap.set(key!, {
                    id: key!,
                    participantId: otherUserId ?? null,
                    participantName: otherUser?.fullName || 'Unknown',
                    roomId: msg.room?.id ?? null,
                    roomNumber: msg.room?.roomNumber ?? null,
                    lastMessage: msg.content,
                    lastMessageAt: msg.createdAt?.toISOString() || new Date().toISOString(),
                    unreadCount: 0
                });
            }

            if (msg.receiverId === userId && !msg.isRead) {
                const conv = conversationMap.get(key!);
                if (conv) conv.unreadCount++;
            }
        }

        return Array.from(conversationMap.values());
    },

    async getConversationById(hotelId: number, userId: string, participantId: string) {
        const allMessages = await db.query.messages.findMany({
            where: and(
                eq(messages.hotelId, hotelId),
                or(
                    and(eq(messages.senderId, userId), eq(messages.receiverId, participantId)),
                    and(eq(messages.senderId, participantId), eq(messages.receiverId, userId))
                )
            ),
            with: {
                sender: { columns: { id: true, fullName: true, userType: true } },
                receiver: { columns: { id: true, fullName: true, userType: true } },
                room: { columns: { id: true, roomNumber: true } }
            },
            orderBy: (msgs, { asc }) => [asc(msgs.createdAt)]
        });

        const participant = allMessages.length > 0
            ? (allMessages[0].senderId === userId ? allMessages[0].receiver : allMessages[0].sender)
            : null;

        const firstRoomMsg = allMessages.find(m => m.room);

        const conversation = {
            id: participantId,
            participantId,
            guestName: participant?.fullName || 'Unknown',
            roomId: firstRoomMsg?.room?.id ?? null,
            roomNumber: firstRoomMsg?.room?.roomNumber ?? null,
            lastMessage: allMessages.length > 0 ? allMessages[allMessages.length - 1].content : '',
            lastMessageAt: allMessages.length > 0 ? (allMessages[allMessages.length - 1].createdAt?.toISOString() || '') : '',
            unreadCount: allMessages.filter(m => m.receiverId === userId && !m.isRead).length,
        };

        const formattedMessages = allMessages.map(msg => ({
            id: msg.id,
            content: msg.content,
            senderId: msg.senderId,
            senderName: msg.sender?.fullName || 'Unknown',
            senderType: msg.sender?.userType || 'STAFF',
            recipientId: msg.receiverId,
            roomId: msg.room?.id ?? null,
            roomNumber: msg.room?.roomNumber ?? null,
            isRead: msg.isRead ?? false,
            createdAt: msg.createdAt?.toISOString() || '',
        }));

        return { conversation, messages: formattedMessages };
    },

    async markConversationAsRead(hotelId: number, userId: string, participantId: string) {
        const updated = await db.update(messages)
            .set({ isRead: true })
            .where(and(
                eq(messages.hotelId, hotelId),
                eq(messages.receiverId, userId),
                eq(messages.senderId, participantId),
                eq(messages.isRead, false)
            ))
            .returning();

        return { markedCount: updated.length };
    },

    async getStaffList(hotelId: number, currentUserId: string) {
        const staffMembers = await db.query.users.findMany({
            where: and(
                eq(users.hotelId, hotelId),
                eq(users.userType, 'HOTEL_STAFF')
            ),
            columns: {
                id: true,
                fullName: true,
                userType: true,
            },
            with: {
                role: { columns: { name: true } }
            }
        });

        return staffMembers
            .filter(u => u.id !== currentUserId)
            .map(u => ({
                id: u.id,
                name: u.fullName,
                role: u.role?.name || 'Staff',
            }));
    }
};
