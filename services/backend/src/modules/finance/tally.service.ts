import { db } from '../../db';
import { payments, invoices, purchaseOrders, purchaseOrderItems, inventoryItems } from '../../db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { relationOne } from '../../utils/relation';

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

        // Use invoices (full revenue incl. F&B + taxes), not just bookings.totalAmount.
        const sales = await db.query.invoices.findMany({
            where: and(
                eq(invoices.hotelId, hotelId),
                eq(invoices.isVoided, false),
                gte(invoices.createdAt, startDate),
                lte(invoices.createdAt, endDate)
            ),
            with: { booking: { with: { room: true } } }
        });

        let voucherXml = '';

        for (const inv of sales) {
            const vDate: string = (inv.createdAt?.toISOString().split('T')[0] ?? dateStr).replace(/-/g, '');
            const roomRev = parseFloat(inv.roomRevenue || '0');
            const fbRev = parseFloat(inv.fbRevenue || '0');
            const vat = parseFloat(inv.vatAmount || '0');
            const sc = parseFloat(inv.serviceCharge || '0');
            const discount = parseFloat(inv.discountAmount || '0');
            const grandTotal = parseFloat(inv.grandTotal || '0');
            const booking = relationOne(inv.booking);
            const guestName = inv.guestName || (booking?.guestName ?? 'Guest');
            const roomNum = relationOne(booking?.room)?.number ?? 'N/A';

            let ledgerEntries = '';
            if (roomRev > 0) {
                ledgerEntries += `
              <ALLLEDGERENTRIES.LIST>
               <LEDGERNAME>Room Income</LEDGERNAME>
               <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
               <AMOUNT>${roomRev.toFixed(2)}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>`;
            }
            if (fbRev > 0) {
                ledgerEntries += `
              <ALLLEDGERENTRIES.LIST>
               <LEDGERNAME>F&B Income</LEDGERNAME>
               <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
               <AMOUNT>${fbRev.toFixed(2)}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>`;
            }
            if (vat > 0) {
                ledgerEntries += `
              <ALLLEDGERENTRIES.LIST>
               <LEDGERNAME>VAT Output</LEDGERNAME>
               <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
               <AMOUNT>${vat.toFixed(2)}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>`;
            }
            // Discount is contra-revenue — debit it to reduce income.
            if (discount > 0) {
                ledgerEntries += `
              <ALLLEDGERENTRIES.LIST>
               <LEDGERNAME>Sales Discounts</LEDGERNAME>
               <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
               <AMOUNT>-${discount.toFixed(2)}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>`;
            }
            // Debit the counter-party (Cash or AR depending on payment status)
            const partyLedger = inv.paymentStatus === 'PAID' ? 'Cash' : 'Accounts Receivable';
            ledgerEntries += `
              <ALLLEDGERENTRIES.LIST>
               <LEDGERNAME>${partyLedger}</LEDGERNAME>
               <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
               <AMOUNT>-${grandTotal.toFixed(2)}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>`;

            voucherXml += `
            <TALLYMESSAGE xmlns:UDF="TallyUDF">
             <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
              <DATE>${vDate}</DATE>
              <NARRATION>Invoice ${inv.invoiceNumber} - Room ${roomNum} - Guest ${escapeXml(guestName)}</NARRATION>
              <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
              <PARTYLEDGERNAME>${partyLedger}</PARTYLEDGERNAME>
              ${ledgerEntries}
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
            const booking = relationOne(r.booking);
            const narration = booking
                ? `Receipt for Room ${relationOne(booking.room)?.number ?? 'N/A'} - ${escapeXml(booking.guestName)}`
                : `Receipt - ${r.paymentMethod}`;

            // Map payment method to proper Tally ledger.
            const method = (r.paymentMethod || 'CASH').toString().toUpperCase();
            const cashLedger = method === 'CASH' ? 'Cash'
                : method === 'CARD' ? 'Bank - Card'
                : method === 'BANK_TRANSFER' ? 'Bank - Transfer'
                : method === 'ESEWA' || method === 'KHALTI' || method === 'FONEPAY' || method === 'CONNECT_IPS'
                    ? 'Digital Wallet'
                    : 'Cash';

            voucherXml += `
            <TALLYMESSAGE xmlns:UDF="TallyUDF">
             <VOUCHER VCHTYPE="Receipt" ACTION="Create">
              <DATE>${vDate}</DATE>
              <NARRATION>${narration}</NARRATION>
              <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
              <ALLLEDGERENTRIES.LIST>
               <LEDGERNAME>${cashLedger}</LEDGERNAME>
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