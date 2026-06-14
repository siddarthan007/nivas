import { db } from '../../db';
import { orders, orderItems, menuItems, bookings, guests, hotels, restaurantTables, payments } from '../../db/schema';
import { eq, and, or, ilike, desc, inArray } from 'drizzle-orm';
import { BusinessLogicError, NotFoundError } from '../../utils/errors';
import { EventBus } from '../../shared/event-bus';
import { logAction } from '../system/audit.service';
import { CouponsService } from '../coupons/coupons.service';
import { occupyTable, syncTableStatus } from '../operations/table-status.service';
import { logger } from '../../shared/logger';
import { validateMergeSources } from './orders-pos.util';
import { syncOrderPaymentStatus } from './order-payment.util';
import { computeOrderGross, verifyFonepayPrn, resolveCouponDiscount } from './orders-checkout.util';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function withTableAlias<T extends { restaurantTableId?: number | null }>(order: T) {
    return { ...order, tableId: order.restaurantTableId ?? null };
}

function isStaffUserId(userId: string): boolean {
    return UUID_RE.test(userId);
}

export class OrdersService {
    static async createOrder(hotelId: number, userId: string, data: {
        roomId?: number;
        customerName?: string;
        orderType: string;
        notes?: string;
        bookingId?: string;
        guestId?: string;
        restaurantTableId?: number;
        tableId?: number;
        outletId?: number;
        applyVat?: boolean;
        applyServiceCharge?: boolean;
        discountAmount?: number;
        couponId?: number;
        applyLoyalty?: boolean;
        paymentMethod?: string;
        transactionId?: string;
        cashTendered?: number;
        items: {
            menuItemId: number;
            quantity: number;
            price: number;
            notes?: string;
        }[];
    }) {
        const orderNumber = `ORD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

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

            // Block ordering sold-out / unavailable items.
            const unavailable = menuItemsData.filter(m => m.isAvailable === false);
            if (unavailable.length > 0) {
                throw new BusinessLogicError(`Currently unavailable: ${unavailable.map(m => m.name).join(', ')}`);
            }

            const subTotal = data.items.reduce((sum, item) =>
                sum + (priceMap.get(item.menuItemId) ?? 0) * item.quantity, 0);

            // Fetch hotel tax settings for default rates
            const hotel = await tx.query.hotels.findFirst({
                where: eq(hotels.id, hotelId),
                columns: { taxRate: true, serviceChargeRate: true }
            });
            const vatRate = parseFloat(hotel?.taxRate || '0.13');
            const serviceChargeRate = parseFloat(hotel?.serviceChargeRate || '0.10');

            const applyVat = data.applyVat ?? false;
            const applyServiceCharge = data.applyServiceCharge ?? false;

            const serviceChargeAmount = applyServiceCharge ? subTotal * serviceChargeRate : 0;
            const vatAmount = applyVat ? (subTotal + serviceChargeAmount) * vatRate : 0;
            const grossBeforeDiscount = subTotal + serviceChargeAmount + vatAmount;

            let couponDiscount = 0;
            let resolvedCouponId = data.couponId;
            if (data.couponId) {
                const couponResult = await CouponsService.validateById(hotelId, data.couponId, grossBeforeDiscount, 'FNB');
                couponDiscount = couponResult.discount;
                resolvedCouponId = couponResult.couponId;
            }

            // Optional loyalty discount — only when hotel enabled rules AND client opts in
            let loyaltyDiscount = 0;
            let loyaltyNote: string | undefined;
            if (data.applyLoyalty === true && couponDiscount === 0 && !data.couponId) {
                const { LoyaltyService } = await import('../crm/loyalty.service');
                const { discountAmount, loyalty } = await LoyaltyService.computeDiscountAmount(
                    hotelId,
                    grossBeforeDiscount,
                    { guestId: data.guestId, bookingId: data.bookingId },
                );
                if (loyalty && discountAmount > 0) {
                    loyaltyDiscount = discountAmount;
                    loyaltyNote = loyalty.reason;
                }
            }

            const discountAmount = Math.min(
                Math.max(couponDiscount + loyaltyDiscount, 0),
                grossBeforeDiscount,
            );
            const totalAmount = grossBeforeDiscount - discountAmount;

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

            // Check for mergeable order
            let mergeableOrder = null;
            if (data.orderType === 'DINE_IN' && (data.restaurantTableId ?? data.tableId)) {
                mergeableOrder = await tx.query.orders.findFirst({
                    where: and(
                        eq(orders.hotelId, hotelId),
                        eq(orders.restaurantTableId, data.restaurantTableId ?? data.tableId!),
                        inArray(orders.status, ['PENDING', 'PREPARING'])
                    )
                });
            } else if (data.orderType === 'ROOM_SERVICE' && data.roomId) {
                mergeableOrder = await tx.query.orders.findFirst({
                    where: and(
                        eq(orders.hotelId, hotelId),
                        eq(orders.roomId, data.roomId),
                        inArray(orders.status, ['PENDING', 'PREPARING'])
                    )
                });
            }

            if (mergeableOrder) {
                // Merge into existing order
                const mergedSubTotal = parseFloat(mergeableOrder.subTotal || '0') + subTotal;
                const mergedServiceCharge = applyServiceCharge ? mergedSubTotal * serviceChargeRate : 0;
                const mergedVat = applyVat ? (mergedSubTotal + mergedServiceCharge) * vatRate : 0;
                const mergedDiscount = Math.min(Math.max(data.discountAmount ?? parseFloat(mergeableOrder.discountAmount || '0'), 0), mergedSubTotal + mergedServiceCharge + mergedVat);
                const mergedTotal = mergedSubTotal + mergedServiceCharge + mergedVat - mergedDiscount;

                const [updatedOrder] = await tx.update(orders).set({
                    subTotal: mergedSubTotal.toFixed(2),
                    serviceChargeAmount: mergedServiceCharge.toFixed(2),
                    vatAmount: mergedVat.toFixed(2),
                    discountAmount: mergedDiscount.toFixed(2),
                    totalAmount: mergedTotal.toFixed(2),
                    updatedAt: new Date()
                }).where(eq(orders.id, mergeableOrder.id)).returning();

                await tx.insert(orderItems).values(
                    data.items.map((item) => ({
                        orderId: mergeableOrder.id,
                        menuItemId: item.menuItemId,
                        quantity: item.quantity,
                        price: (priceMap.get(item.menuItemId) ?? 0).toString(),
                        notes: item.notes
                    }))
                );

                return updatedOrder;
            }

            // Create new order
            const [createdOrder] = await tx.insert(orders).values({
                hotelId,
                roomId: data.roomId,
                bookingId: data.bookingId,
                orderNumber,
                customerName: data.customerName,
                totalAmount: totalAmount.toFixed(2),
                subTotal: subTotal.toFixed(2),
                vatAmount: vatAmount.toFixed(2),
                serviceChargeAmount: serviceChargeAmount.toFixed(2),
                discountAmount: discountAmount.toFixed(2),
                couponId: resolvedCouponId,
                vatRate: vatRate.toFixed(4),
                serviceChargeRate: serviceChargeRate.toFixed(4),
                applyVat,
                applyServiceCharge,
                orderType: data.orderType,
                notes: data.notes,
                status: 'PENDING',
                paymentStatus: data.paymentMethod ? 'PAID' : 'UNPAID',
                ...(isStaffUserId(userId) ? { createdById: userId } : {}),
                guestId: resolvedGuestId,
                restaurantTableId: data.restaurantTableId ?? data.tableId,
                outletId: data.outletId,
            } as any).returning();

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

            if (data.paymentMethod) {
                if (data.paymentMethod === 'FONEPAY') {
                    await verifyFonepayPrn(hotelId, data.transactionId, totalAmount);
                }
                await tx.insert(payments).values({
                    hotelId,
                    orderId: createdOrder.id,
                    bookingId: data.bookingId,
                    amount: totalAmount.toFixed(2),
                    paymentMethod: data.paymentMethod as any,
                    transactionId: data.transactionId || `POS-${createdOrder.orderNumber}`,
                    recordedById: isStaffUserId(userId) ? userId : null,
                } as any);
            }

            // Dine-in order seats a table → mark it occupied.
            if (data.orderType === 'DINE_IN' && createdOrder.restaurantTableId) {
                await occupyTable(tx, hotelId, createdOrder.restaurantTableId);
            }

            return createdOrder;
        });

        if (!newOrder) throw new BusinessLogicError('Failed to create order');

        // Consume the coupon now that the order is committed.
        if (data.couponId) {
            await CouponsService.redeem(hotelId, data.couponId)
                .catch(err => logger.error({ err }, 'Failed to redeem coupon'));
        }

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

    static async getOrders(hotelId: number, filters?: { status?: string[], type?: string, search?: string }) {
        const conditions = [eq(orders.hotelId, hotelId)];

        if (filters?.status && filters.status.length > 0) {
            conditions.push(inArray(orders.status, filters.status as any[]));
        }

        // If type is specific, filter by it. If it's 'kitchen', we currently return all types
        // until we have a way to distinguish 'food' vs 'bar' orders.
        if (filters?.type && filters.type !== 'kitchen') {
            conditions.push(eq(orders.orderType, filters.type));
        }

        // Server-side search across order number / customer name (so results aren't
        // limited to the 300-row board cap).
        const term = (filters?.search || '').trim();
        if (term) {
            const like = `%${term}%`;
            conditions.push(or(ilike(orders.orderNumber, like), ilike(orders.customerName, like)) as any);
        }

        return (await db.query.orders.findMany({
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
            orderBy: (orders, { desc }) => [desc(orders.createdAt)],
            // Cap the result so a busy hotel doesn't load its entire order history
            // (with item/menu joins) on every poll. The board only needs recent orders.
            limit: 300,
        })).map(withTableAlias);
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

        await db.transaction(async (tx) => {
            await syncOrderPaymentStatus(tx, hotelId, orderId);
        });

        const refreshed = await db.query.orders.findFirst({
            where: and(eq(orders.id, orderId), eq(orders.hotelId, hotelId)),
            with: {
                items: { with: { menuItem: true } },
                room: true,
                createdBy: { columns: { fullName: true } },
            },
        });
        return refreshed ?? order;
    }

    static async updateOrder(hotelId: number, userId: string, orderId: string, data: {
        orderType?: string;
        customerName?: string;
        roomId?: number;
        bookingId?: string;
        guestId?: string;
        restaurantTableId?: number;
        items?: { menuItemId: number; quantity: number; price: number; notes?: string }[];
        addToGuestBill?: boolean;
        applyVat?: boolean;
        applyServiceCharge?: boolean;
        discountAmount?: number;
        couponId?: number;
        paymentMethod?: string;
        transactionId?: string;
        cashTendered?: number;
        status?: string;
    }) {
        return await db.transaction(async (tx) => {
            const existing = await tx.query.orders.findFirst({
                where: and(eq(orders.id, orderId), eq(orders.hotelId, hotelId))
            });

            if (!existing) throw new NotFoundError('Order');

            // A served order is delivered → immutable. But a CANCELLED order can be
            // edited: doing so REOPENS it (back to PENDING) so the kitchen sees the
            // corrected ticket — real-world "cancelled by mistake / fix the items".
            if (existing.status === 'SERVED') {
                throw new BusinessLogicError('Cannot edit a served order');
            }
            const reopen = existing.status === 'CANCELLED';

            const updateData: Record<string, any> = { updatedAt: new Date() };
            if (reopen) updateData.status = 'PENDING';
            if (data.status && [...OrdersService.STATUS_FLOW, 'CANCELLED'].includes(data.status)) {
                updateData.status = data.status;
            }
            if (data.orderType !== undefined) updateData.orderType = data.orderType;
            if (data.customerName !== undefined) updateData.customerName = data.customerName;
            if (data.roomId !== undefined) updateData.roomId = data.roomId;
            if (data.bookingId !== undefined) updateData.bookingId = data.bookingId;
            if (data.guestId !== undefined) updateData.guestId = data.guestId;
            if (data.restaurantTableId !== undefined) updateData.restaurantTableId = data.restaurantTableId;
            if (data.addToGuestBill !== undefined) updateData.addToGuestBill = data.addToGuestBill;
            if (data.applyVat !== undefined) updateData.applyVat = data.applyVat;
            if (data.applyServiceCharge !== undefined) updateData.applyServiceCharge = data.applyServiceCharge;
            if (data.discountAmount !== undefined) updateData.discountAmount = data.discountAmount.toString();
            if (data.couponId !== undefined) updateData.couponId = data.couponId;

            if (data.items && data.items.length > 0) {
                const menuItemIds = data.items.map(i => i.menuItemId);
                const menuItemsData = await tx.query.menuItems.findMany({
                    where: and(
                        inArray(menuItems.id, menuItemIds),
                        eq(menuItems.hotelId, hotelId)
                    )
                });
                const priceMap = new Map(menuItemsData.map(m => [m.id, parseFloat(m.price)]));

                const subTotal = data.items.reduce((sum, item) =>
                    sum + (priceMap.get(item.menuItemId) ?? 0) * item.quantity, 0);

                // Recalculate taxes using existing order flags or incoming data
                const existing = await tx.query.orders.findFirst({
                    where: and(eq(orders.id, orderId), eq(orders.hotelId, hotelId)),
                    columns: { applyVat: true, applyServiceCharge: true, vatRate: true, serviceChargeRate: true, discountAmount: true }
                });
                const vatRate = parseFloat(existing?.vatRate || '0.13');
                const serviceChargeRate = parseFloat(existing?.serviceChargeRate || '0.10');
                const applyServiceCharge = data.applyServiceCharge !== undefined ? data.applyServiceCharge : (existing?.applyServiceCharge ?? false);
                const applyVat = data.applyVat !== undefined ? data.applyVat : (existing?.applyVat ?? false);

                const serviceChargeAmount = applyServiceCharge ? subTotal * serviceChargeRate : 0;
                const vatAmount = applyVat ? (subTotal + serviceChargeAmount) * vatRate : 0;
                // Preserve any existing discount or use incoming
                const incomingDiscount = data.discountAmount !== undefined ? data.discountAmount : parseFloat(existing?.discountAmount || '0');
                const discount = Math.min(incomingDiscount, subTotal + serviceChargeAmount + vatAmount);
                const totalAmount = Math.max(0, subTotal + serviceChargeAmount + vatAmount - discount);

                updateData.totalAmount = totalAmount.toFixed(2);
                updateData.subTotal = subTotal.toFixed(2);
                updateData.vatAmount = vatAmount.toFixed(2);
                updateData.serviceChargeAmount = serviceChargeAmount.toFixed(2);

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

            const shouldRecalcBilling =
                !data.items?.length && (
                    data.applyVat !== undefined ||
                    data.applyServiceCharge !== undefined ||
                    data.couponId !== undefined ||
                    data.discountAmount !== undefined
                );

            if (shouldRecalcBilling) {
                const existingItems = await tx.query.orderItems.findMany({
                    where: eq(orderItems.orderId, orderId),
                });
                const subTotal = existingItems.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0);
                const vatRate = parseFloat(existing.vatRate || '0.13');
                const serviceChargeRate = parseFloat(existing.serviceChargeRate || '0.10');
                const applyServiceCharge = data.applyServiceCharge !== undefined ? data.applyServiceCharge : (existing.applyServiceCharge ?? false);
                const applyVat = data.applyVat !== undefined ? data.applyVat : (existing.applyVat ?? false);
                const { serviceCharge: serviceChargeAmount, vat: vatAmount, gross } = computeOrderGross(
                    subTotal, applyServiceCharge, applyVat, serviceChargeRate, vatRate,
                );
                const couponId = data.couponId !== undefined ? data.couponId : existing.couponId ?? undefined;
                const { discount } = couponId
                    ? await resolveCouponDiscount(hotelId, couponId, gross, 'FNB')
                    : { discount: Math.min(data.discountAmount ?? parseFloat(existing.discountAmount || '0'), gross) };
                const totalAmount = Math.max(0, gross - discount);

                updateData.subTotal = subTotal.toFixed(2);
                updateData.serviceChargeAmount = serviceChargeAmount.toFixed(2);
                updateData.vatAmount = vatAmount.toFixed(2);
                updateData.discountAmount = discount.toFixed(2);
                updateData.totalAmount = totalAmount.toFixed(2);
                if (data.couponId !== undefined) updateData.couponId = data.couponId;
            }

            let paymentCreated = false;
            if (data.paymentMethod && data.paymentMethod !== 'UNPAID' && existing.paymentStatus !== 'PAID') {
                updateData.paymentStatus = 'PAID';
                const finalTotal = parseFloat(String(updateData.totalAmount ?? existing.totalAmount ?? '0'));
                if (data.paymentMethod === 'FONEPAY') {
                    await verifyFonepayPrn(hotelId, data.transactionId, finalTotal);
                }
                await tx.insert(payments).values({
                    hotelId,
                    orderId: existing.id,
                    bookingId: existing.bookingId,
                    amount: finalTotal.toFixed(2),
                    paymentMethod: data.paymentMethod as any,
                    transactionId: data.transactionId || `POS-${existing.orderNumber}`,
                    recordedById: isStaffUserId(userId) ? userId : null,
                } as any);
                paymentCreated = true;
            }

            const [updated] = await tx.update(orders)
                .set(updateData)
                .where(and(eq(orders.id, orderId), eq(orders.hotelId, hotelId)))
                .returning();

            if (!updated) throw new NotFoundError('Order');

            // Sync table status when order is paid or marked as served
            if ((updated.status === 'SERVED' || paymentCreated) && updated.restaurantTableId) {
                await syncTableStatus(tx, hotelId, updated.restaurantTableId);
            }

            await logAction(hotelId, userId, 'UPDATE_ORDER', 'ORDER', orderId, {
                orderNumber: existing.orderNumber,
                changes: data
            });

            return updated;
        });
    }

    /**
     * Void a single line item from an open order (wrong item, out of stock, guest
     * changed mind). Removes the item, recomputes totals, audits the reason. If it
     * was the last item, the order is cancelled.
     */
    static async voidOrderItem(hotelId: number, userId: string, orderId: string, itemId: number, reason?: string) {
        return await db.transaction(async (tx) => {
            const order = await tx.query.orders.findFirst({
                where: and(eq(orders.id, orderId), eq(orders.hotelId, hotelId)),
                columns: { id: true, status: true, orderNumber: true, applyVat: true, applyServiceCharge: true, vatRate: true, serviceChargeRate: true, discountAmount: true },
            });
            if (!order) throw new NotFoundError('Order');
            if (order.status === 'SERVED' || order.status === 'CANCELLED') {
                throw new BusinessLogicError('Cannot void items on a served or cancelled order');
            }

            const item = await tx.query.orderItems.findFirst({
                where: and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId)),
            });
            if (!item) throw new NotFoundError('Order item');

            await tx.delete(orderItems).where(eq(orderItems.id, itemId));

            const remaining = await tx.query.orderItems.findMany({ where: eq(orderItems.orderId, orderId) });

            // Last item voided → cancel the whole order (nothing left to make/bill).
            if (remaining.length === 0) {
                const [cancelled] = await tx.update(orders)
                    .set({ status: 'CANCELLED', totalAmount: '0', subTotal: '0', vatAmount: '0', serviceChargeAmount: '0', updatedAt: new Date() })
                    .where(eq(orders.id, orderId)).returning();
                await logAction(hotelId, userId, 'VOID_ORDER_ITEM', 'ORDER', orderId, { orderNumber: order.orderNumber, item: item.menuItemId, reason: reason || 'n/a', orderCancelled: true });
                await syncOrderPaymentStatus(tx, hotelId, orderId);
                return cancelled;
            }

            const subTotal = remaining.reduce((s, it) => s + parseFloat(it.price) * it.quantity, 0);
            const scRate = parseFloat(order.serviceChargeRate || '0.10');
            const vatRate = parseFloat(order.vatRate || '0.13');
            const sc = order.applyServiceCharge ? subTotal * scRate : 0;
            const vat = order.applyVat ? (subTotal + sc) * vatRate : 0;
            const discount = Math.min(parseFloat(order.discountAmount || '0'), subTotal + sc + vat);

            const [updated] = await tx.update(orders)
                .set({ subTotal: subTotal.toFixed(2), serviceChargeAmount: sc.toFixed(2), vatAmount: vat.toFixed(2), totalAmount: Math.max(0, subTotal + sc + vat - discount).toFixed(2), updatedAt: new Date() })
                .where(eq(orders.id, orderId)).returning();

            await logAction(hotelId, userId, 'VOID_ORDER_ITEM', 'ORDER', orderId, { orderNumber: order.orderNumber, item: item.menuItemId, qty: item.quantity, reason: reason || 'n/a' });
            await syncOrderPaymentStatus(tx, hotelId, orderId);
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

            // Cancelling may free the table if nothing else is open on it.
            if (existing.restaurantTableId) {
                await syncTableStatus(tx, hotelId, existing.restaurantTableId);
            }

            await logAction(hotelId, userId, 'CANCEL_ORDER', 'ORDER', orderId, {
                orderNumber: existing.orderNumber,
                reason: reason || 'No reason provided'
            });

            return cancelled;
        });
    }

    // Allowed forward sequence; CANCELLED is reachable from any non-terminal state.
    static readonly STATUS_FLOW = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED'];

    static async updateStatus(hotelId: number, userId: string, orderId: string, status: string) {
        if (![...this.STATUS_FLOW, 'CANCELLED'].includes(status)) {
            throw new BusinessLogicError(`Invalid order status: ${status}`);
        }

        const updatedOrder = await db.transaction(async (tx) => {
            const existing = await tx.query.orders.findFirst({
                where: and(eq(orders.id, orderId), eq(orders.hotelId, hotelId)),
            });
            if (!existing) throw new NotFoundError('Order');

            // No-op if unchanged (idempotent — avoids duplicate GL on re-clicks).
            if (existing.status === status) return existing;

            // Terminal states can't change.
            if (existing.status === 'SERVED' || existing.status === 'CANCELLED') {
                throw new BusinessLogicError(`Order is ${existing.status} and its status can no longer change`);
            }
            // Forward-only (cancel allowed from any non-terminal state).
            if (status !== 'CANCELLED') {
                const from = OrdersService.STATUS_FLOW.indexOf(existing.status as string);
                const to = OrdersService.STATUS_FLOW.indexOf(status);
                if (to < from) {
                    throw new BusinessLogicError(`Cannot move order from ${existing.status} back to ${status}`);
                }
            }

            const [updated] = await tx.update(orders)
                .set({ status: status as any, updatedAt: new Date() })
                .where(and(eq(orders.id, orderId), eq(orders.hotelId, hotelId)))
                .returning();

            if (!updated) throw new NotFoundError('Order');

            if (status === 'SERVED' && updated.restaurantTableId) {
                await syncTableStatus(tx, hotelId, updated.restaurantTableId);
            }

            return updated!;
        });

        EventBus.emit({
            type: 'OrderStatusChanged',
            hotelId,
            source: 'orders',
            timestamp: new Date(),
            payload: {
                orderId: updatedOrder.id,
                orderNumber: updatedOrder.orderNumber,
                status,
                roomId: updatedOrder.roomId,
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

    // Statuses where an order is still open and editable (pre-bill).
    static readonly OPEN_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'];

    /** Move an open order to a different table (before the bill is generated). */
    static async changeTable(hotelId: number, userId: string, orderId: string, newTableId: number) {
        return db.transaction(async (tx) => {
            const order = await tx.query.orders.findFirst({
                where: and(eq(orders.id, orderId), eq(orders.hotelId, hotelId)),
            });
            if (!order) throw new NotFoundError('Order');
            if (!OrdersService.OPEN_STATUSES.includes(order.status as string)) {
                throw new BusinessLogicError(`Cannot move a ${order.status} order to another table`);
            }
            const table = await tx.query.restaurantTables.findFirst({
                where: and(eq(restaurantTables.id, newTableId), eq(restaurantTables.hotelId, hotelId)),
            });
            if (!table) throw new NotFoundError('Table');

            const [updated] = await tx.update(orders)
                .set({ restaurantTableId: newTableId, updatedAt: new Date() })
                .where(and(eq(orders.id, orderId), eq(orders.hotelId, hotelId)))
                .returning();

            // Occupy the new table; re-evaluate the old one (may now be free).
            await occupyTable(tx, hotelId, newTableId);
            if (order.restaurantTableId && order.restaurantTableId !== newTableId) {
                await syncTableStatus(tx, hotelId, order.restaurantTableId);
            }

            await logAction(hotelId, userId, 'CHANGE_ORDER_TABLE', 'ORDER', orderId,
                { from: order.restaurantTableId, to: newTableId, orderNumber: order.orderNumber });
            return updated!;
        });
    }

    /**
     * Merge several open orders into a target order: move their items over,
     * recompute the target total, and cancel the now-empty source orders.
     */
    static async mergeOrders(hotelId: number, userId: string, targetOrderId: string, sourceOrderIds: string[]) {
        const check = validateMergeSources(targetOrderId, sourceOrderIds);
        if (!check.ok) throw new BusinessLogicError(check.reason);
        const sources = sourceOrderIds.filter(id => id !== targetOrderId);

        return db.transaction(async (tx) => {
            const target = await tx.query.orders.findFirst({
                where: and(eq(orders.id, targetOrderId), eq(orders.hotelId, hotelId)),
            });
            if (!target) throw new NotFoundError('Target order');
            if (!OrdersService.OPEN_STATUSES.includes(target.status as string)) {
                throw new BusinessLogicError('Target order is no longer open');
            }

            const sourceOrders = await tx.query.orders.findMany({
                where: and(eq(orders.hotelId, hotelId), inArray(orders.id, sources)),
            });
            for (const s of sourceOrders) {
                if (!OrdersService.OPEN_STATUSES.includes(s.status as string)) {
                    throw new BusinessLogicError(`Order ${s.orderNumber} is ${s.status} and cannot be merged`);
                }
            }

            // Move items to the target and tally added value.
            let addedSubtotal = 0;
            for (const s of sourceOrders) {
                await tx.update(orderItems).set({ orderId: targetOrderId }).where(eq(orderItems.orderId, s.id));
                addedSubtotal += parseFloat(s.subTotal || s.totalAmount || '0');
            }

            const newSubtotal = parseFloat(target.subTotal || target.totalAmount || '0') + addedSubtotal;
            // Recalculate taxes using the target order's stored rates so the
            // tax breakdown stays consistent after a merge.
            const scRate = parseFloat(target.serviceChargeRate || '0.10');
            const vatRate = parseFloat(target.vatRate || '0.13');
            const applySC = target.applyServiceCharge ?? false;
            const applyVat = target.applyVat ?? false;
            const newSC = applySC ? newSubtotal * scRate : 0;
            const newVAT = applyVat ? (newSubtotal + newSC) * vatRate : 0;
            const newTotal = newSubtotal + newSC + newVAT;

            const [updated] = await tx.update(orders)
                .set({
                    subTotal: newSubtotal.toFixed(2),
                    serviceChargeAmount: newSC.toFixed(2),
                    vatAmount: newVAT.toFixed(2),
                    totalAmount: newTotal.toFixed(2),
                    updatedAt: new Date()
                })
                .where(eq(orders.id, targetOrderId))
                .returning();

            // Cancel the drained source orders.
            await tx.update(orders)
                .set({ status: 'CANCELLED', updatedAt: new Date() })
                .where(and(eq(orders.hotelId, hotelId), inArray(orders.id, sources)));

            // Free any table left empty by a merged-away source order.
            const sourceTableIds = [...new Set(sourceOrders.map(s => s.restaurantTableId).filter((t): t is number => !!t && t !== target.restaurantTableId))];
            for (const tid of sourceTableIds) {
                await syncTableStatus(tx, hotelId, tid);
            }

            await logAction(hotelId, userId, 'MERGE_ORDERS', 'ORDER', targetOrderId,
                { merged: sources, into: target.orderNumber });
            return updated!;
        });
    }

    /** Comp an open order (make it complimentary — zero the payable total). */
    static async compOrder(hotelId: number, userId: string, orderId: string, reason?: string) {
        return db.transaction(async (tx) => {
            const order = await tx.query.orders.findFirst({
                where: and(eq(orders.id, orderId), eq(orders.hotelId, hotelId)),
            });
            if (!order) throw new NotFoundError('Order');
            if (!OrdersService.OPEN_STATUSES.includes(order.status as string)) {
                throw new BusinessLogicError('Only an open order can be made complimentary');
            }
            const subTotal = parseFloat(order.subTotal || order.totalAmount || '0');

            const [updated] = await tx.update(orders)
                .set({
                    discountAmount: subTotal.toFixed(2),
                    vatAmount: '0',
                    serviceChargeAmount: '0',
                    totalAmount: '0',
                    status: 'SERVED',
                    paymentStatus: 'PAID',
                    customerName: order.customerName ? `${order.customerName} (COMP)` : 'COMP',
                    updatedAt: new Date(),
                })
                .where(and(eq(orders.id, orderId), eq(orders.hotelId, hotelId)))
                .returning();

            // Insert a payment record for the COMP amount
            await tx.insert(payments).values({
                hotelId,
                orderId: order.id,
                amount: subTotal.toFixed(2),
                paymentMethod: 'COMP',
                notes: reason || 'Complimentary',
                recordedById: userId,
            });

            // Comped order has zero payable → settled; free its table if empty.
            if (order.restaurantTableId) {
                await syncTableStatus(tx, hotelId, order.restaurantTableId);
            }

            await logAction(hotelId, userId, 'COMP_ORDER', 'ORDER', orderId,
                { orderNumber: order.orderNumber, reason: reason || 'Complimentary', amount: subTotal });
            return updated!;
        });
    }

    /**
     * Add new items to an existing open order (append-only). Recalculates totals.
     * Returns the newly inserted item rows so the caller can trigger a KOT print.
     */
    static async addItemsToOrder(hotelId: number, userId: string, orderId: string, items: { menuItemId: number; quantity: number; price: number; notes?: string }[]) {
        return db.transaction(async (tx) => {
            const order = await tx.query.orders.findFirst({
                where: and(eq(orders.id, orderId), eq(orders.hotelId, hotelId)),
            });
            if (!order) throw new NotFoundError('Order');
            if (!OrdersService.OPEN_STATUSES.includes(order.status as string)) {
                throw new BusinessLogicError(`Cannot add items to a ${order.status} order`);
            }

            const menuItemIds = items.map(i => i.menuItemId);
            const menuItemsData = await tx.query.menuItems.findMany({
                where: and(inArray(menuItems.id, menuItemIds), eq(menuItems.hotelId, hotelId))
            });
            const priceMap = new Map(menuItemsData.map(m => [m.id, parseFloat(m.price)]));

            const existingItems = await tx.query.orderItems.findMany({
                where: eq(orderItems.orderId, orderId)
            });

            const addedSubtotal = items.reduce((sum, it) =>
                sum + (priceMap.get(it.menuItemId) ?? 0) * it.quantity, 0);

            const subTotal = existingItems.reduce((s, it) => s + parseFloat(it.price) * it.quantity, 0) + addedSubtotal;
            const scRate = parseFloat(order.serviceChargeRate || '0.10');
            const vatRate = parseFloat(order.vatRate || '0.13');
            const sc = order.applyServiceCharge ? subTotal * scRate : 0;
            const vat = order.applyVat ? (subTotal + sc) * vatRate : 0;
            const discount = Math.min(parseFloat(order.discountAmount || '0'), subTotal + sc + vat);
            const totalAmount = Math.max(0, subTotal + sc + vat - discount);

            await tx.update(orders)
                .set({
                    subTotal: subTotal.toFixed(2),
                    serviceChargeAmount: sc.toFixed(2),
                    vatAmount: vat.toFixed(2),
                    totalAmount: totalAmount.toFixed(2),
                    updatedAt: new Date()
                })
                .where(and(eq(orders.id, orderId), eq(orders.hotelId, hotelId)));

            const inserted = await tx.insert(orderItems).values(
                items.map(it => ({
                    orderId,
                    menuItemId: it.menuItemId,
                    quantity: it.quantity,
                    price: (priceMap.get(it.menuItemId) ?? 0).toString(),
                    notes: it.notes
                }))
            ).returning();

            await logAction(hotelId, userId, 'ADD_ORDER_ITEMS', 'ORDER', orderId,
                { orderNumber: order.orderNumber, itemsAdded: items.length });

            return { order: await tx.query.orders.findFirst({ where: and(eq(orders.id, orderId), eq(orders.hotelId, hotelId)), with: { items: { with: { menuItem: true } } } }), newItems: inserted };
        });
    }

    /**
     * Update an existing order item (quantity or notes). Recalculates totals.
     */
    static async updateOrderItem(hotelId: number, userId: string, orderId: string, itemId: number, data: { quantity?: number; notes?: string; status?: string }) {
        return db.transaction(async (tx) => {
            const order = await tx.query.orders.findFirst({
                where: and(eq(orders.id, orderId), eq(orders.hotelId, hotelId)),
            });
            if (!order) throw new NotFoundError('Order');
            if (!OrdersService.OPEN_STATUSES.includes(order.status as string)) {
                throw new BusinessLogicError(`Cannot edit items on a ${order.status} order`);
            }

            const item = await tx.query.orderItems.findFirst({
                where: and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId))
            });
            if (!item) throw new NotFoundError('Order item');

            const updateData: Record<string, any> = { };
            if (data.quantity !== undefined) updateData.quantity = data.quantity;
            if (data.notes !== undefined) updateData.notes = data.notes;
            if (data.status !== undefined) updateData.status = data.status;

            await tx.update(orderItems).set(updateData).where(eq(orderItems.id, itemId));

            const remaining = await tx.query.orderItems.findMany({ where: eq(orderItems.orderId, orderId) });
            const subTotal = remaining.reduce((s, it) => s + parseFloat(it.price) * it.quantity, 0);
            const scRate = parseFloat(order.serviceChargeRate || '0.10');
            const vatRate = parseFloat(order.vatRate || '0.13');
            const sc = order.applyServiceCharge ? subTotal * scRate : 0;
            const vat = order.applyVat ? (subTotal + sc) * vatRate : 0;
            const discount = Math.min(parseFloat(order.discountAmount || '0'), subTotal + sc + vat);

            const [updated] = await tx.update(orders)
                .set({
                    subTotal: subTotal.toFixed(2),
                    serviceChargeAmount: sc.toFixed(2),
                    vatAmount: vat.toFixed(2),
                    totalAmount: Math.max(0, subTotal + sc + vat - discount).toFixed(2),
                    updatedAt: new Date()
                })
                .where(and(eq(orders.id, orderId), eq(orders.hotelId, hotelId)))
                .returning();

            await logAction(hotelId, userId, 'UPDATE_ORDER_ITEM', 'ORDER', orderId,
                { orderNumber: order.orderNumber, itemId, changes: data });
            await syncOrderPaymentStatus(tx, hotelId, orderId);

            return updated!;
        });
    }

    /**
     * Sync an existing order's items with a new list of items (used by POS edit flow).
     * Replaces all items and recalculates totals.
     */
    static async syncOrderItems(hotelId: number, userId: string, orderId: string, items: { menuItemId: number; quantity: number; price: number; notes?: string }[]) {
        return db.transaction(async (tx) => {
            const order = await tx.query.orders.findFirst({
                where: and(eq(orders.id, orderId), eq(orders.hotelId, hotelId)),
            });
            if (!order) throw new NotFoundError('Order');
            if (!OrdersService.OPEN_STATUSES.includes(order.status as string)) {
                throw new BusinessLogicError(`Cannot edit items on a ${order.status} order`);
            }

            // Delete existing items
            await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));

            const menuItemIds = items.map(i => i.menuItemId);
            let inserted: { id: number; orderId: string; menuItemId: number; quantity: number; price: string; notes: string | null; status: string; createdAt: Date | null }[] = [];
            
            if (menuItemIds.length > 0) {
                const menuItemsData = await tx.query.menuItems.findMany({
                    where: and(inArray(menuItems.id, menuItemIds), eq(menuItems.hotelId, hotelId))
                });
                const priceMap = new Map(menuItemsData.map(m => [m.id, parseFloat(m.price)]));

                inserted = await tx.insert(orderItems).values(
                    items.map(it => ({
                        orderId,
                        menuItemId: it.menuItemId,
                        quantity: it.quantity,
                        price: (priceMap.get(it.menuItemId) ?? it.price).toString(),
                        notes: it.notes
                    }))
                ).returning();
            }

            const subTotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
            const scRate = parseFloat(order.serviceChargeRate || '0.10');
            const vatRate = parseFloat(order.vatRate || '0.13');
            const sc = order.applyServiceCharge ? subTotal * scRate : 0;
            const vat = order.applyVat ? (subTotal + sc) * vatRate : 0;
            const discount = Math.min(parseFloat(order.discountAmount || '0'), subTotal + sc + vat);

            const [updated] = await tx.update(orders)
                .set({
                    subTotal: subTotal.toFixed(2),
                    serviceChargeAmount: sc.toFixed(2),
                    vatAmount: vat.toFixed(2),
                    totalAmount: Math.max(0, subTotal + sc + vat - discount).toFixed(2),
                    updatedAt: new Date()
                })
                .where(and(eq(orders.id, orderId), eq(orders.hotelId, hotelId)))
                .returning();

            await logAction(hotelId, userId, 'SYNC_ORDER_ITEMS', 'ORDER', orderId,
                { orderNumber: order.orderNumber, itemCount: items.length });
            await syncOrderPaymentStatus(tx, hotelId, orderId);

            return { order: await tx.query.orders.findFirst({ where: and(eq(orders.id, orderId), eq(orders.hotelId, hotelId)), with: { items: { with: { menuItem: true } } } }), newItems: inserted };
        });
    }

    /**
     * Composite POS checkout: optionally append items, recalculate billing, verify
     * Fonepay PRN server-side, record payment, and update status in one request.
     * Used by mobile offline sync and active-order checkout flows.
     */
    static async completePosCheckout(hotelId: number, userId: string, orderId: string, data: {
        itemsToAdd?: { menuItemId: number; quantity: number; price: number; notes?: string }[];
        applyVat?: boolean;
        applyServiceCharge?: boolean;
        couponId?: number;
        paymentMethod?: string;
        transactionId?: string;
        cashTendered?: number;
        status?: string;
        addToGuestBill?: boolean;
        roomId?: number;
        bookingId?: string;
        guestId?: string;
    }) {
        const updated = await db.transaction(async (tx) => {
            const order = await tx.query.orders.findFirst({
                where: and(eq(orders.id, orderId), eq(orders.hotelId, hotelId)),
            });
            if (!order) throw new NotFoundError('Order');
            if (!OrdersService.OPEN_STATUSES.includes(order.status as string)) {
                throw new BusinessLogicError(`Cannot checkout a ${order.status} order`);
            }

            if (data.itemsToAdd?.length) {
                const menuItemIds = data.itemsToAdd.map(i => i.menuItemId);
                const menuItemsData = await tx.query.menuItems.findMany({
                    where: and(inArray(menuItems.id, menuItemIds), eq(menuItems.hotelId, hotelId)),
                });
                const priceMap = new Map(menuItemsData.map(m => [m.id, parseFloat(m.price)]));
                await tx.insert(orderItems).values(
                    data.itemsToAdd.map(it => ({
                        orderId,
                        menuItemId: it.menuItemId,
                        quantity: it.quantity,
                        price: (priceMap.get(it.menuItemId) ?? 0).toString(),
                        notes: it.notes,
                    })),
                );
            }

            const allItems = await tx.query.orderItems.findMany({ where: eq(orderItems.orderId, orderId) });
            const subTotal = allItems.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0);
            const vatRate = parseFloat(order.vatRate || '0.13');
            const serviceChargeRate = parseFloat(order.serviceChargeRate || '0.10');
            const applyServiceCharge = data.applyServiceCharge ?? order.applyServiceCharge ?? false;
            const applyVat = data.applyVat ?? order.applyVat ?? false;
            const { serviceCharge: serviceChargeAmount, vat: vatAmount, gross } = computeOrderGross(
                subTotal, applyServiceCharge, applyVat, serviceChargeRate, vatRate,
            );
            const couponId = data.couponId ?? order.couponId ?? undefined;
            const { discount, couponId: resolvedCouponId } = couponId
                ? await resolveCouponDiscount(hotelId, couponId, gross, 'FNB')
                : { discount: 0, couponId: undefined };
            const totalAmount = Math.max(0, gross - discount);

            const updateData: Record<string, unknown> = {
                subTotal: subTotal.toFixed(2),
                serviceChargeAmount: serviceChargeAmount.toFixed(2),
                vatAmount: vatAmount.toFixed(2),
                discountAmount: discount.toFixed(2),
                totalAmount: totalAmount.toFixed(2),
                applyVat,
                applyServiceCharge,
                updatedAt: new Date(),
            };
            if (resolvedCouponId) updateData.couponId = resolvedCouponId;
            if (data.addToGuestBill !== undefined) updateData.addToGuestBill = data.addToGuestBill;
            if (data.roomId !== undefined) updateData.roomId = data.roomId;
            if (data.bookingId !== undefined) updateData.bookingId = data.bookingId;
            if (data.guestId !== undefined) updateData.guestId = data.guestId;
            if (data.status) updateData.status = data.status;

            let paymentCreated = false;
            if (data.paymentMethod && data.paymentMethod !== 'UNPAID' && order.paymentStatus !== 'PAID') {
                if (data.paymentMethod === 'FONEPAY') {
                    await verifyFonepayPrn(hotelId, data.transactionId, totalAmount);
                }
                updateData.paymentStatus = 'PAID';
                await tx.insert(payments).values({
                    hotelId,
                    orderId: order.id,
                    bookingId: order.bookingId,
                    amount: totalAmount.toFixed(2),
                    paymentMethod: data.paymentMethod as any,
                    transactionId: data.transactionId || `POS-${order.orderNumber}`,
                    recordedById: isStaffUserId(userId) ? userId : null,
                } as any);
                paymentCreated = true;
            }

            const [result] = await tx.update(orders)
                .set(updateData)
                .where(and(eq(orders.id, orderId), eq(orders.hotelId, hotelId)))
                .returning();

            if (!result) throw new NotFoundError('Order');

            if ((result.status === 'SERVED' || paymentCreated) && result.restaurantTableId) {
                await syncTableStatus(tx, hotelId, result.restaurantTableId);
            }

            await logAction(hotelId, userId, 'POS_CHECKOUT', 'ORDER', orderId, {
                orderNumber: order.orderNumber,
                itemsAdded: data.itemsToAdd?.length ?? 0,
                paymentMethod: data.paymentMethod,
            });

            return result;
        });

        const couponToRedeem = data.couponId ?? updated.couponId ?? undefined;
        if (couponToRedeem) {
            await CouponsService.redeem(hotelId, couponToRedeem).catch(err => logger.error({ err }, 'Failed to redeem coupon'));
        }

        return updated;
    }
}
