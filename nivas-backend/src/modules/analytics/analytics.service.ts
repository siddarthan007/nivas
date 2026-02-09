import { db } from '../../db';
import { bookings, orders, rooms, payments, housekeepingTasks, hotels, users, shifts, nightAudits } from '../../db/schema';
import { eq, and, sql, gte, lte, count, sum, lt, desc } from 'drizzle-orm';

export const AnalyticsService = {
    async getRealtimeDashboard(hotelId: number) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const [activeBookings] = await db.select({ value: count() })
            .from(bookings)
            .where(and(
                eq(bookings.hotelId, hotelId),
                eq(bookings.status, 'CHECKED_IN')
            ));

        const [pendingOrders] = await db.select({ value: count() })
            .from(orders)
            .where(and(
                eq(orders.hotelId, hotelId),
                eq(orders.status, 'PENDING')
            ));

        // Today's revenue
        const [todayRevenue] = await db.select({ value: sum(payments.amount) })
            .from(payments)
            .where(and(
                eq(payments.hotelId, hotelId),
                gte(payments.createdAt, today),
                lt(payments.createdAt, tomorrow)
            ));

        // Room status breakdown
        const roomStatusBreakdown = await db.select({
            status: rooms.status,
            count: count()
        })
            .from(rooms)
            .where(eq(rooms.hotelId, hotelId))
            .groupBy(rooms.status);

        // Calculate occupancy
        const [totalRooms] = await db.select({ value: count() })
            .from(rooms)
            .where(eq(rooms.hotelId, hotelId));

        const occupiedCount = roomStatusBreakdown.find(r => r.status === 'OCCUPIED')?.count ?? 0;
        const occupancyRate = totalRooms?.value ? ((occupiedCount / totalRooms.value) * 100).toFixed(1) : 0;

        // Pending housekeeping tasks
        const [pendingHousekeeping] = await db.select({ value: count() })
            .from(housekeepingTasks)
            .where(and(
                eq(housekeepingTasks.hotelId, hotelId),
                eq(housekeepingTasks.status, 'PENDING')
            ));

        // Today's check-ins/check-outs
        const [todayCheckIns] = await db.select({ value: count() })
            .from(bookings)
            .where(and(
                eq(bookings.hotelId, hotelId),
                gte(bookings.checkIn, today),
                lt(bookings.checkIn, tomorrow)
            ));

        const [todayCheckOuts] = await db.select({ value: count() })
            .from(bookings)
            .where(and(
                eq(bookings.hotelId, hotelId),
                gte(bookings.checkOut, today),
                lt(bookings.checkOut, tomorrow)
            ));

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
                expectedCheckOuts: todayCheckOuts?.value ?? 0
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

        return {
            period: { days, startDate: startDate.toISOString().split('T')[0] },
            summary: {
                totalRevenue: currentTotal,
                previousPeriod: previousTotal,
                growthRate: parseFloat(growthRate as string),
                trend: currentTotal >= previousTotal ? 'UP' : 'DOWN'
            },
            daily: dailyRevenue.map(d => ({
                date: d.date,
                revenue: parseFloat(d.total ?? '0'),
                transactions: d.count
            })),
            byPaymentMethod: revenueByMethod.map(m => ({
                method: m.method,
                total: parseFloat(m.total ?? '0'),
                count: m.count
            }))
        };
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
            currentOccupancy: roomTypeBreakdown.reduce((acc, r) => {
                acc[r.type ?? 'UNKNOWN'] = {
                    total: r.total,
                    occupied: Number(r.occupied ?? 0),
                    rate: r.total > 0 ? ((Number(r.occupied ?? 0) / r.total) * 100).toFixed(1) : 0
                };
                return acc;
            }, {} as Record<string, { total: number; occupied: number; rate: string | number }>),
            averageOccupancy: avgOccupancy.toFixed(1),
            history: occupancyHistory.map(n => ({
                date: n.auditDate,
                occupancy: parseFloat(n.occupancyPercentage ?? '0'),
                roomRevenue: parseFloat(n.totalRoomRevenue ?? '0'),
                fnbRevenue: parseFloat(n.totalFnbRevenue ?? '0')
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
            ? auditLogs.length * (parseFloat(auditLogs[0]?.occupancyPercentage ?? '0') / 100 * totalRooms)
            : 0;

        // CALCULATIONS
        const adr = roomsSold > 0 ? (totalRevenue / roomsSold) : 0;
        const revpar = availableRoomNights > 0 ? (totalRevenue / availableRoomNights) : 0;

        return {
            timeframe: `${days} Days`,
            totalRevenue,
            roomsSold: Math.round(roomsSold),
            availableRoomNights,
            metrics: {
                adr: adr.toFixed(2),
                revpar: revpar.toFixed(2),
                occupancy: availableRoomNights > 0 ? ((roomsSold / availableRoomNights) * 100).toFixed(1) : 0
            }
        };
    }
};
