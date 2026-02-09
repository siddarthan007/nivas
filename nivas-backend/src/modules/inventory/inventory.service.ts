import { db } from '../../db';
import { inventoryItems, inventoryRequests, purchaseOrders, purchaseOrderItems } from '../../db/schema';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { BusinessLogicError, NotFoundError } from '../../utils/errors';
import { AuditService } from '../system/audit.service';

export class InventoryService {
    static async getItems(hotelId: number) {
        return await db.query.inventoryItems.findMany({
            where: eq(inventoryItems.hotelId, hotelId)
        });
    }

    static async addItem(hotelId: number, data: any) {
        const quantity = data.quantity ?? data.currentStock ?? 0;
        const lowStockThreshold = data.lowStockThreshold ?? data.minStock ?? data.reorderLevel ?? 5;
        const unit = data.unit || 'pcs';

        const [newItem] = await db.insert(inventoryItems).values({
            hotelId,
            name: data.name,
            category: data.category,
            quantity,
            unit,
            lowStockThreshold,
        }).returning();
        return newItem;
    }

    static async addItemsBulk(hotelId: number, items: any[]) {
        if (items.length === 0) return { count: 0, ids: [] };

        const itemsToInsert = items.map(item => ({
            hotelId,
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            unit: item.unit,
            lowStockThreshold: item.lowStockThreshold
        }));

        const inserted = await db.insert(inventoryItems).values(itemsToInsert).returning();
        return { count: inserted.length, ids: inserted.map(i => i.id) };
    }

    static async updateStock(hotelId: number, itemId: number, data: { quantity?: number; lowStockThreshold?: number }) {
        const [updatedItem] = await db.update(inventoryItems)
            .set({
                ...data,
                updatedAt: new Date()
            })
            .where(and(
                eq(inventoryItems.id, itemId),
                eq(inventoryItems.hotelId, hotelId)
            ))
            .returning();

        if (!updatedItem) throw new NotFoundError('Inventory Item');
        return updatedItem;
    }

    static async requestStock(hotelId: number, userId: string, data: { itemId: number; quantity: number; notes?: string }) {
        const [request] = await db.insert(inventoryRequests).values({
            hotelId,
            requestedById: userId,
            ...data,
            status: 'PENDING'
        }).returning();
        return request;
    }

    static async getStockRequests(hotelId: number) {
        return await db.query.inventoryRequests.findMany({
            where: eq(inventoryRequests.hotelId, hotelId),
            with: {
                item: true,
                requestedBy: {
                    columns: { fullName: true, email: true }
                }
            },
            orderBy: (reqs, { desc }) => [desc(reqs.createdAt)]
        });
    }

    static async updateRequestStatus(hotelId: number, requestId: number, status: 'PENDING' | 'APPROVED' | 'REJECTED') {
        const updatedRequest = await db.transaction(async (tx) => {
            const [req] = await tx.update(inventoryRequests)
                .set({
                    status,
                    updatedAt: new Date()
                })
                .where(and(
                    eq(inventoryRequests.id, requestId),
                    eq(inventoryRequests.hotelId, hotelId)
                ))
                .returning();

            if (status === 'APPROVED' && req) {
                await tx.update(inventoryItems)
                    .set({
                        quantity: sql`${inventoryItems.quantity} + ${req.quantity}`,
                        updatedAt: new Date()
                    })
                    .where(eq(inventoryItems.id, req.itemId));
            }
            return req;
        });

        if (!updatedRequest) throw new NotFoundError('Request');
        return updatedRequest;
    }

    static async getItemById(hotelId: number, itemId: number) {
        const item = await db.query.inventoryItems.findFirst({
            where: and(eq(inventoryItems.id, itemId), eq(inventoryItems.hotelId, hotelId))
        });
        if (!item) throw new NotFoundError('Inventory Item');
        return item;
    }

    static async deleteItem(hotelId: number, itemId: number) {
        const [deleted] = await db.delete(inventoryItems)
            .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.hotelId, hotelId)))
            .returning();
        if (!deleted) throw new NotFoundError('Inventory Item');
        return deleted;
    }

    static async updateItem(hotelId: number, itemId: number, data: { name?: string; category?: string; unit?: string; quantity?: number; lowStockThreshold?: number }) {
        const updateData: Record<string, any> = { updatedAt: new Date() };
        if (data.name !== undefined) updateData.name = data.name;
        if (data.category !== undefined) updateData.category = data.category;
        if (data.unit !== undefined) updateData.unit = data.unit;
        if (data.quantity !== undefined) updateData.quantity = data.quantity;
        if (data.lowStockThreshold !== undefined) updateData.lowStockThreshold = data.lowStockThreshold;

        const [updated] = await db.update(inventoryItems)
            .set(updateData)
            .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.hotelId, hotelId)))
            .returning();

        if (!updated) throw new NotFoundError('Inventory Item');
        return updated;
    }

    // Procurement Logic
    static async getPurchaseOrders(hotelId: number) {
        return await db.query.purchaseOrders.findMany({
            where: eq(purchaseOrders.hotelId, hotelId),
            with: {
                items: {
                    with: { item: true }
                },
                createdBy: {
                    columns: { fullName: true }
                }
            },
            orderBy: (po, { desc }) => [desc(po.createdAt)]
        });
    }

    static async getPurchaseOrderById(hotelId: number, poId: number) {
        const po = await db.query.purchaseOrders.findFirst({
            where: and(eq(purchaseOrders.id, poId), eq(purchaseOrders.hotelId, hotelId)),
            with: {
                items: {
                    with: { item: true }
                },
                createdBy: {
                    columns: { fullName: true }
                }
            }
        });
        if (!po) throw new NotFoundError('Purchase Order');
        return po;
    }

    static async updatePurchaseOrder(hotelId: number, userId: string, poId: number, data: { supplierName?: string; items?: { itemId: number; quantity: number; unitCost: number }[] }, ipAddress?: string) {
        return await db.transaction(async (tx) => {
            const existing = await tx.query.purchaseOrders.findFirst({
                where: and(eq(purchaseOrders.id, poId), eq(purchaseOrders.hotelId, hotelId))
            });
            if (!existing) throw new NotFoundError('Purchase Order');
            if (existing.status !== 'DRAFT') throw new BusinessLogicError('Can only edit draft purchase orders');

            const updateData: Record<string, any> = { updatedAt: new Date() };
            if (data.supplierName) updateData.supplierName = data.supplierName;

            if (data.items && data.items.length > 0) {
                await tx.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId));

                let totalCost = 0;
                for (const item of data.items) {
                    const cost = item.quantity * item.unitCost;
                    totalCost += cost;
                    await tx.insert(purchaseOrderItems).values({
                        purchaseOrderId: poId,
                        itemId: item.itemId,
                        quantityOrdered: item.quantity,
                        unitCost: item.unitCost.toString()
                    });
                }
                updateData.totalCost = totalCost.toString();
            }

            const [updated] = await tx.update(purchaseOrders)
                .set(updateData)
                .where(eq(purchaseOrders.id, poId))
                .returning();

            return updated;
        });
    }

    static async cancelPurchaseOrder(hotelId: number, userId: string, poId: number, ipAddress?: string) {
        const existing = await db.query.purchaseOrders.findFirst({
            where: and(eq(purchaseOrders.id, poId), eq(purchaseOrders.hotelId, hotelId))
        });
        if (!existing) throw new NotFoundError('Purchase Order');
        if (existing.status === 'RECEIVED') throw new BusinessLogicError('Cannot cancel a received purchase order');

        const [cancelled] = await db.update(purchaseOrders)
            .set({ status: 'CANCELLED', updatedAt: new Date() })
            .where(eq(purchaseOrders.id, poId))
            .returning();

        await AuditService.log(hotelId, userId, 'CANCEL_PO', 'PURCHASE_ORDER', poId.toString(), {
            poNumber: existing.poNumber
        }, ipAddress);

        return cancelled;
    }

    static async approvePurchaseOrder(hotelId: number, userId: string, poId: number, ipAddress?: string) {
        const existing = await db.query.purchaseOrders.findFirst({
            where: and(eq(purchaseOrders.id, poId), eq(purchaseOrders.hotelId, hotelId))
        });
        if (!existing) throw new NotFoundError('Purchase Order');
        if (existing.status !== 'DRAFT') throw new BusinessLogicError('Can only approve draft purchase orders');

        const [approved] = await db.update(purchaseOrders)
            .set({ status: 'APPROVED', updatedAt: new Date() })
            .where(eq(purchaseOrders.id, poId))
            .returning();

        await AuditService.log(hotelId, userId, 'APPROVE_PO', 'PURCHASE_ORDER', poId.toString(), {
            poNumber: existing.poNumber
        }, ipAddress);

        return approved;
    }

    static async rejectPurchaseOrder(hotelId: number, userId: string, poId: number, reason?: string, ipAddress?: string) {
        const existing = await db.query.purchaseOrders.findFirst({
            where: and(eq(purchaseOrders.id, poId), eq(purchaseOrders.hotelId, hotelId))
        });
        if (!existing) throw new NotFoundError('Purchase Order');
        if (existing.status !== 'DRAFT') throw new BusinessLogicError('Can only reject draft purchase orders');

        const [rejected] = await db.update(purchaseOrders)
            .set({ status: 'REJECTED', updatedAt: new Date() })
            .where(eq(purchaseOrders.id, poId))
            .returning();

        await AuditService.log(hotelId, userId, 'REJECT_PO', 'PURCHASE_ORDER', poId.toString(), {
            poNumber: existing.poNumber,
            reason: reason || 'No reason provided'
        }, ipAddress);

        return rejected;
    }

    static async createPurchaseOrder(hotelId: number, userId: string, data: { supplierName: string, items: { itemId: number; quantity: number; unitCost: number }[] }, ipAddress?: string) {
        const poNumber = `PO-${Date.now()}`;

        const newPO = await db.transaction(async (tx) => {
            const [po] = await tx.insert(purchaseOrders).values({
                hotelId,
                poNumber,
                supplierName: data.supplierName,
                status: 'DRAFT',
                createdById: userId
            }).returning();

            if (!po) throw new BusinessLogicError('Failed to create purchase order');

            let totalCost = 0;
            for (const item of data.items) {
                const cost = item.quantity * item.unitCost;
                totalCost += cost;

                await tx.insert(purchaseOrderItems).values({
                    purchaseOrderId: po.id,
                    itemId: item.itemId,
                    quantityOrdered: item.quantity,
                    unitCost: item.unitCost.toString()
                });
            }

            await tx.update(purchaseOrders)
                .set({ totalCost: totalCost.toString() })
                .where(eq(purchaseOrders.id, po.id));

            return po;
        });

        await AuditService.log(
            hotelId,
            userId,
            'CREATE_PO',
            'PURCHASE_ORDER',
            newPO.id.toString(),
            { poNumber, supplierName: data.supplierName, itemCount: data.items.length },
            ipAddress
        );

        return newPO;
    }

    static async receivePurchaseOrder(hotelId: number, userId: string, poId: number, ipAddress?: string) {
        await db.transaction(async (tx) => {
            const poItems = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId));

            for (const item of poItems) {
                const currentInv = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, item.itemId));
                if (currentInv.length && currentInv[0]) {
                    await tx.update(inventoryItems)
                        .set({
                            quantity: (currentInv[0].quantity ?? 0) + item.quantityOrdered,
                            updatedAt: new Date()
                        })
                        .where(eq(inventoryItems.id, item.itemId));
                }

                await tx.update(purchaseOrderItems)
                    .set({ quantityReceived: item.quantityOrdered })
                    .where(eq(purchaseOrderItems.id, item.id));
            }

            await tx.update(purchaseOrders)
                .set({ status: 'RECEIVED', updatedAt: new Date() })
                .where(eq(purchaseOrders.id, poId));
        });

        await AuditService.log(
            hotelId,
            userId,
            'RECEIVE_PO',
            'PURCHASE_ORDER',
            poId.toString(),
            { status: 'RECEIVED' },
            ipAddress
        );

        return { message: 'Stock received and inventory updated.' };
    }
}
