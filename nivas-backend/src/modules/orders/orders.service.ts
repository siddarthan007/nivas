import { db } from '../../db';
import { orders, orderItems, menuItems, bookings, guests } from '../../db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { BusinessLogicError, NotFoundError } from '../../utils/errors';
import { EventBus } from '../../shared/event-bus';
import { logAction } from '../system/audit.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isStaffUserId(userId: string): boolean {
    return UUID_RE.test(userId);
}

export class OrdersService {
    static async createOrder(hotelId: number, userId: string, data: {
        roomId?: number;
        customerName?: string;
        orderType: string;
        bookingId?: string;
        guestId?: string;
        restaurantTableId?: number;
        tableId?: number;
        outletId?: number;
        items: {
            menuItemId: number;
            quantity: number;
            price: number;
            notes?: string;
        }[];
    }) {
        const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

        const newOrder = await db.transaction(async (tx) => {
            const menuItemIds = data.items.map(i => i.menuItemId);
            const menuItemsData = await tx.query.menuItems.findMany({
                where: and(
                    inArray(menuItems.id, menuItemIds),
                    eq(menuItems.hotelId, hotelId)
                )
            });

            const priceMap = new Map(menuItemsData.map(m => [m.id, parseFloat(m.price)]));

            if (menuItemsData.length !== menuItemIds.length) {
                const foundIds = new Set(menuItemsData.map(m => m.id));
                const missing = menuItemIds.filter(id => !foundIds.has(id));
                if (missing.length > 0) {
                    throw new BusinessLogicError(`Menu items not found: ${missing.join(', ')}`);
                }
            }

            const totalAmount = data.items.reduce((sum, item) =>
                sum + (priceMap.get(item.menuItemId) ?? 0) * item.quantity, 0);

            let resolvedGuestId = data.guestId;
            if (!resolvedGuestId && data.bookingId) {
                const booking = await tx.query.bookings.findFirst({
                    where: and(eq(bookings.id, data.bookingId), eq(bookings.hotelId, hotelId)),
                    columns: { guestId: true }
                });
                if (booking?.guestId) {
                    resolvedGuestId = booking.guestId;
                }
            }

            const [createdOrder] = await tx.insert(orders).values({
                hotelId,
                roomId: data.roomId,
                bookingId: data.bookingId,
                orderNumber,
                customerName: data.customerName,
                totalAmount: totalAmount.toString(),
                orderType: data.orderType,
                status: 'PENDING',
                ...(isStaffUserId(userId) ? { createdById: userId } : {}),
                guestId: resolvedGuestId,
                restaurantTableId: data.restaurantTableId ?? data.tableId,
                outletId: data.outletId,
            }).returning();

            if (!createdOrder) {
                throw new BusinessLogicError('Failed to create order');
            }

            await tx.insert(orderItems).values(
                data.items.map((item) => ({
                    orderId: createdOrder.id,
                    menuItemId: item.menuItemId,
                    quantity: item.quantity,
                    price: (priceMap.get(item.menuItemId) ?? 0).toString(),
                    notes: item.notes
                }))
            );

            return createdOrder;
        });

        EventBus.emit({
            type: 'OrderPlaced',
            hotelId,
            source: 'orders',
            timestamp: new Date(),
            payload: {
                orderId: newOrder.id,
                orderNumber,
                orderType: data.orderType,
                totalAmount: newOrder.totalAmount,
                itemCount: data.items.length,
                roomId: data.roomId,
            },
        }).catch(() => {});

        await logAction(
            hotelId,
            isStaffUserId(userId) ? userId : null,
            'CREATE_ORDER',
            'ORDER',
            newOrder.id.toString(),
            { orderNumber, totalAmount: newOrder.totalAmount, itemCount: data.items.length, portalActor: userId }
        );

        return newOrder;
    }

    static async getOrders(hotelId: number, filters?: { status?: string[], type?: string }) {
        const conditions = [eq(orders.hotelId, hotelId)];

        if (filters?.status && filters.status.length > 0) {
            conditions.push(inArray(orders.status, filters.status as any[]));
        }

        // If type is specific, filter by it. If it's 'kitchen', we currently return all types 
        // until we have a way to distinguish 'food' vs 'bar' orders.
        if (filters?.type && filters.type !== 'kitchen') {
            conditions.push(eq(orders.orderType, filters.type));
        }

        return await db.query.orders.findMany({
            where: and(...conditions),
            with: {
                items: {
                    with: {
                        menuItem: true
                    }
                },
                room: true,
                createdBy: {
                    columns: {
                        fullName: true
                    }
                }
            },
            orderBy: (orders, { desc }) => [desc(orders.createdAt)]
        });
    }

    static async getOrderById(hotelId: number, orderId: string) {
        const order = await db.query.orders.findFirst({
            where: and(
                eq(orders.id, orderId),
                eq(orders.hotelId, hotelId)
            ),
            with: {
                items: {
                    with: {
                        menuItem: true
                    }
                },
                room: true,
                createdBy: {
                    columns: {
                        fullName: true
                    }
                }
            }
        });

        if (!order) throw new NotFoundError('Order');
        return order;
    }

    static async updateOrder(hotelId: number, userId: string, orderId: string, data: {
        customerName?: string;
        roomId?: number;
        items?: { menuItemId: number; quantity: number; price: number; notes?: string }[];
    }) {
        return await db.transaction(async (tx) => {
            const existing = await tx.query.orders.findFirst({
                where: and(eq(orders.id, orderId), eq(orders.hotelId, hotelId))
            });

            if (!existing) throw new NotFoundError('Order');

            if (existing.status === 'SERVED' || existing.status === 'CANCELLED') {
                throw new BusinessLogicError('Cannot edit a served or cancelled order');
            }

            const updateData: Record<string, any> = { updatedAt: new Date() };
            if (data.customerName !== undefined) updateData.customerName = data.customerName;
            if (data.roomId !== undefined) updateData.roomId = data.roomId;

            if (data.items && data.items.length > 0) {
                const menuItemIds = data.items.map(i => i.menuItemId);
                const menuItemsData = await tx.query.menuItems.findMany({
                    where: and(
                        inArray(menuItems.id, menuItemIds),
                        eq(menuItems.hotelId, hotelId)
                    )
                });
                const priceMap = new Map(menuItemsData.map(m => [m.id, parseFloat(m.price)]));

                const totalAmount = data.items.reduce((sum, item) =>
                    sum + (priceMap.get(item.menuItemId) ?? 0) * item.quantity, 0);
                updateData.totalAmount = totalAmount.toString();

                await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));

                await tx.insert(orderItems).values(
                    data.items.map((item) => ({
                        orderId,
                        menuItemId: item.menuItemId,
                        quantity: item.quantity,
                        price: (priceMap.get(item.menuItemId) ?? 0).toString(),
                        notes: item.notes
                    }))
                );
            }

            const [updated] = await tx.update(orders)
                .set(updateData)
                .where(and(eq(orders.id, orderId), eq(orders.hotelId, hotelId)))
                .returning();

            await logAction(hotelId, userId, 'UPDATE_ORDER', 'ORDER', orderId, {
                orderNumber: existing.orderNumber,
                changes: data
            });

            return updated;
        });
    }

    static async cancelOrder(hotelId: number, userId: string, orderId: string, reason?: string) {
        return await db.transaction(async (tx) => {
            const existing = await tx.query.orders.findFirst({
                where: and(eq(orders.id, orderId), eq(orders.hotelId, hotelId))
            });

            if (!existing) throw new NotFoundError('Order');

            if (existing.status === 'SERVED' || existing.status === 'CANCELLED') {
                throw new BusinessLogicError('Cannot cancel a served or already cancelled order');
            }

            const [cancelled] = await tx.update(orders)
                .set({ status: 'CANCELLED', updatedAt: new Date() })
                .where(and(eq(orders.id, orderId), eq(orders.hotelId, hotelId)))
                .returning();

            await logAction(hotelId, userId, 'CANCEL_ORDER', 'ORDER', orderId, {
                orderNumber: existing.orderNumber,
                reason: reason || 'No reason provided'
            });

            return cancelled;
        });
    }

    static async updateStatus(hotelId: number, userId: string, orderId: string, status: string) {
        const [updatedOrder] = await db.update(orders)
            .set({
                status: status as any,
                updatedAt: new Date()
            })
            .where(and(
                eq(orders.id, orderId),
                eq(orders.hotelId, hotelId)
            ))
            .returning();

        if (!updatedOrder) throw new NotFoundError('Order');

        EventBus.emit({
            type: 'OrderStatusChanged',
            hotelId,
            source: 'orders',
            timestamp: new Date(),
            payload: {
                orderId: updatedOrder.id,
                orderNumber: updatedOrder.orderNumber,
                status,
            },
        }).catch(() => {});

        await logAction(
            hotelId,
            userId,
            'UPDATE_ORDER_STATUS',
            'ORDER',
            orderId,
            { newStatus: status, orderNumber: updatedOrder.orderNumber }
        );

        return updatedOrder;
    }
}
