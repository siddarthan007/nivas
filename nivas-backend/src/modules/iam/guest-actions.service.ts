import { db } from '../../db';
import { rooms, bookings, housekeepingTasks, menuItems, orders, hotels } from '../../db/schema';
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

    async placeOrder(hotelId: number, roomId: number, userId: string, items: { menuItemId: number; quantity: number; notes?: string }[], deliveryTo?: 'ROOM' | 'RESTAURANT', orderNotes?: string) {
        const booking = await db.query.bookings.findFirst({
            where: and(
                eq(bookings.roomId, roomId),
                eq(bookings.hotelId, hotelId),
                eq(bookings.status, 'CHECKED_IN')
            )
        });

        if (!booking) throw new NotFoundError('Active booking');

        const orderType = deliveryTo === 'RESTAURANT' ? 'DINE_IN' : 'ROOM_SERVICE';

        const newOrder = await OrdersService.createOrder(hotelId, userId, {
            roomId,
            bookingId: booking.id,
            customerName: booking.guestName,
            orderType,
            notes: orderNotes,
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

    /**
     * Unified activity feed for a room: food orders + service (housekeeping/amenity)
     * requests, newest first. Lets the guest portal track progress of EVERYTHING
     * they requested in one place (previously service requests were invisible).
     */
    async getActivity(hotelId: number, roomId: number) {
        const [guestOrders, tasks] = await Promise.all([
            db.query.orders.findMany({
                where: and(
                    eq(orders.roomId, roomId),
                    eq(orders.hotelId, hotelId)
                ),
                with: {
                    items: { with: { menuItem: { columns: { name: true } } } }
                },
                orderBy: (orders, { desc }) => [desc(orders.createdAt)],
                limit: 40,
            }),
            db.query.housekeepingTasks.findMany({
                where: and(
                    eq(housekeepingTasks.roomId, roomId),
                    eq(housekeepingTasks.hotelId, hotelId)
                ),
                orderBy: (housekeepingTasks, { desc }) => [desc(housekeepingTasks.createdAt)],
                limit: 40,
            }),
        ]);

        const orderActivity = guestOrders.map(o => ({
            id: `order-${o.id}`,
            kind: 'ORDER' as const,
            type: o.orderType || 'ROOM_SERVICE',
            status: o.status || 'PENDING',
            orderNumber: o.orderNumber,
            totalAmount: parseFloat(o.totalAmount),
            notes: o.items.map(i => i.notes).filter(Boolean).join('; ') || undefined,
            createdAt: o.createdAt,
            items: o.items.map(i => ({
                name: i.menuItem?.name ?? 'Item',
                quantity: i.quantity,
                price: parseFloat(i.price),
            })),
        }));

        const serviceActivity = tasks.map(t => ({
            id: `task-${t.id}`,
            kind: 'SERVICE' as const,
            type: t.taskType || 'CLEANING',
            status: t.status || 'PENDING',
            orderNumber: undefined,
            totalAmount: undefined,
            notes: t.notes ?? undefined,
            createdAt: t.createdAt,
            items: [] as { name: string; quantity: number; price: number }[],
        }));

        return [...orderActivity, ...serviceActivity].sort((a, b) => {
            const ta = a.createdAt ? new Date(a.createdAt as any).getTime() : 0;
            const tb = b.createdAt ? new Date(b.createdAt as any).getTime() : 0;
            return tb - ta;
        });
    },

    async getPortalConfig(hotelId: number) {
        const hotel = await db.query.hotels.findFirst({
            where: eq(hotels.id, hotelId),
            columns: {
                name: true,
                phone: true,
                email: true,
                address: true,
                guestPortalConfig: true,
            }
        });
        if (!hotel) throw new NotFoundError('Hotel');
        const config = (hotel.guestPortalConfig || {}) as Record<string, any>;
        return {
            hotelName: hotel.name,
            hotelPhone: hotel.phone,
            hotelEmail: hotel.email,
            hotelAddress: hotel.address,
            welcomeMessage: config.welcomeMessage || `Welcome to ${hotel.name}!`,
            wifiNetworks: Array.isArray(config.wifiNetworks) ? config.wifiNetworks : [],
            contactNumbers: config.contactNumbers || {},
            socialLinks: config.socialLinks || {},
            customSections: Array.isArray(config.customSections) ? config.customSections : [],
            showBillBreakdown: config.showBillBreakdown !== false,
            showOrderProgress: config.showOrderProgress !== false,
        };
    },

    async requestHousekeeping(hotelId: number, roomId: number, taskType: any, notes?: string) {
        // Stale-token guard: only an actively checked-in room can request service.
        const activeBooking = await db.query.bookings.findFirst({
            where: and(
                eq(bookings.roomId, roomId),
                eq(bookings.hotelId, hotelId),
                eq(bookings.status, 'CHECKED_IN')
            )
        });
        if (!activeBooking) throw new ForbiddenError('No active stay for this room');

        const type = taskType || 'CLEANING';

        // Anti-spam: collapse repeat requests of the same type that are still open.
        const pending = await db.query.housekeepingTasks.findFirst({
            where: and(
                eq(housekeepingTasks.hotelId, hotelId),
                eq(housekeepingTasks.roomId, roomId),
                eq(housekeepingTasks.taskType, type),
                eq(housekeepingTasks.status, 'PENDING')
            )
        });
        if (pending) {
            throw new BusinessLogicError(`A ${type.toLowerCase()} request is already pending for your room`);
        }

        const [task] = await db.insert(housekeepingTasks).values({
            hotelId,
            roomId,
            taskType: type,
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
