import { db } from '../../db';
import { bookings, orders, rooms, payments, housekeepingTasks, hotels, users, shifts, nightAudits, invoices, menuItems, purchaseOrders, guests } from '../../db/schema';
import { eq, and, sql, gte, lte, count, sum, lt, desc, isNotNull, isNull, inArray } from 'drizzle-orm';

export const AnalyticsService = {
    async getRealtimeDashboard(hotelId: number) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // These 17 metrics are independent — run them concurrently (one round of
        // parallel queries) instead of 17 sequential round-trips.
        const [
            [activeBookings],
            [pendingOrders],
            [todayRevenue],
            roomStatusBreakdown,
            [totalRooms],
            [pendingHousekeeping],
            [todayCheckIns],
            [todayCheckOuts],
            [todayUnpaid],
            [todayDiscount],
            [totalDue],
            [totalPurchase],
            [totalOrders],
            [qrOrders],
            [totalMenuItems],
            [totalEmployees],
            [totalAdvancePayments],
        ] = await Promise.all([
            db.select({ value: count() }).from(bookings)
                .where(and(eq(bookings.hotelId, hotelId), eq(bookings.status, 'CHECKED_IN'))),
            db.select({ value: count() }).from(orders)
                .where(and(eq(orders.hotelId, hotelId), eq(orders.status, 'PENDING'))),
            db.select({ value: sum(payments.amount) }).from(payments)
                .where(and(eq(payments.hotelId, hotelId), gte(payments.createdAt, today), lt(payments.createdAt, tomorrow))),
            db.select({ status: rooms.status, count: count() }).from(rooms)
                .where(eq(rooms.hotelId, hotelId)).groupBy(rooms.status),
            db.select({ value: count() }).from(rooms).where(eq(rooms.hotelId, hotelId)),
            db.select({ value: count() }).from(housekeepingTasks)
                .where(and(eq(housekeepingTasks.hotelId, hotelId), eq(housekeepingTasks.status, 'PENDING'))),
            db.select({ value: count() }).from(bookings)
                .where(and(eq(bookings.hotelId, hotelId), gte(bookings.checkIn, today), lt(bookings.checkIn, tomorrow))),
            db.select({ value: count() }).from(bookings)
                .where(and(eq(bookings.hotelId, hotelId), gte(bookings.checkOut, today), lt(bookings.checkOut, tomorrow))),
            db.select({ value: sum(invoices.grandTotal) }).from(invoices)
                .where(and(eq(invoices.hotelId, hotelId), inArray(invoices.paymentStatus, ['UNPAID', 'CREDIT']), gte(invoices.createdAt, today), lt(invoices.createdAt, tomorrow))),
            db.select({ value: sum(invoices.discountAmount) }).from(invoices)
                .where(and(eq(invoices.hotelId, hotelId), gte(invoices.createdAt, today), lt(invoices.createdAt, tomorrow))),
            db.select({ value: sum(invoices.grandTotal) }).from(invoices)
                .where(and(eq(invoices.hotelId, hotelId), inArray(invoices.paymentStatus, ['UNPAID', 'CREDIT']))),
            db.select({ value: sum(purchaseOrders.totalCost) }).from(purchaseOrders)
                .where(and(eq(purchaseOrders.hotelId, hotelId), gte(purchaseOrders.createdAt, today), lt(purchaseOrders.createdAt, tomorrow))),
            db.select({ value: count() }).from(orders)
                .where(and(eq(orders.hotelId, hotelId), gte(orders.createdAt, today), lt(orders.createdAt, tomorrow))),
            db.select({ value: count() }).from(orders)
                .where(and(eq(orders.hotelId, hotelId), eq(orders.orderType, 'QR'), gte(orders.createdAt, today), lt(orders.createdAt, tomorrow))),
            db.select({ value: count() }).from(menuItems).where(eq(menuItems.hotelId, hotelId)),
            db.select({ value: count() }).from(users)
                .where(and(eq(users.hotelId, hotelId), eq(users.isActive, true))),
            db.select({ value: sum(bookings.advancePayment) }).from(bookings)
                .where(and(eq(bookings.hotelId, hotelId), sql`${bookings.advancePayment} > 0`)),
        ]);

        // Occupancy from the room-status breakdown
        const occupiedCount = roomStatusBreakdown.find(r => r.status === 'OCCUPIED')?.count ?? 0;
        const occupancyRate = totalRooms?.value ? ((occupiedCount / totalRooms.value) * 100).toFixed(1) : 0;

        // Today's profit = revenue - discount - purchase
        const todayProfit = parseFloat(todayRevenue?.value ?? '0')
            - parseFloat(todayDiscount?.value ?? '0')
            - parseFloat(totalPurchase?.value ?? '0');

        // Best hour (last 30 days) from orders
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const ordersByHour = await db.select({
            hour: sql<string>`EXTRACT(HOUR FROM ${orders.createdAt})`,
            count: count()
        })
            .from(orders)
            .where(and(
                eq(orders.hotelId, hotelId),
                gte(orders.createdAt, thirtyDaysAgo)
            ))
            .groupBy(sql`EXTRACT(HOUR FROM ${orders.createdAt})`)
            .orderBy(desc(count()));
        const bestHour = ordersByHour[0]?.hour != null ? `${ordersByHour[0].hour}:00` : '--';

        return {
            realtime: {
                activeGuests: activeBookings?.value ?? 0,
                pendingOrders: pendingOrders?.value ?? 0,
                pendingHousekeeping: pendingHousekeeping?.value ?? 0,
                occupancyRate: parseFloat(occupancyRate as string)
            },
            today: {
                revenue: parseFloat(todayRevenue?.value ?? '0'),
                expectedCheckIns: todayCheckIns?.value ?? 0,
                expectedCheckOuts: todayCheckOuts?.value ?? 0,
                unpaid: parseFloat(todayUnpaid?.value ?? '0'),
                discount: parseFloat(todayDiscount?.value ?? '0'),
                totalPurchase: parseFloat(totalPurchase?.value ?? '0'),
                totalOrders: totalOrders?.value ?? 0,
                qrOrders: qrOrders?.value ?? 0,
                todayProfit,
                bestHour,
            },
            financials: {
                totalDue: parseFloat(totalDue?.value ?? '0'),
                totalAdvancePayments: parseFloat(totalAdvancePayments?.value ?? '0'),
            },
            inventory: {
                totalMenuItems: totalMenuItems?.value ?? 0,
            },
            staff: {
                totalEmployees: totalEmployees?.value ?? 0,
            },
            rooms: {
                total: totalRooms?.value ?? 0,
                breakdown: roomStatusBreakdown.reduce((acc, r) => {
                    acc[r.status ?? 'UNKNOWN'] = r.count;
                    return acc;
                }, {} as Record<string, number>)
            }
        };
    },

    async getRevenueAnalytics(hotelId: number, days: number) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        // Daily revenue breakdown
        const dailyRevenue = await db.select({
            date: sql<string>`DATE(${payments.createdAt})`,
            total: sum(payments.amount),
            count: count()
        })
            .from(payments)
            .where(and(
                eq(payments.hotelId, hotelId),
                gte(payments.createdAt, startDate)
            ))
            .groupBy(sql`DATE(${payments.createdAt})`)
            .orderBy(sql`DATE(${payments.createdAt})`);

        // Revenue by payment method
        const revenueByMethod = await db.select({
            method: payments.paymentMethod,
            total: sum(payments.amount),
            count: count()
        })
            .from(payments)
            .where(and(
                eq(payments.hotelId, hotelId),
                gte(payments.createdAt, startDate)
            ))
            .groupBy(payments.paymentMethod);

        // Total for period
        const [periodTotal] = await db.select({ value: sum(payments.amount) })
            .from(payments)
            .where(and(
                eq(payments.hotelId, hotelId),
                gte(payments.createdAt, startDate)
            ));

        // Previous period comparison
        const prevStartDate = new Date(startDate);
        prevStartDate.setDate(prevStartDate.getDate() - days);
        const [prevPeriodTotal] = await db.select({ value: sum(payments.amount) })
            .from(payments)
            .where(and(
                eq(payments.hotelId, hotelId),
                gte(payments.createdAt, prevStartDate),
                lt(payments.createdAt, startDate)
            ));

        const currentTotal = parseFloat(periodTotal?.value ?? '0');
        const previousTotal = parseFloat(prevPeriodTotal?.value ?? '0');
        const growthRate = previousTotal > 0 ? (((currentTotal - previousTotal) / previousTotal) * 100).toFixed(1) : 0;

        // Daily F&B orders trend
        const dailyFb = await db.select({
            date: sql<string>`DATE(${orders.createdAt})`,
            total: sum(orders.totalAmount),
            count: count()
        })
            .from(orders)
            .where(and(
                eq(orders.hotelId, hotelId),
                gte(orders.createdAt, startDate),
                eq(orders.status, 'SERVED')
            ))
            .groupBy(sql`DATE(${orders.createdAt})`)
            .orderBy(sql`DATE(${orders.createdAt})`);

        // Revenue split: invoices already know the correct room vs F&B split at
        // generation time (BillingService separates roomCharge and ordersTotal).
        // Walk-in orders without a booking are added to F&B directly.
        const [invRoom] = await db.select({ v: sum(invoices.roomRevenue) }).from(invoices)
            .where(and(eq(invoices.hotelId, hotelId), gte(invoices.createdAt, startDate)));
        const [invFb] = await db.select({ v: sum(invoices.fbRevenue) }).from(invoices)
            .where(and(eq(invoices.hotelId, hotelId), gte(invoices.createdAt, startDate)));
        const [walkInFb] = await db.select({ v: sum(orders.totalAmount) }).from(orders)
            .where(and(eq(orders.hotelId, hotelId), gte(orders.createdAt, startDate), eq(orders.status, 'SERVED'), isNull(orders.bookingId)));

        const roomRev = parseFloat(invRoom?.v ?? '0');
        const fbRev = parseFloat(invFb?.v ?? '0') + parseFloat(walkInFb?.v ?? '0');
        const otherRev = Math.max(0, currentTotal - roomRev - fbRev);

        return {
            totalRevenue: currentTotal,
            roomRevenue: roomRev,
            fbRevenue: fbRev,
            otherRevenue: otherRev,
            trend: dailyRevenue.map(d => ({ date: d.date, amount: parseFloat(d.total ?? '0') })),
            fbTrend: dailyFb.map(d => ({ date: d.date, amount: parseFloat(d.total ?? '0'), orders: Number(d.count ?? 0) })),
            comparison: {
                current: currentTotal,
                previous: previousTotal,
                change: parseFloat(growthRate as string)
            }
        };
    },

    /**
     * Front-desk sales insights for the dashboard: revenue by weekday, busiest
     * hours, daily visitor (arrival) counts, and today's guest birthdays.
     */
    async getSalesInsights(hotelId: number) {
        const since = (daysBack: number) => {
            const d = new Date();
            d.setDate(d.getDate() - daysBack);
            d.setHours(0, 0, 0, 0);
            return d;
        };

        // Revenue by day-of-week over the last 8 weeks (stable weekly pattern).
        const weekdayRows = await db.select({
            dow: sql<number>`EXTRACT(DOW FROM ${payments.createdAt})::int`,
            total: sum(payments.amount),
        })
            .from(payments)
            .where(and(eq(payments.hotelId, hotelId), gte(payments.createdAt, since(56))))
            .groupBy(sql`EXTRACT(DOW FROM ${payments.createdAt})`);

        const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const weekdayMap = new Map(weekdayRows.map(r => [Number(r.dow), parseFloat(r.total ?? '0')]));
        // Present Monday-first to match common front-desk reporting.
        const order = [1, 2, 3, 4, 5, 6, 0];
        const weeklyByWeekday = order.map(dow => ({
            weekday: WEEK[dow]!,
            amount: weekdayMap.get(dow) ?? 0,
        }));

        // Busiest hours by F&B order revenue over the last 30 days.
        const hourRows = await db.select({
            hour: sql<number>`EXTRACT(HOUR FROM ${orders.createdAt})::int`,
            total: sum(orders.totalAmount),
            cnt: count(),
        })
            .from(orders)
            .where(and(eq(orders.hotelId, hotelId), gte(orders.createdAt, since(30))))
            .groupBy(sql`EXTRACT(HOUR FROM ${orders.createdAt})`);

        const hourMap = new Map(hourRows.map(r => [Number(r.hour), { amount: parseFloat(r.total ?? '0'), orders: Number(r.cnt ?? 0) }]));
        const bestHours = Array.from({ length: 24 }, (_, h) => ({
            hour: h,
            label: `${((h % 12) || 12)}${h < 12 ? 'am' : 'pm'}`,
            amount: hourMap.get(h)?.amount ?? 0,
            orders: hourMap.get(h)?.orders ?? 0,
        }));

        // Visitors: arrivals per day (by check-in date) over the last 30 days.
        const visitorRows = await db.select({
            date: sql<string>`DATE(${bookings.checkIn})`,
            cnt: count(),
        })
            .from(bookings)
            .where(and(eq(bookings.hotelId, hotelId), gte(bookings.checkIn, since(30))))
            .groupBy(sql`DATE(${bookings.checkIn})`)
            .orderBy(sql`DATE(${bookings.checkIn})`);

        const visitors = visitorRows.map(r => ({ date: r.date, count: Number(r.cnt ?? 0) }));

        // Today's guest birthdays (month + day match, any year).
        const birthdayRows = await db.select({
            id: guests.id,
            fullName: guests.fullName,
            phone: guests.phone,
            isVip: guests.isVip,
        })
            .from(guests)
            .where(and(
                eq(guests.hotelId, hotelId),
                sql`${guests.dob} IS NOT NULL`,
                sql`EXTRACT(MONTH FROM ${guests.dob}) = EXTRACT(MONTH FROM CURRENT_DATE)`,
                sql`EXTRACT(DAY FROM ${guests.dob}) = EXTRACT(DAY FROM CURRENT_DATE)`
            ))
            .limit(50);

        const todaysBirthdays = birthdayRows.map(g => ({
            id: g.id,
            fullName: g.fullName,
            phone: g.phone ?? undefined,
            isVip: !!g.isVip,
        }));

        return { weeklyByWeekday, bestHours, visitors, todaysBirthdays };
    },

    async getOccupancyAnalytics(hotelId: number, days: number) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get night audit records for occupancy history
        const occupancyHistory = await db.query.nightAudits.findMany({
            where: and(
                eq(nightAudits.hotelId, hotelId),
                gte(nightAudits.runAt, startDate)
            ),
            orderBy: [desc(nightAudits.auditDate)]
        });

        // Room type breakdown
        const roomTypeBreakdown = await db.select({
            type: rooms.type,
            total: count(),
            occupied: sum(sql<number>`CASE WHEN ${rooms.status} = 'OCCUPIED' THEN 1 ELSE 0 END`)
        })
            .from(rooms)
            .where(eq(rooms.hotelId, hotelId))
            .groupBy(rooms.type);

        // Average occupancy over period
        const avgOccupancy = occupancyHistory.length > 0
            ? occupancyHistory.reduce((sum, n) => sum + parseFloat(n.occupancyPercentage ?? '0'), 0) / occupancyHistory.length
            : 0;

        return {
            averageOccupancy: avgOccupancy,
            trend: occupancyHistory.map(n => ({
                date: n.auditDate,
                occupancy: parseFloat(n.occupancyPercentage ?? '0')
            })),
            byRoomType: roomTypeBreakdown.map(r => ({
                type: r.type ?? 'UNKNOWN',
                occupancy: r.total > 0 ? (Number(r.occupied ?? 0) / r.total) * 100 : 0
            }))
        };
    },

    async getStaffPerformance(hotelId: number, days: number) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Orders handled per staff
        const ordersPerStaff = await db.select({
            staffId: orders.assignedToId,
            ordersHandled: count(),
            totalValue: sum(orders.totalAmount)
        })
            .from(orders)
            .where(and(
                eq(orders.hotelId, hotelId),
                gte(orders.createdAt, startDate),
                eq(orders.status, 'SERVED')
            ))
            .groupBy(orders.assignedToId);

        // Housekeeping tasks completed per staff
        const housekeepingPerStaff = await db.select({
            staffId: housekeepingTasks.assignedToId,
            tasksCompleted: count()
        })
            .from(housekeepingTasks)
            .where(and(
                eq(housekeepingTasks.hotelId, hotelId),
                gte(housekeepingTasks.createdAt, startDate),
                eq(housekeepingTasks.status, 'DONE')
            ))
            .groupBy(housekeepingTasks.assignedToId);

        // Shift variance (cash handling accuracy)
        const shiftMetrics = await db.select({
            staffId: shifts.userId,
            shiftsCount: count(),
            totalVariance: sum(shifts.variance)
        })
            .from(shifts)
            .where(and(
                eq(shifts.hotelId, hotelId),
                gte(shifts.createdAt, startDate),
                eq(shifts.status, 'CLOSED')
            ))
            .groupBy(shifts.userId);

        return {
            orders: ordersPerStaff.map(s => ({
                staffId: s.staffId,
                ordersHandled: s.ordersHandled,
                totalValue: parseFloat(s.totalValue ?? '0')
            })),
            housekeeping: housekeepingPerStaff,
            cashHandling: shiftMetrics.map(s => ({
                staffId: s.staffId,
                shiftsCount: s.shiftsCount,
                totalVariance: parseFloat(s.totalVariance ?? '0')
            }))
        };
    },

    async getSaaSOverview() {
        const [totalHotels] = await db.select({ value: count() }).from(hotels);
        const [activeHotels] = await db.select({ value: count() })
            .from(hotels)
            .where(eq(hotels.isActive, true));

        const [totalUsers] = await db.select({ value: count() }).from(users);
        const [totalBookings] = await db.select({ value: count() }).from(bookings);
        const [totalRevenue] = await db.select({ value: sum(payments.amount) }).from(payments);

        // Hotels by activity (last 7 days)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const activeHotelsList = await db.select({
            hotelId: bookings.hotelId,
            bookingsCount: count()
        })
            .from(bookings)
            .where(gte(bookings.createdAt, weekAgo))
            .groupBy(bookings.hotelId)
            .orderBy(desc(count()))
            .limit(10);

        return {
            totals: {
                hotels: totalHotels?.value ?? 0,
                activeHotels: activeHotels?.value ?? 0,
                users: totalUsers?.value ?? 0,
                bookings: totalBookings?.value ?? 0,
                revenue: parseFloat(totalRevenue?.value ?? '0')
            },
            topActiveHotels: activeHotelsList
        };
    },

    async getKeyMetrics(hotelId: number, days: number) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get Room Revenue
        const [revenueResult] = await db.select({ total: sum(payments.amount) })
            .from(payments)
            .where(and(
                eq(payments.hotelId, hotelId),
                gte(payments.createdAt, startDate)
            ));

        const totalRevenue = parseFloat(revenueResult?.total ?? '0');

        // Get Total Rooms (Inventory)
        const [roomsResult] = await db.select({ count: count() })
            .from(rooms)
            .where(eq(rooms.hotelId, hotelId));

        const totalRooms = roomsResult?.count ?? 0;
        const availableRoomNights = totalRooms * days;

        // Get Rooms Sold (Occupied Nights) from Night Audit history
        const auditLogs = await db.query.nightAudits.findMany({
            where: and(
                eq(nightAudits.hotelId, hotelId),
                gte(nightAudits.runAt, startDate)
            )
        });

        // Approximate if no night audits
        const roomsSold = auditLogs.length > 0
            ? auditLogs.reduce((sum, log) => sum + (parseFloat(log.occupancyPercentage ?? '0') / 100 * totalRooms), 0)
            : 0;

        // CALCULATIONS
        const adr = roomsSold > 0 ? (totalRevenue / roomsSold) : 0;
        const revpar = availableRoomNights > 0 ? (totalRevenue / availableRoomNights) : 0;

        // Approximate average length of stay from bookings
        const losBookings = await db.query.bookings.findMany({
            where: and(
                eq(bookings.hotelId, hotelId),
                gte(bookings.checkIn, startDate),
                eq(bookings.status, 'CHECKED_OUT')
            ),
            columns: { checkIn: true, checkOut: true }
        });
        const avgLos = losBookings.length > 0
            ? losBookings.reduce((sum, b) => {
                const nights = Math.max(1, Math.ceil((new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) / (1000 * 60 * 60 * 24)));
                return sum + nights;
            }, 0) / losBookings.length
            : 0;

        return {
            adr,
            revpar,
            occupancyRate: availableRoomNights > 0 ? (roomsSold / availableRoomNights) * 100 : 0,
            averageLos: avgLos
        };
    }
};
