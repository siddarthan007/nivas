import { db } from '../../db';
import { invoices, purchaseOrders, purchaseOrderItems, hotels } from '../../db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

/**
 * Service to generate IRD compliant reports (Annex 5)
 */
export const ReportsService = {
    /**
     * Generate Sales Register (Annex 5)
     * Format: Date, Invoice No, Buyer Name, PAN, Total Sales, Exempt, Taxable, VAT, Export
     */
    async generateAnnex5Sales(hotelId: number, dateStr?: string) {
        // Defaults to current month if no date provided, or specific day?
        // Usually Annex 5 is monthly. Let's assume dateStr is YYYY-MM or YYYY-MM-DD
        // For simplicity, if YYYY-MM provided, filtering for month. If YYYY-MM-DD, specific day.

        let startDate: Date;
        let endDate: Date;

        const now = new Date();
        if (dateStr) {
            startDate = new Date(dateStr);
            if (dateStr.length === 7) { // YYYY-MM
                // First day of month
                startDate.setDate(1);
                // Last day of month
                endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
                endDate.setHours(23, 59, 59, 999);
            } else {
                // specific day
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(startDate);
                endDate.setHours(23, 59, 59, 999);
            }
        } else {
            // Default to current month
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            endDate.setHours(23, 59, 59, 999);
        }

        const sales = await db.query.invoices.findMany({
            where: and(
                eq(invoices.hotelId, hotelId),
                gte(invoices.createdAt, startDate),
                lte(invoices.createdAt, endDate)
            ),
            orderBy: [desc(invoices.sequenceNumber)]
        });

        // Header for CSV
        const header = [
            'Date',
            'Invoice Number',
            'Buyer Name',
            'Buyer PAN',
            'Total Amount',
            'Exempt Amount',
            'Taxable Amount',
            'VAT Amount'
        ].join(',');

        const rows = sales.map(inv => {
            const date = inv.createdAt?.toISOString().split('T')[0] || '';
            const total = parseFloat(inv.grandTotal);
            const vat = parseFloat(inv.vatAmount || '0');
            // Simplified derivation: if VAT > 0, assumed taxable. 
            // In real world, may have mixed items. But here we take invoice level.
            let taxable = 0;
            let exempt = 0;

            if (vat > 0) {
                // Back calculate or use predefined fields if available
                taxable = parseFloat(inv.subTotal) + parseFloat(inv.serviceCharge || '0') - parseFloat(inv.discountAmount || '0');
            } else {
                exempt = parseFloat(inv.subTotal) + parseFloat(inv.serviceCharge || '0') - parseFloat(inv.discountAmount || '0');
            }

            return [
                date,
                inv.invoiceNumber,
                `"${inv.guestName.replace(/"/g, '""')}"`, // Escape quotes
                inv.guestPan || '',
                total.toFixed(2),
                exempt.toFixed(2),
                taxable.toFixed(2),
                vat.toFixed(2)
            ].join(',');
        });

        return [header, ...rows].join('\n');
    },

    /**
     * Generate Purchase Register (Annex 5)
     */
    async generateAnnex5Purchase(hotelId: number, dateStr?: string) {
        let startDate: Date;
        let endDate: Date;

        const now = new Date();
        if (dateStr) {
            startDate = new Date(dateStr);
            if (dateStr.length === 7) {
                startDate.setDate(1);
                endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
                endDate.setHours(23, 59, 59, 999);
            } else {
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(startDate);
                endDate.setHours(23, 59, 59, 999);
            }
        } else {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            endDate.setHours(23, 59, 59, 999);
        }

        const hotel = await db.query.hotels.findFirst({
            where: eq(hotels.id, hotelId),
            columns: { taxRate: true }
        });
        const vatRate = parseFloat(hotel?.taxRate ?? '0.13');

        const purchases = await db.query.purchaseOrders.findMany({
            where: and(
                eq(purchaseOrders.hotelId, hotelId),
                eq(purchaseOrders.status, 'RECEIVED'),
                gte(purchaseOrders.updatedAt, startDate),
                lte(purchaseOrders.updatedAt, endDate)
            ),
            with: { items: true }
        });

        const header = [
            'Date',
            'Supplier Name',
            'Supplier PAN',
            'Invoice No',
            'Total Amount',
            'Exempt Amount',
            'Taxable Amount',
            'VAT Amount'
        ].join(',');

        const rows = purchases.map(po => {
            const date = po.updatedAt?.toISOString().split('T')[0] || '';
            const total = parseFloat(po.totalCost || '0');

            // Estimate VAT using hotel-configured tax rate
            const taxable = vatRate > 0 ? Math.round((total / (1 + vatRate)) * 100) / 100 : total;
            const vat = vatRate > 0 ? Math.round((total - taxable) * 100) / 100 : 0;
            const exempt = vatRate > 0 ? 0 : total;

            return [
                date,
                `"${po.supplierName?.replace(/"/g, '""') || 'Cash'}"`,
                '', // PAN not in schema for PO
                po.poNumber,
                total.toFixed(2),
                exempt.toFixed(2),
                taxable.toFixed(2),
                vat.toFixed(2)
            ].join(',');
        });

        return [header, ...rows].join('\n');
    }
};
