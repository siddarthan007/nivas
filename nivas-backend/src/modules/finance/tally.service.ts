import { db } from '../../db';
import { payments, bookings, purchaseOrders, purchaseOrderItems, inventoryItems } from '../../db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

const escapeXml = (unsafe: string) => unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
    }
});

export const TallyService = {
    async generateSalesXml(hotelId: number, dateStr: string) {
        const startDate = new Date(dateStr);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateStr);
        endDate.setHours(23, 59, 59, 999);

        const sales = await db.query.bookings.findMany({
            where: and(
                eq(bookings.hotelId, hotelId),
                eq(bookings.status, 'CHECKED_OUT'),
                gte(bookings.updatedAt, startDate),
                lte(bookings.updatedAt, endDate)
            ),
            with: { room: true }
        });

        let voucherXml = '';

        for (const sale of sales) {
            const vDate: string = (sale.updatedAt?.toISOString().split('T')[0] ?? dateStr).replace(/-/g, '');
            const amount = parseFloat(sale.totalAmount || '0');

            voucherXml += `
            <TALLYMESSAGE xmlns:UDF="TallyUDF">
             <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
              <DATE>${vDate}</DATE>
              <NARRATION>Room Sales - Room ${sale.room.number} - Guest ${escapeXml(sale.guestName)}</NARRATION>
              <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
              <PARTYLEDGERNAME>Cash</PARTYLEDGERNAME>
              <ALLLEDGERENTRIES.LIST>
               <LEDGERNAME>Room Income</LEDGERNAME>
               <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
               <AMOUNT>${amount}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>
              <ALLLEDGERENTRIES.LIST>
               <LEDGERNAME>Cash</LEDGERNAME>
               <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
               <AMOUNT>-${amount}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>
             </VOUCHER>
            </TALLYMESSAGE>`;
        }

        return this.wrapEnvelope(voucherXml);
    },

    async generatePurchaseXml(hotelId: number, dateStr: string) {
        const startDate = new Date(dateStr);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateStr);
        endDate.setHours(23, 59, 59, 999);

        const purchases = await db.query.purchaseOrders.findMany({
            where: and(
                eq(purchaseOrders.hotelId, hotelId),
                eq(purchaseOrders.status, 'RECEIVED'),
                gte(purchaseOrders.updatedAt, startDate),
                lte(purchaseOrders.updatedAt, endDate)
            ),
            with: { items: { with: { item: true } } }
        });

        let voucherXml = '';

        for (const po of purchases) {
            const vDate: string = (po.updatedAt?.toISOString().split('T')[0] ?? dateStr).replace(/-/g, '');
            const amount = parseFloat(po.totalCost || '0');

            // Ledger entries for items
            let itemsLedger = '';
            for (const poItem of po.items) {
                const itemAmount = (poItem.quantityReceived ?? 0) * parseFloat(poItem.unitCost);
                itemsLedger += `
                  <ALLLEDGERENTRIES.LIST>
                   <LEDGERNAME>Purchase - ${escapeXml(poItem.item.category ?? 'General')}</LEDGERNAME>
                   <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                   <AMOUNT>-${itemAmount.toFixed(2)}</AMOUNT>
                  </ALLLEDGERENTRIES.LIST>`;
            }

            voucherXml += `
            <TALLYMESSAGE xmlns:UDF="TallyUDF">
             <VOUCHER VCHTYPE="Purchase" ACTION="Create" OBJVIEW="Invoice Voucher View">
              <DATE>${vDate}</DATE>
              <NARRATION>PO #${po.poNumber} - Supplier: ${escapeXml(po.supplierName ?? 'Cash Purchase')}</NARRATION>
              <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
              <REFERENCE>${escapeXml(po.poNumber)}</REFERENCE>
              <PARTYLEDGERNAME>${escapeXml(po.supplierName ?? 'Cash')}</PARTYLEDGERNAME>
              ${itemsLedger}
              <ALLLEDGERENTRIES.LIST>
               <LEDGERNAME>${escapeXml(po.supplierName ?? 'Cash')}</LEDGERNAME>
               <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
               <AMOUNT>${amount.toFixed(2)}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>
             </VOUCHER>
            </TALLYMESSAGE>`;
        }

        return this.wrapEnvelope(voucherXml);
    },

    async generateReceiptXml(hotelId: number, dateStr: string) {
        const startDate = new Date(dateStr);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateStr);
        endDate.setHours(23, 59, 59, 999);

        const receipts = await db.query.payments.findMany({
            where: and(
                eq(payments.hotelId, hotelId),
                gte(payments.createdAt, startDate),
                lte(payments.createdAt, endDate)
            ),
            with: { booking: { with: { room: true } } }
        });

        let voucherXml = '';

        for (const r of receipts) {
            const vDate: string = (r.createdAt?.toISOString().split('T')[0] ?? dateStr).replace(/-/g, '');
            const amount = parseFloat(r.amount);
            const narration = r.booking
                ? `Receipt for Room ${r.booking.room.number} - ${escapeXml(r.booking.guestName)}`
                : `Receipt - ${r.paymentMethod}`;

            voucherXml += `
            <TALLYMESSAGE xmlns:UDF="TallyUDF">
             <VOUCHER VCHTYPE="Receipt" ACTION="Create">
              <DATE>${vDate}</DATE>
              <NARRATION>${narration}</NARRATION>
              <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
              <ALLLEDGERENTRIES.LIST>
               <LEDGERNAME>Cash</LEDGERNAME>
               <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
               <AMOUNT>-${amount.toFixed(2)}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>
              <ALLLEDGERENTRIES.LIST>
               <LEDGERNAME>Room Debtors</LEDGERNAME>
               <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
               <AMOUNT>${amount.toFixed(2)}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>
             </VOUCHER>
            </TALLYMESSAGE>`;
        }

        return this.wrapEnvelope(voucherXml);
    },

    wrapEnvelope(body: string) {
        return `
<ENVELOPE>
 <HEADER>
  <TallyREQUEST>Import Data</TallyREQUEST>
 </HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>Vouchers</REPORTNAME>
   </REQUESTDESC>
   <REQUESTDATA>
    ${body}
   </REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>`;
    }
};