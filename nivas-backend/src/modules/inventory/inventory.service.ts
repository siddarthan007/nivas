import { db } from '../../db';
import { inventoryItems, inventoryRequests, stockMovements, warehouses, vendors, purchaseOrders, vendorPayments } from '../../db/schema';
import { GLService } from '../finance/gl.service';
import { eq, and, sql, desc, inArray, gte } from 'drizzle-orm';
import { BusinessLogicError, NotFoundError, ValidationError } from '../../utils/errors';

// Round every numeric field of an object to 2 decimals.
const round2 = <T extends Record<string, number>>(o: T): T =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(Number(v) * 100) / 100])) as T;

export class InventoryService {
    static async getItems(hotelId: number) {
        return await db.query.inventoryItems.findMany({
            where: eq(inventoryItems.hotelId, hotelId),
            with: {
                warehouse: { columns: { id: true, name: true } },
                supplier: { columns: { id: true, name: true } },
            },
            orderBy: desc(inventoryItems.updatedAt),
        });
    }

    static async getLowStockItems(hotelId: number) {
        return await db.query.inventoryItems.findMany({
            where: and(
                eq(inventoryItems.hotelId, hotelId),
                eq(inventoryItems.status, 'ACTIVE'),
                sql`${inventoryItems.quantity} <= ${inventoryItems.lowStockThreshold}`
            ),
            with: {
                warehouse: { columns: { id: true, name: true } },
            },
        });
    }

    static async addItem(hotelId: number, data: any, userId?: string) {
        const quantity = data.quantity ?? data.currentStock ?? 0;
        const lowStockThreshold = data.lowStockThreshold ?? data.minStock ?? data.reorderLevel ?? 5;
        const unit = data.unit || 'pcs';

        const [newItem] = await db.insert(inventoryItems).values({
            hotelId,
            sku: data.sku || '',
            barcode: data.barcode,
            name: data.name,
            description: data.description,
            category: data.category,
            quantity,
            unit,
            unitCost: data.unitCost ? String(data.unitCost) : '0',
            lowStockThreshold,
            status: data.status || 'ACTIVE',
            warehouseId: data.warehouseId || null,
            supplierId: data.supplierId || null,
        }).returning();

        if (!newItem) throw new BusinessLogicError('Failed to create inventory item');

        if (userId && quantity > 0) {
            await db.insert(stockMovements).values({
                hotelId,
                itemId: newItem.id,
                userId,
                type: 'IN',
                quantity,
                previousStock: 0,
                newStock: quantity,
                reason: 'Initial stock',
                reference: data.sku || `ITEM-${newItem.id}`,
            });
        }

        return newItem;
    }

    static async addItemsBulk(hotelId: number, items: any[]) {
        if (items.length === 0) return { count: 0, ids: [] };

        const itemsToInsert = items.map(item => ({
            hotelId,
            sku: item.sku || '',
            barcode: item.barcode,
            name: item.name,
            description: item.description,
            category: item.category,
            quantity: item.quantity ?? 0,
            unit: item.unit || 'pcs',
            lowStockThreshold: item.lowStockThreshold ?? 5,
            status: 'ACTIVE' as const,
        }));

        const inserted = await db.insert(inventoryItems).values(itemsToInsert).returning();
        return { count: inserted.length, ids: inserted.map(i => i.id) };
    }

    static async updateItem(hotelId: number, itemId: number, data: any, userId?: string) {
        const item = await db.query.inventoryItems.findFirst({
            where: and(eq(inventoryItems.id, itemId), eq(inventoryItems.hotelId, hotelId))
        });
        if (!item) throw new NotFoundError('Inventory Item');

        const previousStock = item.quantity ?? 0;
        let newQuantity = data.quantity !== undefined ? data.quantity
            : data.currentStock !== undefined ? data.currentStock
            : previousStock;
        if (newQuantity < 0) throw new ValidationError('Stock quantity cannot be negative');
        const adjustment = newQuantity - previousStock;

        const updateData: Record<string, any> = { updatedAt: new Date() };
        if (data.sku !== undefined) updateData.sku = data.sku;
        if (data.barcode !== undefined) updateData.barcode = data.barcode;
        if (data.name !== undefined) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.category !== undefined) updateData.category = data.category;
        if (data.unit !== undefined) updateData.unit = data.unit;
        if (data.lowStockThreshold !== undefined) updateData.lowStockThreshold = data.lowStockThreshold;
        if (data.status !== undefined) updateData.status = data.status;
        if (data.warehouseId !== undefined) updateData.warehouseId = data.warehouseId;
        if (data.supplierId !== undefined) updateData.supplierId = data.supplierId;
        if (data.unitCost !== undefined) updateData.unitCost = String(data.unitCost);
        if (data.quantity !== undefined || data.currentStock !== undefined) updateData.quantity = newQuantity;

        const [updated] = await db.update(inventoryItems)
            .set(updateData)
            .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.hotelId, hotelId)))
            .returning();

        if (!updated) throw new NotFoundError('Inventory Item');

        if (adjustment !== 0 && userId) {
            await db.insert(stockMovements).values({
                hotelId,
                itemId,
                userId,
                type: adjustment > 0 ? 'IN' : 'OUT',
                quantity: adjustment,
                previousStock,
                newStock: newQuantity,
                reason: 'Stock update via edit',
            });
        }

        return updated;
    }

    static async adjustStock(hotelId: number, itemId: number, data: { adjustment: number; reason: string; reference?: string }, userId?: string) {
        const item = await db.query.inventoryItems.findFirst({
            where: and(eq(inventoryItems.id, itemId), eq(inventoryItems.hotelId, hotelId))
        });
        if (!item) throw new NotFoundError('Inventory Item');

        const previousStock = item.quantity ?? 0;
        if (data.adjustment === 0) throw new BusinessLogicError('Adjustment amount cannot be zero');
        const newStock = Math.max(0, previousStock + data.adjustment);
        // Log the adjustment that was actually applied (stock is clamped at 0),
        // so the movement ledger always reconciles with on-hand quantity.
        const appliedAdjustment = newStock - previousStock;
        const type = 'ADJUSTMENT';

        // Atomic: stock update + movement log commit together.
        const updated = await db.transaction(async (tx) => {
            const [u] = await tx.update(inventoryItems)
                .set({ quantity: newStock, updatedAt: new Date() })
                .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.hotelId, hotelId)))
                .returning();
            if (!u) throw new NotFoundError('Inventory Item');

            await tx.insert(stockMovements).values({
                hotelId,
                itemId,
                userId: userId || null,
                type,
                quantity: appliedAdjustment,
                previousStock,
                newStock,
                reason: data.reason,
                reference: data.reference || null,
            });
            return u;
        });

        return updated;
    }

    static async updateStock(hotelId: number, itemId: number, data: { quantity?: number; lowStockThreshold?: number }, userId?: string) {
        const item = await db.query.inventoryItems.findFirst({
            where: and(eq(inventoryItems.id, itemId), eq(inventoryItems.hotelId, hotelId))
        });
        if (!item) throw new NotFoundError('Inventory Item');

        const previousStock = item.quantity ?? 0;
        const newQuantity = data.quantity !== undefined ? data.quantity : previousStock;
        if (newQuantity < 0) throw new ValidationError('Stock quantity cannot be negative');
        const adjustment = newQuantity - previousStock;

        const updateData: Record<string, any> = { updatedAt: new Date() };
        if (data.quantity !== undefined) updateData.quantity = data.quantity;
        if (data.lowStockThreshold !== undefined) updateData.lowStockThreshold = data.lowStockThreshold;

        const [updatedItem] = await db.update(inventoryItems)
            .set(updateData)
            .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.hotelId, hotelId)))
            .returning();

        if (!updatedItem) throw new NotFoundError('Inventory Item');

        if (adjustment !== 0 && userId) {
            await db.insert(stockMovements).values({
                hotelId,
                itemId,
                userId,
                type: adjustment > 0 ? 'IN' : 'OUT',
                quantity: adjustment,
                previousStock,
                newStock: newQuantity,
                reason: 'Manual stock update',
            });
        }

        return updatedItem;
    }

    static async getStockMovements(hotelId: number, itemId?: number) {
        const conditions = [eq(stockMovements.hotelId, hotelId)];
        if (itemId) conditions.push(eq(stockMovements.itemId, itemId));

        return await db.query.stockMovements.findMany({
            where: and(...conditions),
            with: {
                item: { columns: { id: true, name: true, sku: true, unit: true } },
                user: { columns: { fullName: true } },
            },
            orderBy: desc(stockMovements.createdAt),
            limit: 200,
        });
    }

    static async getItemById(hotelId: number, itemId: number) {
        const item = await db.query.inventoryItems.findFirst({
            where: and(eq(inventoryItems.id, itemId), eq(inventoryItems.hotelId, hotelId)),
            with: {
                warehouse: { columns: { id: true, name: true } },
                supplier: { columns: { id: true, name: true } },
                movements: {
                    limit: 10,
                    orderBy: desc(stockMovements.createdAt),
                    with: { user: { columns: { fullName: true } } },
                },
            },
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

    static async requestStock(hotelId: number, userId: string, data: { itemId: number; quantity: number; notes?: string }) {
        const item = await db.query.inventoryItems.findFirst({
            where: and(eq(inventoryItems.id, data.itemId), eq(inventoryItems.hotelId, hotelId))
        });
        if (!item) throw new NotFoundError('Inventory Item');

        const [request] = await db.insert(inventoryRequests).values({
            ...data,
            hotelId,
            requestedById: userId,
            status: 'PENDING'
        }).returning();
        if (!request) throw new BusinessLogicError('Failed to create stock request');
        return request;
    }

    static async getStockRequests(hotelId: number) {
        return await db.query.inventoryRequests.findMany({
            where: eq(inventoryRequests.hotelId, hotelId),
            with: {
                item: true,
                requestedBy: { columns: { fullName: true, email: true } }
            },
            orderBy: (reqs, { desc }) => [desc(reqs.createdAt)]
        });
    }

    static async updateRequestStatus(hotelId: number, requestId: number, status: 'PENDING' | 'APPROVED' | 'REJECTED', userId?: string) {
        const updatedRequest = await db.transaction(async (tx) => {
            // Read the PRIOR status so we only add stock on the APPROVED transition
            // once — re-approving must not add stock again.
            const before = await tx.query.inventoryRequests.findFirst({
                where: and(eq(inventoryRequests.id, requestId), eq(inventoryRequests.hotelId, hotelId)),
                columns: { status: true },
            });
            if (!before) throw new NotFoundError('Inventory Request');
            const wasApproved = before.status === 'APPROVED';

            const [req] = await tx.update(inventoryRequests)
                .set({ status, updatedAt: new Date() })
                .where(and(eq(inventoryRequests.id, requestId), eq(inventoryRequests.hotelId, hotelId)))
                .returning();

            if (status === 'APPROVED' && !wasApproved && req) {
                const item = await tx.query.inventoryItems.findFirst({
                    where: and(eq(inventoryItems.id, req.itemId), eq(inventoryItems.hotelId, hotelId))
                });
                if (!item) throw new NotFoundError('Inventory Item');
                const previousStock = item.quantity ?? 0;
                const newStock = previousStock + req.quantity;

                await tx.update(inventoryItems)
                    .set({ quantity: newStock, updatedAt: new Date() })
                    .where(and(eq(inventoryItems.id, req.itemId), eq(inventoryItems.hotelId, hotelId)));

                await tx.insert(stockMovements).values({
                    hotelId,
                    itemId: req.itemId,
                    userId: userId || null,
                    type: 'IN',
                    quantity: req.quantity,
                    previousStock,
                    newStock,
                    reason: 'Stock request approved',
                    reference: `REQ-${req.id}`,
                });
            }
            return req;
        });

        if (!updatedRequest) throw new NotFoundError('Request');
        return updatedRequest;
    }

    static async getWarehouses(hotelId: number) {
        return await db.query.warehouses.findMany({
            where: eq(warehouses.hotelId, hotelId),
            orderBy: desc(warehouses.createdAt),
        });
    }

    static async getVendors(hotelId: number) {
        return await db.query.vendors.findMany({
            where: eq(vendors.hotelId, hotelId),
            orderBy: desc(vendors.createdAt),
        });
    }

    static async createWarehouse(hotelId: number, data: { name: string; location?: string | null }) {
        const [wh] = await db.insert(warehouses).values({
            hotelId,
            name: data.name,
            location: data.location || null,
            isActive: true,
        }).returning();
        if (!wh) throw new BusinessLogicError('Failed to create warehouse');
        return wh;
    }

    static async updateWarehouse(hotelId: number, id: number, data: { name?: string; location?: string | null; isActive?: boolean }) {
        const [wh] = await db.update(warehouses)
            .set(data)
            .where(and(eq(warehouses.id, id), eq(warehouses.hotelId, hotelId)))
            .returning();
        if (!wh) throw new NotFoundError('Warehouse');
        return wh;
    }

    static async deleteWarehouse(hotelId: number, id: number) {
        const [wh] = await db.delete(warehouses)
            .where(and(eq(warehouses.id, id), eq(warehouses.hotelId, hotelId)))
            .returning();
        if (!wh) throw new NotFoundError('Warehouse');
        return wh;
    }

    static async getWarehouseFinance(hotelId: number, warehouseId: number) {
        const items = await db.query.inventoryItems.findMany({
            where: and(eq(inventoryItems.hotelId, hotelId), eq(inventoryItems.warehouseId, warehouseId)),
        });
        const totalValue = items.reduce((sum, item) => sum + (Number(item.unitCost || 0) * (item.quantity || 0)), 0);
        return { items, totalValue, count: items.length };
    }

    static async createVendor(hotelId: number, data: { name: string; contactPerson?: string; email?: string; phone?: string; address?: string; taxNumber?: string }) {
        const [v] = await db.insert(vendors).values({
            hotelId,
            ...data,
            isActive: true,
        }).returning();
        if (!v) throw new BusinessLogicError('Failed to create vendor');
        return v;
    }

    static async updateVendor(hotelId: number, id: number, data: Partial<{ name: string; contactPerson: string; email: string; phone: string; address: string; taxNumber: string; isActive: boolean }>) {
        const [v] = await db.update(vendors)
            .set(data)
            .where(and(eq(vendors.id, id), eq(vendors.hotelId, hotelId)))
            .returning();
        if (!v) throw new NotFoundError('Vendor');
        return v;
    }

    static async deleteVendor(hotelId: number, id: number) {
        const [v] = await db.delete(vendors)
            .where(and(eq(vendors.id, id), eq(vendors.hotelId, hotelId)))
            .returning();
        if (!v) throw new NotFoundError('Vendor');
        return v;
    }

    static async getVendorFinance(hotelId: number, vendorId: number) {
        // POs link to a vendor via po.vendorId (set on receive) — the old filter
        // looked at po.items[].vendorId (never loaded), so it always returned 0.
        // RECEIVED only — a fully-received PO's totalCost equals the GL Accounts
        // Payable posted on receipt. Partially-received POs would overstate the
        // payable (GL posts only the received portion), so they're excluded here.
        const pos = await db.query.purchaseOrders.findMany({
            where: and(
                eq(purchaseOrders.hotelId, hotelId),
                eq(purchaseOrders.vendorId, vendorId),
                eq(purchaseOrders.status, 'RECEIVED'),
            ),
            orderBy: [desc(purchaseOrders.createdAt)],
        });
        const totalSpend = pos.reduce((sum, po) => sum + Number(po.totalCost || 0), 0);
        const vpays = await db.query.vendorPayments.findMany({
            where: and(eq(vendorPayments.hotelId, hotelId), eq(vendorPayments.vendorId, vendorId)),
            orderBy: [desc(vendorPayments.createdAt)],
        });
        const totalPaid = vpays.reduce((s, p) => s + Number(p.amount || 0), 0);
        const outstanding = Math.round((totalSpend - totalPaid) * 100) / 100;
        return { purchaseOrders: pos, payments: vpays, totalSpend, totalPaid, outstanding, count: pos.length };
    }

    /**
     * Accounts-Payable aging per supplier. Payments aren't linked to specific POs,
     * so they're applied FIFO (oldest received PO first); the remaining unpaid PO
     * value is bucketed by age: current (≤30d), 31-60, 61-90, 90+.
     */
    static async getApAging(hotelId: number) {
        const [pos, pays, vendorList] = await Promise.all([
            db.query.purchaseOrders.findMany({
                where: and(eq(purchaseOrders.hotelId, hotelId), eq(purchaseOrders.status, 'RECEIVED')),
                columns: { vendorId: true, totalCost: true, createdAt: true },
            }),
            db.query.vendorPayments.findMany({ where: eq(vendorPayments.hotelId, hotelId), columns: { vendorId: true, amount: true } }),
            db.query.vendors.findMany({ where: eq(vendors.hotelId, hotelId), columns: { id: true, name: true } }),
        ]);

        const paidByVendor = new Map<number, number>();
        for (const p of pays) paidByVendor.set(p.vendorId, (paidByVendor.get(p.vendorId) || 0) + Number(p.amount || 0));

        const posByVendor = new Map<number, { cost: number; date: Date }[]>();
        for (const po of pos) {
            if (!po.vendorId) continue;
            if (!posByVendor.has(po.vendorId)) posByVendor.set(po.vendorId, []);
            posByVendor.get(po.vendorId)!.push({ cost: Number(po.totalCost || 0), date: po.createdAt || new Date() });
        }

        const now = Date.now();
        const names = new Map(vendorList.map(v => [v.id, v.name]));
        const rows: any[] = [];
        for (const [vendorId, list] of posByVendor) {
            list.sort((a, b) => a.date.getTime() - b.date.getTime()); // oldest first
            let remainingPaid = paidByVendor.get(vendorId) || 0;
            const b = { current: 0, d30: 0, d60: 0, d90: 0, total: 0 };
            for (const po of list) {
                const applied = Math.min(remainingPaid, po.cost);
                remainingPaid -= applied;
                const unpaid = po.cost - applied;
                if (unpaid <= 0.001) continue;
                const ageDays = (now - po.date.getTime()) / 86400000;
                const bucket = ageDays <= 30 ? 'current' : ageDays <= 60 ? 'd30' : ageDays <= 90 ? 'd60' : 'd90';
                (b as any)[bucket] += unpaid;
                b.total += unpaid;
            }
            if (b.total > 0.001) rows.push({ vendorId, vendorName: names.get(vendorId) || 'Supplier', ...round2(b) });
        }
        rows.sort((a, b) => b.total - a.total);
        const totals = rows.reduce((t, r) => ({ current: t.current + r.current, d30: t.d30 + r.d30, d60: t.d60 + r.d60, d90: t.d90 + r.d90, total: t.total + r.total }), { current: 0, d30: 0, d60: 0, d90: 0, total: 0 });
        return { vendors: rows, totals: round2(totals) };
    }

    /** Record a payment TO a supplier — settles AP, posts cash outflow to GL. */
    static async recordVendorPayment(hotelId: number, userId: string, vendorId: number, data: { amount: number; paymentMethod?: string; reference?: string; notes?: string }) {
        if (!data.amount || data.amount <= 0) throw new BusinessLogicError('Enter a valid amount');
        const vendor = await db.query.vendors.findFirst({ where: and(eq(vendors.id, vendorId), eq(vendors.hotelId, hotelId)), columns: { id: true } });
        if (!vendor) throw new NotFoundError('Supplier');
        return db.transaction(async (tx) => {
            const [vp] = await tx.insert(vendorPayments).values({
                hotelId, vendorId,
                amount: data.amount.toFixed(2),
                paymentMethod: data.paymentMethod || 'CASH',
                reference: data.reference,
                notes: data.notes,
                createdById: userId,
            }).returning();

            // GL: Debit Accounts Payable (reduce what we owe), Credit Cash (outflow).
            const apAccount = await GLService.getOrCreateControlAccount(hotelId, '2000', 'Accounts Payable', 'LIABILITY', tx);
            const cashAccount = await GLService.getOrCreateControlAccount(hotelId, '1000', 'Cash', 'ASSET', tx);
            if (apAccount && cashAccount && vp) {
                const je = await GLService.postJournalEntry(
                    hotelId, userId,
                    new Date().toISOString().split('T')[0] as string,
                    `Supplier payment via ${data.paymentMethod || 'CASH'}`,
                    vp.id.toString(),
                    [
                        { accountId: apAccount.id, debit: data.amount, credit: 0, description: 'AP settled' },
                        { accountId: cashAccount.id, debit: 0, credit: data.amount, description: 'Cash paid to supplier' },
                    ],
                    tx,
                );
                await tx.update(vendorPayments).set({ journalEntryId: je.id }).where(eq(vendorPayments.id, vp.id));
            }
            return vp;
        });
    }
}

