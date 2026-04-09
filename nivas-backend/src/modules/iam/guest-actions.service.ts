import { db } from '../../db';
import { rooms, bookings, housekeepingTasks, menuItems, orders } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { BusinessLogicError, ForbiddenError, NotFoundError } from '../../utils/errors';
import { EventBus } from '../../shared/event-bus';
import { OrdersService } from '../orders/orders.service';

export const GuestActionsService = {
    async validateGuestAccess(user: any) {
        if (!user || !user.roomId || (user.type !== 'GUEST' && !String(user.id).startsWith('guest-'))) {
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

        EventBus.emit({
            type: 'GuestDndToggled',
            hotelId,
            source: 'guest-actions',
            timestamp: new Date(),
            payload: { roomId, enabled },
        }).catch(() => {});
    },

    async requestCheckout(hotelId: number, roomId: number) {
        const booking = await db.query.bookings.findFirst({
            where: and(
                eq(bookings.roomId, roomId),
                eq(bookings.status, 'CHECKED_IN')
            )
        });

        if (!booking) throw new NotFoundError('Active booking');

        EventBus.emit({
            type: 'GuestCheckoutRequested',
            hotelId,
            source: 'guest-actions',
            timestamp: new Date(),
            payload: {
                roomId,
                guestName: booking.guestName,
                bookingId: booking.id,
            },
        }).catch(() => {});
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
                eq(bookings.hotelId, hotelId),
                eq(bookings.status, 'CHECKED_IN')
            )
        });

        if (!booking) throw new NotFoundError('Active booking');

        const newOrder = await OrdersService.createOrder(hotelId, userId, {
            roomId,
            bookingId: booking.id,
            customerName: booking.guestName,
            orderType: 'ROOM_SERVICE',
            items: items.map(i => ({
                menuItemId: i.menuItemId,
                quantity: i.quantity,
                price: 0,
                notes: i.notes
            }))
        });

        return {
            orderNumber: newOrder.orderNumber,
            totalAmount: parseFloat(newOrder.totalAmount),
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

        EventBus.emit({
            type: 'GuestHousekeepingRequested',
            hotelId,
            source: 'guest-actions',
            timestamp: new Date(),
            payload: {
                taskId: task.id.toString(),
                roomId,
                taskType: taskType || 'CLEANING',
                notes,
            },
        }).catch(() => {});

        return task;
    }
};
