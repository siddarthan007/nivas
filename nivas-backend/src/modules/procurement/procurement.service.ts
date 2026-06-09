import { db } from '../../db';
import {
    vendors,
    warehouses,
    purchaseOrders,
    purchaseOrderItems,
    goodsReceiptNotes,
    grnLines,
    inventoryItems
} from '../../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { NotFoundError, BusinessLogicError } from '../../utils/errors';
import { GLService } from '../finance/gl.service';

export const ProcurementService = {
    async getVendors(hotelId: number) {
        return db.query.vendors.findMany({
            where: eq(vendors.hotelId, hotelId)
        });
    },

    async createVendor(hotelId: number, data: any) {
        // Strip any client-supplied id/hotelId so the vendor can't be planted in
        // another tenant or collide with a serial id.
        const { id: _id, hotelId: _h, ...safe } = data || {};
        const [vendor] = await db.insert(vendors).values({
            ...safe,
            hotelId,
        }).returning();
        return vendor;
    },

    async getPurchaseOrders(hotelId: number) {
        return db.query.purchaseOrders.findMany({
            where: eq(purchaseOrders.hotelId, hotelId),
            orderBy: (po, { desc }) => [desc(po.createdAt)],
            with: {
                vendor: { columns: { id: true, name: true } },
                items: { with: { item: { columns: { name: true } } } },
            }
        });
    },

    async createPurchaseOrder(hotelId: number, userId: string, data: any) {
        return db.transaction(async (tx) => {
            if (!Array.isArray(data.items) || data.items.length === 0) throw new BusinessLogicError('At least one line item is required');
            for (const it of data.items) {
                if (Number(it.quantity) <= 0) throw new BusinessLogicError('Item quantity must be positive');
                if (Number(it.unitCost) < 0) throw new BusinessLogicError('Item unit cost cannot be negative');
            }
            const totalCost = data.items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitCost), 0);

            const [po] = await tx.insert(purchaseOrders).values({
                hotelId: hotelId,
                poNumber: `PO-${Date.now()}`,
                supplierName: data.supplierName || 'Unknown',
                vendorId: data.vendorId ?? null,
                notes: data.notes,
                status: 'DRAFT',
                totalCost: totalCost.toString(),
                createdById: userId,
                items: data.items // JSON column
            }).returning();

            for (const item of data.items) {
                await tx.insert(purchaseOrderItems).values({
                    purchaseOrderId: po!.id,
                    itemId: item.itemId,
                    quantityOrdered: item.quantity,
                    quantityReceived: 0,
                    unitCost: item.unitCost.toString()
                });
            }
            return po;
        });
    },

    async receiveGRN(hotelId: number, userId: string, data: { poId: number; vendorId?: number; warehouseId?: number; lines?: any[] }) {
        return db.transaction(async (tx) => {
            const po = await tx.query.purchaseOrders.findFirst({
                where: and(
                    eq(purchaseOrders.id, data.poId),
                    eq(purchaseOrders.hotelId, hotelId)
                )
            });

            if (!po) throw new NotFoundError('Purchase Order');
            if (po.status === 'RECEIVED') throw new BusinessLogicError('Purchase order already received');
            // Goods can only be received against an approved (or partially-received)
            // PO — not a draft, rejected or cancelled one.
            if (po.status !== 'APPROVED' && po.status !== 'PARTIALLY_RECEIVED') {
                throw new BusinessLogicError(`Cannot receive a purchase order with status ${po.status}. Approve it first.`);
            }

            const poItems = await tx.query.purchaseOrderItems.findMany({
                where: eq(purchaseOrderItems.purchaseOrderId, po.id)
            });

            // A GRN requires a vendor + warehouse. The PO only carries a supplier
            // name, so resolve them: explicit input -> match PO supplier -> create.
            let vendorId = data.vendorId ?? po.vendorId ?? undefined;
            if (!vendorId) {
                const supplierName = (po.supplierName || '').trim();
                if (supplierName) {
                    const existingVendor = await tx.query.vendors.findFirst({
                        where: and(eq(vendors.hotelId, hotelId), sql`lower(${vendors.name}) = ${supplierName.toLowerCase()}`)
                    });
                    vendorId = existingVendor?.id;
                }
                if (!vendorId) {
                    const [createdVendor] = await tx.insert(vendors)
                        .values({ hotelId, name: supplierName || 'General Supplier' })
                        .returning();
                    vendorId = createdVendor!.id;
                }
            }

            let warehouseId = data.warehouseId;
            if (!warehouseId) {
                const existingWarehouse = await tx.query.warehouses.findFirst({
                    where: eq(warehouses.hotelId, hotelId)
                });
                warehouseId = existingWarehouse?.id;
                if (!warehouseId) {
                    const [createdWarehouse] = await tx.insert(warehouses)
                        .values({ hotelId, name: 'Main Store' })
                        .returning();
                    warehouseId = createdWarehouse!.id;
                }
            }

            const fallbackTotal = poItems.reduce((sum, l) => sum + (Number(l.quantityOrdered) * Number(l.unitCost)), 0);
            const totalCost = (data.lines && data.lines.length > 0)
                ? data.lines.reduce((sum: number, line: any) => sum + (Number(line.receivedQty) * Number(line.actualCost)), 0)
                : fallbackTotal;

            const [grn] = await tx.insert(goodsReceiptNotes).values({
                hotelId: hotelId,
                purchaseOrderId: po.id,
                vendorId,
                warehouseId,
                grnNumber: `GRN-${Date.now()}`,
                totalAmount: totalCost.toString(),
                grandTotal: totalCost.toString(),
                receivedById: userId
            }).returning();

            const linesToReceive = data.lines || poItems.map((l: any) => ({
                itemId: l.itemId,
                receivedQty: l.quantityOrdered,
                actualCost: Number(l.unitCost)
            }));

            for (const line of linesToReceive) {
                const poLine = poItems.find(l => l.itemId === line.itemId);
                // Reject items not on the PO and over-receipt beyond the remaining
                // ordered quantity (prevents inflating stock / AP).
                if (!poLine) {
                    throw new BusinessLogicError(`Item ${line.itemId} is not on this purchase order`);
                }
                const remaining = Number(poLine.quantityOrdered) - Number(poLine.quantityReceived || 0);
                const recvQty = Number(line.receivedQty);
                if (recvQty <= 0) throw new BusinessLogicError('Received quantity must be positive');
                if (recvQty > remaining) {
                    throw new BusinessLogicError(`Cannot receive ${recvQty} of item ${line.itemId} — only ${remaining} remaining on the order`);
                }

                await tx.insert(grnLines).values({
                    grnId: grn!.id,
                    itemId: line.itemId,
                    quantityReceived: recvQty,
                    unitPrice: Number(line.actualCost).toString(),
                    lineTotal: (recvQty * Number(line.actualCost)).toString()
                });

                // Update PO line received qty
                {
                    await tx.update(purchaseOrderItems)
                        .set({ quantityReceived: Number(poLine.quantityReceived || 0) + Number(line.receivedQty) })
                        .where(eq(purchaseOrderItems.id, poLine.id));
                }

                // Update qty
                const item = await tx.query.inventoryItems.findFirst({
                    where: and(eq(inventoryItems.id, line.itemId), eq(inventoryItems.hotelId, hotelId))
                });
                if (item) {
                    const existingQty = Number(item.quantity || 0);
                    const existingUnitCost = Number(item.unitCost || 0);
                    const newQty = Number(line.receivedQty);
                    const newActualCost = Number(line.actualCost);
                    
                    const totalExistingValue = existingQty * existingUnitCost;
                    const totalNewValue = newQty * newActualCost;
                    const totalQty = existingQty + newQty;
                    
                    const newUnitCost = totalQty > 0 ? (totalExistingValue + totalNewValue) / totalQty : 0;
                    
                    await tx.update(inventoryItems)
                        .set({
                            quantity: totalQty,
                            unitCost: newUnitCost.toFixed(2)
                        })
                        .where(and(eq(inventoryItems.id, line.itemId), eq(inventoryItems.hotelId, hotelId)));
                }
            }

            // Status: RECEIVED only when every line is fully received, else PARTIALLY_RECEIVED.
            const freshLines = await tx.query.purchaseOrderItems.findMany({ where: eq(purchaseOrderItems.purchaseOrderId, po.id) });
            const fullyReceived = freshLines.every(l => Number(l.quantityReceived || 0) >= Number(l.quantityOrdered));
            await tx.update(purchaseOrders)
                .set({ status: fullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED', ...(po.vendorId ? {} : { vendorId }) })
                .where(eq(purchaseOrders.id, po.id));

            // Auto-post to GL (Debit Inventory, Credit AP)
            const invAccount = await GLService.getOrCreateControlAccount(hotelId, '1200', 'Inventory Asset', 'ASSET');
            const apAccount = await GLService.getOrCreateControlAccount(hotelId, '2000', 'Accounts Payable', 'LIABILITY');

            if (invAccount && apAccount) {
                const glEntry = await GLService.postJournalEntry(
                    hotelId,
                    userId,
                    new Date().toISOString().split('T')[0] as string,
                    `GRN Received for PO ${po.id}`,
                    grn!.id.toString(),
                    [
                        { accountId: invAccount.id, debit: totalCost, credit: 0, description: 'Inventory Received' },
                        { accountId: apAccount.id, debit: 0, credit: totalCost, description: 'AP Liability' }
                    ],
                    tx
                );

                await tx.update(goodsReceiptNotes).set({ journalEntryId: glEntry.id }).where(eq(goodsReceiptNotes.id, grn!.id));
            }

            return grn;
        });
    },

    async updateStatus(hotelId: number, poId: number, status: string) {
        return db.update(purchaseOrders)
            .set({ status })
            .where(and(
                eq(purchaseOrders.id, poId),
                eq(purchaseOrders.hotelId, hotelId)
            ))
            .returning();
    }
};
