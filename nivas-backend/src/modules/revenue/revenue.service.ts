import { db } from '../../db';
import { revenueRules, rooms, bookings } from '../../db/schema';
import { eq, and, lte, gte, count, desc, inArray } from 'drizzle-orm';
import { NotFoundError } from '../../utils/errors';

export const RevenueService = {
    async createRule(hotelId: number, data: any) {
        const [rule] = await db.insert(revenueRules).values({
            hotelId,
            name: data.name,
            ruleType: data.ruleType,
            minOccupancy: data.minOccupancy,
            maxOccupancy: data.maxOccupancy,
            daysBeforeArrival: data.daysBeforeArrival,
            daysOfWeek: data.daysOfWeek,
            adjustmentType: data.adjustmentType,
            adjustmentValue: data.adjustmentValue.toString(),
            applyToRoomTypes: data.applyToRoomTypes,
            priority: data.priority,
            isActive: true
        }).returning();
        return rule;
    },

    async getAllRules(hotelId: number) {
        return await db.query.revenueRules.findMany({
            where: eq(revenueRules.hotelId, hotelId),
            orderBy: (r, { desc }) => [desc(r.priority)]
        });
    },

    async updateRule(hotelId: number, ruleId: number, data: any) {
        const allowed = ['name', 'ruleType', 'minOccupancy', 'maxOccupancy', 'daysBeforeArrival', 'daysOfWeek', 'adjustmentType', 'applyToRoomTypes', 'priority', 'isActive'];
        const updateData: any = {};
        for (const key of allowed) {
            if (data[key] !== undefined) updateData[key] = data[key];
        }
        const [updated] = await db.update(revenueRules)
            .set({
                ...updateData,
                adjustmentValue: data.adjustmentValue?.toString()
            })
            .where(and(
                eq(revenueRules.id, ruleId),
                eq(revenueRules.hotelId, hotelId)
            ))
            .returning();

        if (!updated) throw new NotFoundError('Rule');
        return updated;
    },

    async deleteRule(hotelId: number, ruleId: number) {
        await db.delete(revenueRules)
            .where(and(
                eq(revenueRules.id, ruleId),
                eq(revenueRules.hotelId, hotelId)
            ));
    },

    async calculateDynamicPrice(hotelId: number, basePrice: number, checkIn: string, roomType: string) {
        const daysUntilArrival = Math.ceil((new Date(checkIn).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const dayOfWeek = new Date(checkIn).getDay();

        const totalRooms = await db.select({ count: count() })
            .from(rooms)
            .where(eq(rooms.hotelId, hotelId));

        const bookedRooms = await db.select({ count: count() })
            .from(bookings)
            .where(and(
                eq(bookings.hotelId, hotelId),
                // Only live bookings occupy a room — exclude cancelled/checked-out
                // so occupancy (and therefore the price) isn't inflated.
                inArray(bookings.status, ['CONFIRMED', 'CHECKED_IN']),
                lte(bookings.checkIn, new Date(checkIn)),
                gte(bookings.checkOut, new Date(checkIn))
            ));

        const totalCount = totalRooms[0]?.count || 1;
        const bookedCount = bookedRooms[0]?.count || 0;
        const occupancyPercent = Math.round((bookedCount / totalCount) * 100);

        const rules = await db.query.revenueRules.findMany({
            where: and(
                eq(revenueRules.hotelId, hotelId),
                eq(revenueRules.isActive, true)
            ),
            orderBy: (r, { desc }) => [desc(r.priority)]
        });

        let adjustedPrice = basePrice;
        const appliedRules: any[] = [];

        for (const rule of rules) {
            let applies = true;

            if (rule.minOccupancy !== null && occupancyPercent < rule.minOccupancy) applies = false;
            if (rule.maxOccupancy !== null && occupancyPercent > rule.maxOccupancy) applies = false;
            if (rule.daysBeforeArrival !== null && daysUntilArrival > rule.daysBeforeArrival) applies = false;
            if (rule.daysOfWeek && rule.daysOfWeek.length > 0 && !rule.daysOfWeek.includes(dayOfWeek)) applies = false;
            if (rule.applyToRoomTypes && rule.applyToRoomTypes.length > 0 && !rule.applyToRoomTypes.includes(roomType)) applies = false;

            if (applies) {
                if (rule.adjustmentType === 'PERCENTAGE') {
                    adjustedPrice = adjustedPrice * (1 + parseFloat(rule.adjustmentValue) / 100);
                } else {
                    adjustedPrice = adjustedPrice + parseFloat(rule.adjustmentValue);
                }
                appliedRules.push({ name: rule.name, type: rule.adjustmentType, value: parseFloat(rule.adjustmentValue) });
            }
        }

        // Never let stacked rules drive the price below zero.
        adjustedPrice = Math.max(0, adjustedPrice);

        return {
            basePrice,
            adjustedPrice: Math.round(adjustedPrice * 100) / 100,
            occupancyPercent,
            daysUntilArrival,
            appliedRules
        };
    },

    async getRevenueAnalytics(hotelId: number, startDateStr?: string, endDateStr?: string) {
        const startDate = startDateStr || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = endDateStr || new Date().toISOString().split('T')[0];

        const revenueBookings = await db.query.bookings.findMany({
            where: and(
                eq(bookings.hotelId, hotelId),
                gte(bookings.checkIn, new Date(startDate!)),
                lte(bookings.checkIn, new Date(endDate!))
            )
        });

        const totalRevenue = revenueBookings.reduce((sum, b) => sum + parseFloat(b.totalAmount || '0'), 0);
        const avgDailyRate = revenueBookings.length > 0 ? totalRevenue / revenueBookings.length : 0;

        const roomCount = await db.select({ count: count() })
            .from(rooms)
            .where(eq(rooms.hotelId, hotelId));

        const totalCount = roomCount[0]?.count || 1;
        const MS = 1000 * 60 * 60 * 24;
        const rangeStart = new Date(startDate!).getTime();
        const rangeEnd = new Date(endDate!).getTime() + MS; // inclusive end day
        const daysInRange = Math.ceil((new Date(endDate!).getTime() - new Date(startDate!).getTime()) / MS) + 1;
        const potentialRoomNights = totalCount * daysInRange;

        // Sum ACTUAL room-nights within the range (was counting each booking as 1
        // night regardless of stay length — understated multi-night occupancy).
        let occupiedRoomNights = 0;
        for (const b of revenueBookings as any[]) {
            if (!b.checkIn || !b.checkOut) { occupiedRoomNights += 1; continue; }
            const start = Math.max(new Date(b.checkIn).getTime(), rangeStart);
            const end = Math.min(new Date(b.checkOut).getTime(), rangeEnd);
            occupiedRoomNights += Math.max(0, Math.round((end - start) / MS));
        }
        const occupancyRate = Math.min(100, (occupiedRoomNights / potentialRoomNights) * 100);
        const revPAR = totalRevenue / potentialRoomNights;

        return {
            dateRange: { start: startDate, end: endDate },
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            bookingsCount: revenueBookings.length,
            avgDailyRate: Math.round(avgDailyRate * 100) / 100,
            occupancyRate: Math.round(occupancyRate * 100) / 100,
            revPAR: Math.round(revPAR * 100) / 100
        };
    }
};
