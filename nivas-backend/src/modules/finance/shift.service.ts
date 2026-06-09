import { db } from '../../db';
import { shifts, payments } from '../../db/schema';
import { eq, and, sum, gte } from 'drizzle-orm';
import { BusinessLogicError, NotFoundError } from '../../utils/errors';
import { logAction } from '../system/audit.service';

export const ShiftService = {
    async getCurrent(userId: string) {
        const shift = await db.query.shifts.findFirst({
            where: and(eq(shifts.userId, userId), eq(shifts.status, 'OPEN'))
        });
        return shift ?? null;
    },

    async open(hotelId: number, userId: string, startFloat: number, ipAddress?: string) {
        const existing = await db.query.shifts.findFirst({
            where: and(eq(shifts.userId, userId), eq(shifts.status, 'OPEN'))
        });

        if (existing) {
            throw new BusinessLogicError('You already have an open shift. Please close it first.');
        }

        const [newShift] = await db.insert(shifts).values({
            hotelId,
            userId,
            startFloat: startFloat.toString(),
            status: 'OPEN',
            startTime: new Date()
        }).returning();

        if (newShift) {
            await logAction(hotelId, userId, 'START_SHIFT', 'SHIFT', newShift.id, { startFloat }, ipAddress);
        }

        return newShift;
    },

    async close(hotelId: number, userId: string, endCashCount: number, notes?: string, ipAddress?: string) {
        const currentShift = await db.query.shifts.findFirst({
            where: and(eq(shifts.userId, userId), eq(shifts.status, 'OPEN'))
        });

        if (!currentShift) throw new NotFoundError('Open shift');

        const result = await db.transaction(async (tx) => {
            const [cashResult] = await tx.select({ total: sum(payments.amount) })
                .from(payments)
                .where(and(
                    eq(payments.recordedById, userId),
                    eq(payments.paymentMethod, 'CASH'),
                    gte(payments.createdAt, currentShift.startTime!)
                ));

            const cashCollected = parseFloat(cashResult?.total || '0');
            const startFloat = parseFloat(currentShift.startFloat || '0');
            const systemTotal = startFloat + cashCollected;
            const variance = endCashCount - systemTotal;

            const [closedShift] = await tx.update(shifts)
                .set({
                    endTime: new Date(),
                    endCashCount: endCashCount.toString(),
                    systemCashTotal: systemTotal.toString(),
                    variance: variance.toString(),
                    status: 'CLOSED',
                    notes
                })
                .where(eq(shifts.id, currentShift.id))
                .returning();

            return {
                shift: closedShift,
                summary: {
                    startedWith: startFloat,
                    collected: cashCollected,
                    shouldHave: systemTotal,
                    actuallyHas: endCashCount,
                    variance,
                    varianceStatus: variance === 0 ? 'BALANCED' as const : variance > 0 ? 'OVER' as const : 'SHORT' as const
                }
            };
        });

        await logAction(hotelId, userId, 'END_SHIFT', 'SHIFT', currentShift.id, {
            variance: result.summary.variance,
            varianceStatus: result.summary.varianceStatus,
            systemTotal: result.summary.shouldHave,
            actualCount: result.summary.actuallyHas
        }, ipAddress);

        return result;
    }
};
