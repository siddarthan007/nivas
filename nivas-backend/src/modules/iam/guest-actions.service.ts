import { db } from '../../db';
import { rooms, bookings, housekeepingTasks, orders, orderItems, menuItems } from '../../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { WSService as NotificationService } from '../notifications/ws.service';
import { BusinessLogicError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors';

export const GuestActionsService = {
    async validateGuestAccess(user: any) {
        if (user.type !== 'GUEST' || !user.roomId) {
            throw new ForbiddenError('Guest access required');
        }
        return { hotelId: user.hotelId!, roomId: user.roomId, userId: user.id };
    },

    async toggleDnd(hotelId: number, roomId: number, enabled: boolean) {
        await db.update(rooms)
            .set({
                dndStatus: enabled,
                updatedAt: new Date()
            })
            .where(eq(rooms.id, roomId));

        NotificationService.broadcastToRole(
            hotelId,
            ['Receptionist', 'House Keeping'],
            'DND_UPDATE',
            { roomId, status: enabled ? 'ON' : 'OFF' }
        );
    },

    async requestCheckout(hotelId: number, roomId: number) {
        const booking = await db.query.bookings.findFirst({
            where: and(
                eq(bookings.roomId, roomId),
                eq(bookings.status, 'CHECKED_IN')
            )
        });

        if (!booking) throw new NotFoundError('Active booking');

        NotificationService.broadcastToRole(
            hotelId,
            ['Receptionist'],
            'CHECKOUT_REQUEST',
            {
                roomId,
                guestName: booking.guestName,
                bookingId: booking.id
            }
        );
    },

    async getMenu(hotelId: number) {
        const menu = await db.query.menuItems.findMany({
            where: and(
                eq(menuItems.hotelId, hotelId),
                eq(menuItems.isAvailable, true)
            )
        });

        return menu.reduce((acc, item) => {
            const cat = item.category || 'Other';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push({
                id: item.id,
                name: item.name,
                description: item.description,
                price: parseFloat(item.price),
                imageUrl: item.imageUrl
            });
            return acc;
        }, {} as Record<string, any[]>);
    },

    async placeOrder(hotelId: number, roomId: number, userId: string, items: { menuItemId: number; quantity: number; notes?: string }[]) {
        const booking = await db.query.bookings.findFirst({
            where: and(
                eq(bookings.roomId, roomId),
                eq(bookings.status, 'CHECKED_IN')
            )
        });

        if (!booking) throw new NotFoundError('Active booking');

        const menuItemIds = items.map(i => i.menuItemId);
        const menuItemsData = await db.query.menuItems.findMany({
            where: and(
                inArray(menuItems.id, menuItemIds),
                eq(menuItems.hotelId, hotelId),
                eq(menuItems.isAvailable, true)
            )
        });

        if (menuItemsData.length !== menuItemIds.length) {
            throw new ValidationError('Some menu items are not available');
        }

        const priceMap = new Map(menuItemsData.map(m => [m.id, parseFloat(m.price)]));
        const totalAmount = items.reduce((sum, item) =>
            sum + (priceMap.get(item.menuItemId) ?? 0) * item.quantity, 0);

        const orderNumber = `RS-${Date.now()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

        const [newOrder] = await db.insert(orders).values({
            hotelId,
            roomId,
            bookingId: booking.id,
            orderNumber,
            customerName: booking.guestName,
            totalAmount: totalAmount.toString(),
            orderType: 'ROOM_SERVICE',
            status: 'PENDING',
            createdById: userId
        }).returning();

        if (!newOrder) throw new BusinessLogicError('Failed to create order');

        await db.insert(orderItems).values(
            items.map(item => ({
                orderId: newOrder.id,
                menuItemId: item.menuItemId,
                quantity: item.quantity,
                price: (priceMap.get(item.menuItemId) ?? 0).toString(),
                notes: item.notes
            }))
        );

        // Notifications
        NotificationService.broadcastToRole(
            hotelId,
            ['Kitchen', 'Chef'],
            'NEW_ORDER',
            {
                orderId: newOrder.id,
                orderNumber,
                roomNumber: roomId,
                guestName: booking.guestName,
                items: items.map(i => ({
                    name: menuItemsData.find(m => m.id === i.menuItemId)?.name,
                    quantity: i.quantity,
                    notes: i.notes
                })),
                totalAmount
            }
        );

        NotificationService.broadcastToRole(
            hotelId,
            ['Receptionist'],
            'ROOM_SERVICE_ORDER',
            {
                orderNumber,
                roomId,
                guestName: booking.guestName,
                total: totalAmount
            }
        );

        return {
            orderNumber,
            totalAmount,
            estimatedTime: '20-30 minutes'
        };
    },

    async getOrderHistory(hotelId: number, roomId: number) {
        const guestOrders = await db.query.orders.findMany({
            where: and(
                eq(orders.roomId, roomId),
                eq(orders.hotelId, hotelId)
            ),
            with: {
                items: {
                    with: { menuItem: { columns: { name: true } } }
                }
            },
            orderBy: (orders, { desc }) => [desc(orders.createdAt)]
        });

        return guestOrders.map(o => ({
            orderNumber: o.orderNumber,
            status: o.status,
            totalAmount: parseFloat(o.totalAmount),
            createdAt: o.createdAt,
            items: o.items.map(i => ({
                name: i.menuItem.name,
                quantity: i.quantity,
                price: parseFloat(i.price)
            }))
        }));
    },

    async requestHousekeeping(hotelId: number, roomId: number, taskType: any, notes?: string) {
        const [task] = await db.insert(housekeepingTasks).values({
            hotelId,
            roomId,
            taskType: taskType || 'CLEANING',
            priority: 'NORMAL',
            status: 'PENDING',
            notes
        }).returning();

        if (!task) throw new BusinessLogicError('Failed to create housekeeping task');

        NotificationService.broadcastToRole(
            hotelId,
            ['House Keeping', 'Receptionist'],
            'HOUSEKEEPING_REQUEST',
            {
                taskId: task.id,
                roomId,
                taskType: taskType || 'CLEANING',
                notes,
                message: `Room ${roomId} requests ${taskType || 'cleaning'} service`
            }
        );

        return task;
    }
};
