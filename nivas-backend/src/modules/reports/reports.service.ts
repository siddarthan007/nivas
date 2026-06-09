import { db } from '../../db';
import { payments, bookings, housekeepingTasks, guestProfiles, orders, invoices, purchaseOrders } from '../../db/schema';
import { eq, and, sql, gte, lte, sum, count, desc, inArray, type SQL } from 'drizzle-orm';

const fmtDate = (d: any) => { try { return new Date(d).toLocaleDateString(); } catch { return String(d ?? ''); } };

export interface ReportPayload {
    type: string;
    title: string;
    from: string;
    to: string;
    columns: string[];
    rows: (string | number)[][];
    summary: { label: string; value: string }[];
}

export const ReportsService = {
    /**
     * Tabular report data for the per-type Reports screen (Sales/Income,
     * Payment Collection, Purchase/Expense). Shared shape powers the on-screen
     * table, CSV export and server-side PDF.
     */
    async getReportData(hotelId: number, type: string, from: string, to: string): Promise<ReportPayload> {
        const start = new Date(from); start.setHours(0, 0, 0, 0);
        const end = new Date(to); end.setHours(23, 59, 59, 999);
        const n = (v: unknown) => Number(v ?? 0);

        if (type === 'payment-collection') {
            const list = await db.query.payments.findMany({
                where: and(eq(payments.hotelId, hotelId), gte(payments.createdAt, start), lte(payments.createdAt, end)),
                orderBy: [desc(payments.createdAt)],
            });
            const byMethod: Record<string, number> = {};
            let total = 0;
            const rows = list.map(p => {
                const amt = n(p.amount);
                total += amt;
                byMethod[p.paymentMethod] = (byMethod[p.paymentMethod] || 0) + amt;
                return [fmtDate(p.createdAt), p.paymentMethod, p.transactionId || p.notes || '', amt.toFixed(2)];
            });
            return {
                type, title: 'Payment Collection Report', from, to,
                columns: ['Date', 'Method', 'Reference', 'Amount'],
                rows,
                summary: [
                    { label: 'Total Collected', value: total.toFixed(2) },
                    { label: 'Transactions', value: String(list.length) },
                    ...Object.entries(byMethod).map(([m, v]) => ({ label: m.replace('_', ' '), value: v.toFixed(2) })),
                ],
            };
        }

        if (type === 'purchase-expense') {
            const list = await db.query.purchaseOrders.findMany({
                where: and(eq(purchaseOrders.hotelId, hotelId), gte(purchaseOrders.createdAt, start), lte(purchaseOrders.createdAt, end)),
                orderBy: [desc(purchaseOrders.createdAt)],
            });
            let total = 0;
            const rows = list.map(po => {
                const amt = n(po.totalCost);
                total += amt;
                return [fmtDate(po.createdAt), po.poNumber, po.supplierName || '', po.status || '', amt.toFixed(2)];
            });
            return {
                type, title: 'Purchase / Expense Report', from, to,
                columns: ['Date', 'PO #', 'Supplier', 'Status', 'Amount'],
                rows,
                summary: [
                    { label: 'Total Purchases', value: total.toFixed(2) },
                    { label: 'Orders', value: String(list.length) },
                ],
            };
        }

        // Default: Sales / Income (invoices)
        const list = await db.query.invoices.findMany({
            where: and(eq(invoices.hotelId, hotelId), gte(invoices.createdAt, start), lte(invoices.createdAt, end)),
            orderBy: [desc(invoices.createdAt)],
        });
        let total = 0, vat = 0;
        const rows = list.map(inv => {
            const amt = n(inv.grandTotal);
            total += amt; vat += n(inv.vatAmount);
            return [fmtDate(inv.createdAt), inv.invoiceNumber, inv.guestName || '', inv.paymentStatus || '', amt.toFixed(2)];
        });
        return {
            type: 'sales', title: 'Sales / Income Report', from, to,
            columns: ['Date', 'Invoice #', 'Customer', 'Status', 'Amount'],
            rows,
            summary: [
                { label: 'Total Sales', value: total.toFixed(2) },
                { label: 'VAT', value: vat.toFixed(2) },
                { label: 'Invoices', value: String(list.length) },
            ],
        };
    },

    /**
     * Waiter KOT report: F&B orders attributed to the staff member who raised
     * them, with line items, status and notes. Filterable by waiter, status and
     * date so supervisors can review per-waiter activity.
     */
    async getWaiterKotReport(hotelId: number, filters: { waiterId?: string; status?: string; date?: string }) {
        const conditions: SQL[] = [eq(orders.hotelId, hotelId)];
        if (filters.waiterId) conditions.push(eq(orders.createdById, filters.waiterId));
        if (filters.status) conditions.push(eq(orders.status, filters.status as any));
        if (filters.date) {
            const start = new Date(filters.date); start.setHours(0, 0, 0, 0);
            const end = new Date(filters.date); end.setHours(23, 59, 59, 999);
            conditions.push(gte(orders.createdAt, start), lte(orders.createdAt, end));
        }

        const rows = await db.query.orders.findMany({
            where: and(...conditions),
            with: {
                createdBy: { columns: { id: true, fullName: true } },
                restaurantTable: { columns: { tableNumber: true } },
                items: { with: { menuItem: { columns: { name: true } } } },
            },
            orderBy: (o, { desc }) => [desc(o.createdAt)],
            limit: 500,
        });

        return rows.map(o => {
            const createdBy = o.createdBy as { fullName?: string } | null;
            const table = o.restaurantTable as { tableNumber?: string } | null;
            return {
                id: o.id,
                orderNumber: o.orderNumber,
                orderType: o.orderType,
                status: o.status,
                waiterId: o.createdById,
                waiterName: createdBy?.fullName || (o.createdById ? 'Staff' : 'Guest / Self-order'),
                tableNumber: table?.tableNumber ?? null,
                items: o.items.map((it: any) => ({ name: it.menuItem?.name ?? 'Item', quantity: it.quantity })),
                notes: o.items.map((it: any) => it.notes).filter(Boolean).join('; ') || null,
                createdAt: o.createdAt,
            };
        });
    },

    async getDailySalesReport(hotelId: number, dateStr: string) {
        const startDate = new Date(dateStr);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateStr);
        endDate.setHours(23, 59, 59, 999);

        const revenueByMethod = await db.select({
            method: payments.paymentMethod,
            total: sum(payments.amount)
        })
            .from(payments)
            .where(and(
                eq(payments.hotelId, hotelId),
                gte(payments.createdAt, startDate),
                lte(payments.createdAt, endDate)
            ))
            .groupBy(payments.paymentMethod);

        const totalRevenue = revenueByMethod.reduce((acc, curr) => acc + parseFloat(curr.total || '0'), 0);

        const [roomsOccupied] = await db.select({ count: count() })
            .from(bookings)
            .where(and(
                eq(bookings.hotelId, hotelId),
                lte(bookings.checkIn, endDate),
                gte(bookings.checkOut, startDate)
            ));

        return {
            date: dateStr,
            totalRevenue,
            breakdown: revenueByMethod,
            occupancy: roomsOccupied?.count || 0
        };
    },

    async getHousekeepingEfficiency(hotelId: number, days: number) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        return await db.select({
            staffId: housekeepingTasks.assignedToId,
            taskType: housekeepingTasks.taskType,
            tasksCount: count(),
            avgDurationMinutes: sql<number>`AVG(EXTRACT(EPOCH FROM (${housekeepingTasks.completedAt} - ${housekeepingTasks.startedAt})) / 60)`
        })
            .from(housekeepingTasks)
            .where(and(
                eq(housekeepingTasks.hotelId, hotelId),
                gte(housekeepingTasks.createdAt, startDate),
                eq(housekeepingTasks.status, 'COMPLETED')
            ))
            .groupBy(housekeepingTasks.assignedToId, housekeepingTasks.taskType);
    },

    async getArrivalsReport(hotelId: number, dateStr: string) {
        const startDate = new Date(dateStr);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateStr);
        endDate.setHours(23, 59, 59, 999);

        const arrivals = await db.query.bookings.findMany({
            where: and(
                eq(bookings.hotelId, hotelId),
                gte(bookings.checkIn, startDate),
                lte(bookings.checkIn, endDate),
                inArray(bookings.status, ['CONFIRMED', 'PENDING'])
            ),
            with: { room: { columns: { number: true, type: true } } },
            orderBy: [desc(bookings.checkIn)]
        });

        return arrivals.map(b => ({
            bookingId: b.id,
            guestName: b.guestName,
            guestPhone: b.guestPhone,
            roomNumber: b.room?.number,
            roomType: b.room?.type,
            checkIn: b.checkIn,
            checkOut: b.checkOut,
            status: b.status,
            source: b.source
        }));
    },

    async getDeparturesReport(hotelId: number, dateStr: string) {
        const startDate = new Date(dateStr);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateStr);
        endDate.setHours(23, 59, 59, 999);

        const departures = await db.query.bookings.findMany({
            where: and(
                eq(bookings.hotelId, hotelId),
                gte(bookings.checkOut, startDate),
                lte(bookings.checkOut, endDate),
                eq(bookings.status, 'CHECKED_IN')
            ),
            with: { room: { columns: { number: true, type: true } } },
            orderBy: [desc(bookings.checkOut)]
        });

        return departures.map(b => ({
            bookingId: b.id,
            guestName: b.guestName,
            guestPhone: b.guestPhone,
            roomNumber: b.room?.number,
            roomType: b.room?.type,
            checkIn: b.checkIn,
            checkOut: b.checkOut,
            totalAmount: b.totalAmount,
            isPaid: b.isPaid
        }));
    },

    async getCancellationsAndNoShows(hotelId: number, days: number) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const cancellations = await db.query.bookings.findMany({
            where: and(
                eq(bookings.hotelId, hotelId),
                gte(bookings.createdAt, startDate),
                eq(bookings.status, 'CANCELLED')
            ),
            with: { room: { columns: { number: true, type: true } } },
            orderBy: [desc(bookings.updatedAt)]
        });

        // No-shows: bookings where checkIn has passed but still PENDING/CONFIRMED
        const now = new Date();
        const noShows = await db.query.bookings.findMany({
            where: and(
                eq(bookings.hotelId, hotelId),
                lte(bookings.checkIn, now),
                gte(bookings.checkIn, startDate),
                inArray(bookings.status, ['PENDING', 'CONFIRMED'])
            ),
            with: { room: { columns: { number: true, type: true } } }
        });

        const cancellationData = cancellations.map(b => ({
            bookingId: b.id,
            guestName: b.guestName,
            guestPhone: b.guestPhone,
            roomNumber: b.room?.number,
            checkIn: b.checkIn,
            checkOut: b.checkOut,
            type: 'CANCELLED',
            lostRevenue: b.totalAmount
        }));

        const noShowData = noShows.map(b => ({
            bookingId: b.id,
            guestName: b.guestName,
            guestPhone: b.guestPhone,
            roomNumber: b.room?.number,
            checkIn: b.checkIn,
            checkOut: b.checkOut,
            type: 'NO_SHOW',
            lostRevenue: b.totalAmount
        }));

        return { cancellationData, noShowData };
    },

    async getNationalitiesReport(hotelId: number, days: number) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const bookingsWithGuests = await db.query.bookings.findMany({
            where: and(
                eq(bookings.hotelId, hotelId),
                gte(bookings.checkIn, startDate),
                inArray(bookings.status, ['CHECKED_IN', 'CHECKED_OUT'])
            ),
            columns: { guestPhone: true, guestName: true }
        });

        const phones = bookingsWithGuests.map(b => b.guestPhone);

        const profiles = phones.length > 0 ? await db.query.guestProfiles.findMany({
            where: and(
                eq(guestProfiles.hotelId, hotelId),
                inArray(guestProfiles.phone, phones)
            ),
            columns: { phone: true, nationality: true, fullName: true }
        }) : [];

        const phoneToNationality = new Map(profiles.map(p => [p.phone, p.nationality || 'Unknown']));

        const nationalityCounts: Record<string, number> = {};
        for (const booking of bookingsWithGuests) {
            const nat = phoneToNationality.get(booking.guestPhone) || 'Unknown';
            nationalityCounts[nat] = (nationalityCounts[nat] || 0) + 1;
        }

        const data = Object.entries(nationalityCounts)
            .map(([nationality, guestCount]) => ({ nationality, guestCount }))
            .sort((a, b) => b.guestCount - a.guestCount);

        return { data, totalGuests: bookingsWithGuests.length, startDate: startDate.toISOString().split('T')[0] };
    },

    async getInHouseGuests(hotelId: number) {
        const now = new Date();
        const inHouse = await db.query.bookings.findMany({
            where: and(
                eq(bookings.hotelId, hotelId),
                eq(bookings.status, 'CHECKED_IN'),
                lte(bookings.checkIn, now),
                gte(bookings.checkOut, now)
            ),
            with: { room: { columns: { number: true, type: true } } },
            orderBy: [desc(bookings.checkIn)]
        });

        return inHouse.map(b => ({
            bookingId: b.id,
            guestName: b.guestName,
            guestPhone: b.guestPhone,
            guestEmail: b.guestEmail,
            roomNumber: b.room?.number,
            roomType: b.room?.type,
            checkIn: b.checkIn,
            checkOut: b.checkOut,
            guestCount: b.guestCount
        }));
    }
};
