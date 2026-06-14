import { db } from '../../db';
import { payments, bookings, housekeepingTasks, guestProfiles, orders, invoices, purchaseOrders, banquetBookings, goodsReceiptNotes, payrollSummaries, vendorPayments, users, vendors } from '../../db/schema';
import { eq, and, sql, gte, lte, sum, count, desc, inArray, isNull, or, type SQL } from 'drizzle-orm';
import { relationOne } from '../../utils/relation';

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
            const [grnList, payrollRows, supplierPaymentRows] = await Promise.all([
                db.query.goodsReceiptNotes.findMany({
                    where: and(eq(goodsReceiptNotes.hotelId, hotelId), gte(goodsReceiptNotes.createdAt, start), lte(goodsReceiptNotes.createdAt, end)),
                    orderBy: [desc(goodsReceiptNotes.createdAt)],
                }),
                db.select({
                    payroll: payrollSummaries,
                    employeeName: users.fullName,
                })
                    .from(payrollSummaries)
                    .leftJoin(users, eq(payrollSummaries.userId, users.id))
                    .where(and(
                        eq(payrollSummaries.hotelId, hotelId),
                        eq(payrollSummaries.status, 'PAID'),
                        gte(payrollSummaries.createdAt, start),
                        lte(payrollSummaries.createdAt, end),
                    ))
                    .orderBy(desc(payrollSummaries.createdAt)),
                db.select({
                    payment: vendorPayments,
                    vendorName: vendors.name,
                })
                    .from(vendorPayments)
                    .leftJoin(vendors, eq(vendorPayments.vendorId, vendors.id))
                    .where(and(
                        eq(vendorPayments.hotelId, hotelId),
                        gte(vendorPayments.createdAt, start),
                        lte(vendorPayments.createdAt, end),
                    ))
                    .orderBy(desc(vendorPayments.createdAt)),
            ]);

            type ExpenseRow = { date: Date | string; ref: string; party: string; category: string; status: string; amount: number };
            const expenseRows: ExpenseRow[] = [];

            for (const grn of grnList) {
                expenseRows.push({
                    date: grn.createdAt || start,
                    ref: grn.grnNumber,
                    party: 'Supplier',
                    category: 'Procurement (GRN)',
                    status: 'RECEIVED',
                    amount: n(grn.grandTotal),
                });
            }
            for (const row of payrollRows) {
                const p = row.payroll;
                expenseRows.push({
                    date: p.createdAt || start,
                    ref: `PAY-${p.id}`,
                    party: row.employeeName || 'Staff',
                    category: 'Salary / Payroll',
                    status: p.status || 'PAID',
                    amount: n(p.netPay),
                });
            }
            for (const row of supplierPaymentRows) {
                const vp = row.payment;
                expenseRows.push({
                    date: vp.createdAt || start,
                    ref: vp.reference || `VP-${vp.id}`,
                    party: row.vendorName || 'Supplier',
                    category: 'Supplier Payment',
                    status: vp.paymentMethod || 'PAID',
                    amount: n(vp.amount),
                });
            }

            expenseRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            let total = 0;
            const byCategory: Record<string, number> = {};
            const rows = expenseRows.map(r => {
                total += r.amount;
                byCategory[r.category] = (byCategory[r.category] || 0) + r.amount;
                return [fmtDate(r.date), r.ref, r.party, r.category, r.status, r.amount.toFixed(2)];
            });

            return {
                type, title: 'Purchase / Expense Report', from, to,
                columns: ['Date', 'Reference', 'Party', 'Category', 'Status', 'Amount'],
                rows,
                summary: [
                    { label: 'Total Expenses', value: total.toFixed(2) },
                    { label: 'Line Items', value: String(rows.length) },
                    ...Object.entries(byCategory).map(([cat, v]) => ({ label: cat, value: v.toFixed(2) })),
                ],
            };
        }

        if (type === 'sales') {
            return this.getSalesIncomeReport(hotelId, from, to, start, end);
        }

        // Fallback for unknown types
        return this.getSalesIncomeReport(hotelId, from, to, start, end);
    },

    async getSalesIncomeReport(hotelId: number, from: string, to: string, start: Date, end: Date): Promise<ReportPayload> {
        const n = (v: unknown) => Number(v ?? 0);

        const [invoiceList, banquetList, orderList] = await Promise.all([
            db.query.invoices.findMany({
                where: and(
                    eq(invoices.hotelId, hotelId),
                    eq(invoices.isVoided, false),
                    gte(invoices.createdAt, start),
                    lte(invoices.createdAt, end),
                ),
                orderBy: [desc(invoices.createdAt)],
            }),
            db.query.banquetBookings.findMany({
                where: and(
                    eq(banquetBookings.hotelId, hotelId),
                    isNull(banquetBookings.invoiceId),
                    inArray(banquetBookings.status, ['CONFIRMED', 'COMPLETED']),
                    gte(banquetBookings.eventDate, sql`${from}::date`),
                    lte(banquetBookings.eventDate, sql`${to}::date`),
                ),
                orderBy: [desc(banquetBookings.eventDate)],
            }),
            db.query.orders.findMany({
                where: and(
                    eq(orders.hotelId, hotelId),
                    gte(orders.createdAt, start),
                    lte(orders.createdAt, end),
                    or(eq(orders.status, 'SERVED'), eq(orders.paymentStatus, 'PAID')),
                ),
                orderBy: [desc(orders.createdAt)],
            }),
        ]);

        const invoiceIdsFromBanquets = new Set(
            (await db.query.banquetBookings.findMany({
                where: and(eq(banquetBookings.hotelId, hotelId), sql`${banquetBookings.invoiceId} IS NOT NULL`),
                columns: { invoiceId: true },
            })).map(b => b.invoiceId).filter(Boolean) as string[],
        );

        const invoicedBookingIds = new Set(
            invoiceList.filter(inv => inv.bookingId).map(inv => inv.bookingId as string),
        );

        type SaleRow = { date: Date | string; ref: string; customer: string; source: string; status: string; amount: number; vat: number };
        const saleRows: SaleRow[] = [];

        for (const inv of invoiceList) {
            const source = inv.bookingId
                ? 'Booking'
                : (invoiceIdsFromBanquets.has(inv.id) ? 'Venue Booking' : 'Other');
            saleRows.push({
                date: inv.createdAt || start,
                ref: inv.invoiceNumber,
                customer: inv.guestName || 'Guest',
                source,
                status: inv.paymentStatus || 'UNPAID',
                amount: n(inv.grandTotal),
                vat: n(inv.vatAmount),
            });
        }

        for (const evt of banquetList) {
            saleRows.push({
                date: evt.eventDate || start,
                ref: `EVT-${String(evt.id).slice(0, 8)}`,
                customer: evt.organizerName,
                source: 'Venue Booking',
                status: evt.status || 'CONFIRMED',
                amount: n(evt.totalAmount),
                vat: 0,
            });
        }

        for (const order of orderList) {
            if (order.bookingId && invoicedBookingIds.has(order.bookingId)) continue;
            if (order.paymentStatus !== 'PAID' && order.status !== 'SERVED') continue;

            const orderType = (order.orderType || 'ROOM_SERVICE').toUpperCase();
            const isPos = !order.bookingId && (orderType === 'DINE_IN' || orderType === 'QR');
            const source = isPos ? 'POS' : 'Order';

            saleRows.push({
                date: order.createdAt || start,
                ref: order.orderNumber || `ORD-${String(order.id).slice(0, 8)}`,
                customer: order.customerName || 'Walk-in',
                source,
                status: order.paymentStatus || order.status || 'SERVED',
                amount: n(order.totalAmount),
                vat: n(order.vatAmount),
            });
        }

        saleRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        let total = 0;
        let vat = 0;
        const bySource: Record<string, number> = {};
        const rows = saleRows.map(r => {
            total += r.amount;
            vat += r.vat;
            bySource[r.source] = (bySource[r.source] || 0) + r.amount;
            return [fmtDate(r.date), r.ref, r.customer, r.source, r.status, r.amount.toFixed(2)];
        });

        return {
            type: 'sales',
            title: 'Sales / Income Report',
            from,
            to,
            columns: ['Date', 'Reference', 'Customer', 'Source', 'Status', 'Amount'],
            rows,
            summary: [
                { label: 'Total Sales', value: total.toFixed(2) },
                { label: 'VAT', value: vat.toFixed(2) },
                { label: 'Transactions', value: String(rows.length) },
                ...Object.entries(bySource).map(([src, v]) => ({ label: src, value: v.toFixed(2) })),
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
                room: { columns: { number: true } },
                items: { with: { menuItem: { columns: { name: true } } } },
            },
            orderBy: (o, { desc }) => [desc(o.createdAt)],
            limit: 500,
        });

        return rows.map(o => {
            const createdBy = o.createdBy as { fullName?: string } | null;
            const table = o.restaurantTable as { tableNumber?: string } | null;
            const room = o.room as { number?: number } | null;
            const itemNotes = o.items.map((it: any) => it.notes).filter(Boolean);
            return {
                id: o.id,
                orderNumber: o.orderNumber,
                orderType: o.orderType,
                status: o.status,
                paymentStatus: o.paymentStatus,
                customerName: o.customerName,
                waiterId: o.createdById,
                waiterName: createdBy?.fullName || (o.createdById ? 'Staff' : 'Guest / Self-order'),
                tableNumber: table?.tableNumber ?? null,
                roomNumber: room?.number ?? null,
                subTotal: parseFloat(o.subTotal || '0'),
                totalAmount: parseFloat(o.totalAmount || '0'),
                items: o.items.map((it: any) => ({
                    name: it.menuItem?.name ?? 'Item',
                    quantity: it.quantity,
                    price: parseFloat(it.price || '0'),
                    lineTotal: parseFloat(it.price || '0') * it.quantity,
                    notes: it.notes || null,
                    status: it.status,
                })),
                itemCount: o.items.reduce((s: number, it: any) => s + it.quantity, 0),
                notes: o.notes || (itemNotes.length ? itemNotes.join('; ') : null),
                createdAt: o.createdAt,
                updatedAt: o.updatedAt,
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
        const arrivals = await db.query.bookings.findMany({
            where: and(
                eq(bookings.hotelId, hotelId),
                sql`(${bookings.checkIn})::date = ${dateStr}::date`,
                inArray(bookings.status, ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT']),
            ),
            with: { room: { columns: { number: true, type: true } } },
            orderBy: [desc(bookings.checkIn)],
        });

        return arrivals.map(b => ({
            bookingId: b.id,
            guestName: b.guestName,
            guestPhone: b.guestPhone,
            roomNumber: relationOne(b.room)?.number,
            roomType: relationOne(b.room)?.type,
            checkIn: b.checkIn,
            checkOut: b.checkOut,
            status: b.status,
            source: b.source,
        }));
    },

    async getDeparturesReport(hotelId: number, dateStr: string) {
        const departures = await db.query.bookings.findMany({
            where: and(
                eq(bookings.hotelId, hotelId),
                sql`(${bookings.checkOut})::date = ${dateStr}::date`,
                inArray(bookings.status, ['CHECKED_IN', 'CHECKED_OUT']),
            ),
            with: { room: { columns: { number: true, type: true } } },
            orderBy: [desc(bookings.checkOut)],
        });

        return departures.map(b => ({
            bookingId: b.id,
            guestName: b.guestName,
            guestPhone: b.guestPhone,
            roomNumber: relationOne(b.room)?.number,
            roomType: relationOne(b.room)?.type,
            checkIn: b.checkIn,
            checkOut: b.checkOut,
            totalAmount: b.totalAmount,
            isPaid: b.isPaid,
            status: b.status,
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
            roomNumber: relationOne(b.room)?.number,
            checkIn: b.checkIn,
            checkOut: b.checkOut,
            type: 'CANCELLED',
            lostRevenue: b.totalAmount
        }));

        const noShowData = noShows.map(b => ({
            bookingId: b.id,
            guestName: b.guestName,
            guestPhone: b.guestPhone,
            roomNumber: relationOne(b.room)?.number,
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
        const inHouse = await db.query.bookings.findMany({
            where: and(
                eq(bookings.hotelId, hotelId),
                eq(bookings.status, 'CHECKED_IN'),
            ),
            with: { room: { columns: { number: true, type: true } } },
            orderBy: [desc(bookings.checkIn)],
        });

        return inHouse.map(b => ({
            bookingId: b.id,
            guestName: b.guestName,
            guestPhone: b.guestPhone,
            guestEmail: b.guestEmail,
            roomNumber: relationOne(b.room)?.number,
            roomType: relationOne(b.room)?.type,
            checkIn: b.checkIn,
            checkOut: b.checkOut,
            guestCount: b.guestCount
        }));
    }
};
