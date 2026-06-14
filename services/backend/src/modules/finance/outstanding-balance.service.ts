import { db } from '../../db';
import { guests, invoices, hotels } from '../../db/schema';
import { eq, and, gt, sql } from 'drizzle-orm';
import { NotificationChannelService } from '../notifications/notification-channel.service';
import { logger } from '../../shared/logger';
import { relationOne } from '../../utils/relation';

/**
 * Send outstanding balance reminders to guests with unpaid invoices / folio balances.
 */
export const OutstandingBalanceService = {
    async getOutstandingGuests(hotelId: number) {
        const unpaidInvoices = await db.query.invoices.findMany({
            where: and(
                eq(invoices.hotelId, hotelId),
                eq(invoices.isVoided, false),
                sql`${invoices.paymentStatus} IN ('CREDIT', 'PARTIAL', 'UNPAID')`,
            ),
            columns: {
                id: true,
                guestName: true,
                grandTotal: true,
                bookingId: true,
            },
            with: {
                booking: {
                    columns: { guestPhone: true, guestEmail: true },
                },
            },
        });

        const byPhone = new Map<string, {
            name: string;
            phone: string;
            email?: string;
            balance: number;
            invoiceIds: string[];
        }>();

        for (const inv of unpaidInvoices) {
            const booking = relationOne(inv.booking);
            const phone = (booking?.guestPhone || '').trim();
            if (!phone) continue;
            const balance = parseFloat(inv.grandTotal || '0');
            if (balance <= 0) continue;
            const existing = byPhone.get(phone);
            if (existing) {
                existing.balance += balance;
                existing.invoiceIds.push(inv.id);
            } else {
                byPhone.set(phone, {
                    name: inv.guestName || 'Guest',
                    phone,
                    email: booking?.guestEmail || undefined,
                    balance,
                    invoiceIds: [inv.id],
                });
            }
        }

        const guestsWithDue = await db.query.guests.findMany({
            where: and(
                eq(guests.hotelId, hotelId),
                gt(guests.openingDueAmount, '0'),
            ),
            columns: { fullName: true, phone: true, email: true, openingDueAmount: true },
        });
        for (const g of guestsWithDue) {
            const phone = (g.phone || '').trim();
            if (!phone) continue;
            const due = parseFloat(g.openingDueAmount || '0');
            const existing = byPhone.get(phone);
            if (existing) existing.balance += due;
            else byPhone.set(phone, { name: g.fullName, phone, email: g.email || undefined, balance: due, invoiceIds: [] });
        }

        return [...byPhone.values()];
    },

    async sendReminders(hotelId: number) {
        const hotel = await db.query.hotels.findFirst({
            where: eq(hotels.id, hotelId),
            columns: { name: true, currency: true },
        });
        if (!hotel) return { sent: 0, failed: 0 };

        const recipients = await this.getOutstandingGuests(hotelId);
        let sent = 0;
        let failed = 0;

        for (const r of recipients) {
            const message = `Dear ${r.name}, you have an outstanding balance of ${hotel.currency || 'NPR'} ${r.balance.toFixed(2)} at ${hotel.name}. Please settle at your earliest convenience. Thank you.`;
            try {
                await NotificationChannelService.send(hotelId, r.phone, r.email, message, 'outstanding_balance', { event: 'outstandingBalance' });
                sent++;
            } catch (err) {
                failed++;
                logger.error({ err, phone: r.phone }, '[Outstanding] Reminder failed');
            }
        }
        return { sent, failed, total: recipients.length };
    },

    async processAll() {
        const hotelRows = await db.query.hotels.findMany({ columns: { id: true } });
        let sent = 0;
        let failed = 0;
        for (const h of hotelRows) {
            const r = await this.sendReminders(h.id);
            sent += r.sent;
            failed += r.failed;
        }
        return { sent, failed };
    },
};
