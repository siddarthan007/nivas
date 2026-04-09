import { db } from '../../db';
import { messages, users } from '../../db/schema';
import { eq, and, or, asc, desc } from 'drizzle-orm';
import { NotFoundError } from '../../utils/errors';

export const MessagesService = {
    async sendMessage(hotelId: number, senderId: string, data: { receiverId?: string; roomId?: number; content: string; messageType?: string }) {
        const [message] = await db.insert(messages).values({
            hotelId,
            senderId,
            receiverId: data.receiverId,
            roomId: data.roomId,
            content: data.content,
            messageType: data.messageType || 'TEXT',
        }).returning();

        return message;
    },

    async getUserInbox(hotelId: number, userId: string) {
        return await db.query.messages.findMany({
            where: and(eq(messages.hotelId, hotelId), eq(messages.receiverId, userId)),
            with: {
                sender: {
                    columns: { fullName: true, userType: true },
                },
            },
            orderBy: (messageTable, { desc }) => [desc(messageTable.createdAt)],
        });
    },

    async deleteMessage(hotelId: number, userId: string, messageId: string) {
        const [deleted] = await db.delete(messages)
            .where(and(
                eq(messages.id, messageId),
                eq(messages.hotelId, hotelId),
                or(eq(messages.senderId, userId), eq(messages.receiverId, userId)),
            ))
            .returning();

        if (!deleted) throw new NotFoundError('Message');
        return deleted;
    },

    async markAsRead(hotelId: number, userId: string, messageId: string) {
        const [updated] = await db.update(messages)
            .set({ isRead: true })
            .where(and(eq(messages.id, messageId), eq(messages.hotelId, hotelId), eq(messages.receiverId, userId)))
            .returning();

        if (!updated) throw new NotFoundError('Message');
        return updated;
    },

    async getConversations(hotelId: number, userId: string) {
        const allMessages = await db.query.messages.findMany({
            where: and(
                eq(messages.hotelId, hotelId),
                or(eq(messages.senderId, userId), eq(messages.receiverId, userId)),
            ),
            with: {
                sender: { columns: { id: true, fullName: true, userType: true } },
                receiver: { columns: { id: true, fullName: true, userType: true } },
                room: { columns: { id: true, number: true } },
            },
            orderBy: (messageTable, { desc }) => [desc(messageTable.createdAt)],
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

        for (const message of allMessages) {
            const isOwnMessage = message.senderId === userId;
            const otherUserId = isOwnMessage ? message.receiverId : message.senderId;
            const otherUser = isOwnMessage ? message.receiver : message.sender;
            const key = otherUserId ?? `room-${message.roomId ?? 'unknown'}`;

            if (!conversationMap.has(key)) {
                conversationMap.set(key, {
                    id: key,
                    participantId: otherUserId ?? null,
                    participantName: otherUser?.fullName || 'Unknown',
                    roomId: message.room?.id ?? null,
                    roomNumber: message.room?.number?.toString() ?? null,
                    lastMessage: message.content,
                    lastMessageAt: message.createdAt?.toISOString() || new Date().toISOString(),
                    unreadCount: 0,
                });
            }

            if (message.receiverId === userId && !message.isRead) {
                const conversation = conversationMap.get(key);
                if (conversation) {
                    conversation.unreadCount += 1;
                }
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
                    and(eq(messages.senderId, participantId), eq(messages.receiverId, userId)),
                ),
            ),
            with: {
                sender: { columns: { id: true, fullName: true, userType: true } },
                receiver: { columns: { id: true, fullName: true, userType: true } },
                room: { columns: { id: true, number: true } },
            },
            orderBy: (messageTable, { asc }) => [asc(messageTable.createdAt)],
        });

        const firstMessage = allMessages[0];
        const lastMessage = allMessages.at(-1);
        const participant = firstMessage
            ? (firstMessage.senderId === userId ? firstMessage.receiver : firstMessage.sender)
            : null;
        const firstRoomMessage = allMessages.find(message => message.room);

        const conversation = {
            id: participantId,
            participantId,
            guestName: participant?.fullName || 'Unknown',
            roomId: firstRoomMessage?.room?.id ?? null,
            roomNumber: firstRoomMessage?.room?.number?.toString() ?? null,
            lastMessage: lastMessage?.content || '',
            lastMessageAt: lastMessage?.createdAt?.toISOString() || '',
            unreadCount: allMessages.filter(message => message.receiverId === userId && !message.isRead).length,
        };

        const formattedMessages = allMessages.map(message => ({
            id: message.id,
            content: message.content,
            senderId: message.senderId,
            senderName: message.sender?.fullName || 'Unknown',
            senderType: message.sender?.userType || 'STAFF',
            recipientId: message.receiverId,
            roomId: message.room?.id ?? null,
            roomNumber: message.room?.number?.toString() ?? null,
            isRead: message.isRead ?? false,
            createdAt: message.createdAt?.toISOString() || '',
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
                eq(messages.isRead, false),
            ))
            .returning();

        return { markedCount: updated.length };
    },

    async getStaffList(hotelId: number, currentUserId: string) {
        const staffMembers = await db.query.users.findMany({
            where: and(eq(users.hotelId, hotelId), eq(users.userType, 'HOTEL_STAFF')),
            columns: {
                id: true,
                fullName: true,
                userType: true,
            },
            with: {
                role: { columns: { name: true } },
            },
        });

        return staffMembers
            .filter(user => user.id !== currentUserId)
            .map(user => ({
                id: user.id,
                name: user.fullName,
                role: user.role?.name || 'Staff',
            }));
    },
};

