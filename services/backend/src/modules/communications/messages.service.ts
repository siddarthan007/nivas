import { db } from '../../db';
import { messages, users, rooms } from '../../db/schema';
import { eq, and, or, asc, desc } from 'drizzle-orm';
import { NotFoundError, BusinessLogicError } from '../../utils/errors';
import { WSService } from '../notifications/ws.service';
import { NOTIFY_ROLES } from '../notifications/notification-roles';
import { relationOne } from '../../utils/relation';

export const MessagesService = {
    async sendMessage(hotelId: number, senderId: string, data: { receiverId?: string; roomId?: number; content: string; messageType?: string }) {
        if (!data.receiverId && !data.roomId) {
            throw new BusinessLogicError('A recipient (user or room) is required');
        }
        // Confirm the recipient belongs to this hotel — blocks cross-tenant /
        // orphaned messages to arbitrary user ids.
        if (data.receiverId) {
            const recipient = await db.query.users.findFirst({
                where: and(eq(users.id, data.receiverId), eq(users.hotelId, hotelId)),
                columns: { id: true, fullName: true },
            });
            if (!recipient) throw new NotFoundError('Recipient not found in this hotel');
        }
        if (data.roomId) {
            const room = await db.query.rooms.findFirst({
                where: and(eq(rooms.id, data.roomId), eq(rooms.hotelId, hotelId)),
                columns: { id: true },
            });
            if (!room) throw new NotFoundError('Room not found in this hotel');
        }

        const sender = await db.query.users.findFirst({
            where: and(eq(users.id, senderId), eq(users.hotelId, hotelId)),
            columns: { fullName: true },
        });

        const [message] = await db.insert(messages).values({
            hotelId,
            senderId,
            receiverId: data.receiverId,
            roomId: data.roomId,
            content: data.content,
            messageType: data.messageType || 'TEXT',
        }).returning();

        // Push to the recipient so their UI updates live instead of polling.
        if (data.receiverId) {
            const preview = data.content.length > 120 ? `${data.content.slice(0, 117)}...` : data.content;
            WSService.sendToUser(hotelId, data.receiverId, 'NEW_MESSAGE', {
                from: senderId,
                senderId,
                senderName: sender?.fullName || 'Staff',
                messageId: message?.id,
                title: `Message from ${sender?.fullName || 'Staff'}`,
                message: preview,
                href: '/messages',
            }).catch(() => { /* non-fatal */ });
        } else if (data.roomId) {
            const room = await db.query.rooms.findFirst({
                where: and(eq(rooms.id, data.roomId), eq(rooms.hotelId, hotelId)),
                columns: { number: true },
            });
            const preview = data.content.length > 120 ? `${data.content.slice(0, 117)}...` : data.content;
            const roomLabel = room?.number ? `Room ${room.number}` : `Room #${data.roomId}`;
            WSService.broadcastToRole(
                hotelId,
                [...NOTIFY_ROLES.FRONT_DESK, ...NOTIFY_ROLES.HOUSEKEEPING] as unknown as string[],
                'NEW_MESSAGE',
                {
                    from: senderId,
                    senderId,
                    senderName: sender?.fullName || 'Staff',
                    roomId: data.roomId,
                    roomNumber: room?.number,
                    messageId: message?.id,
                    title: `Message for ${roomLabel}`,
                    message: preview,
                    href: '/messages',
                },
            ).catch(() => { /* non-fatal */ });
        }

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
            const otherUser = relationOne(isOwnMessage ? message.receiver : message.sender);
            const room = relationOne(message.room);
            const key = otherUserId ?? `room-${message.roomId ?? 'unknown'}`;

            if (!conversationMap.has(key)) {
                conversationMap.set(key, {
                    id: key,
                    participantId: otherUserId ?? null,
                    participantName: otherUser?.fullName || 'Unknown',
                    roomId: room?.id ?? null,
                    roomNumber: room?.number?.toString() ?? null,
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
            ? relationOne(firstMessage.senderId === userId ? firstMessage.receiver : firstMessage.sender)
            : null;
        const firstRoomMessage = allMessages.find(message => message.room);
        const firstRoom = firstRoomMessage ? relationOne(firstRoomMessage.room) : null;

        const conversation = {
            id: participantId,
            participantId,
            guestName: participant?.fullName || 'Unknown',
            roomId: firstRoom?.id ?? null,
            roomNumber: firstRoom?.number?.toString() ?? null,
            lastMessage: lastMessage?.content || '',
            lastMessageAt: lastMessage?.createdAt?.toISOString() || '',
            unreadCount: allMessages.filter(message => message.receiverId === userId && !message.isRead).length,
        };

        const formattedMessages = allMessages.map(message => {
            const sender = relationOne(message.sender);
            const room = relationOne(message.room);
            return {
            id: message.id,
            content: message.content,
            senderId: message.senderId,
            senderName: sender?.fullName || 'Unknown',
            senderType: sender?.userType || 'STAFF',
            recipientId: message.receiverId,
            roomId: room?.id ?? null,
            roomNumber: room?.number?.toString() ?? null,
            isRead: message.isRead ?? false,
            createdAt: message.createdAt?.toISOString() || '',
        };
        });

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
            .map(user => {
                const role = relationOne((user as { role?: { name: string } | { name: string }[] | null }).role);
                return {
                id: user.id,
                name: user.fullName,
                role: role?.name || 'Staff',
            };
            });
    },
};

