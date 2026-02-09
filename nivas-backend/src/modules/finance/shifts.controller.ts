import { Elysia, t } from 'elysia';
import { db } from '../../db';
import { shifts, payments } from '../../db/schema';
import { eq, and, sum, gte } from 'drizzle-orm';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { logAction } from '../system/audit.service';

export const shiftsController = new Elysia({ prefix: '/finance/shifts' })
    .use(authMiddleware)
    .get('/current', async ({ user }) => {
        const currentShift = await db.query.shifts.findFirst({
            where: and(
                eq(shifts.userId, user!.id),
                eq(shifts.status, 'OPEN')
            )
        });
        return { status: 'success', data: currentShift || null };
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SHIFTS.VIEW,
        detail: { summary: 'Check active shift', tags: ['Finance'] }
    })
    .post('/start', async ({ body, user, request }) => {
        const existing = await db.query.shifts.findFirst({
            where: and(eq(shifts.userId, user!.id), eq(shifts.status, 'OPEN'))
        });

        if (existing) {
            throw new Error('You already have an open shift. Please close it first.');
        }

        const [newShift] = await db.insert(shifts).values({
            hotelId: user!.hotelId!,
            userId: user!.id,
            startFloat: body.startFloat.toString(),
            status: 'OPEN',
            startTime: new Date()
        }).returning();

        if (newShift) {
            await logAction(
                user!.hotelId!,
                user!.id,
                'START_SHIFT',
                'SHIFT',
                newShift.id,
                { startFloat: body.startFloat },
                request.headers.get('x-forwarded-for') || undefined
            );
        }

        return { status: 'success', data: newShift };
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SHIFTS.START,
        body: t.Object({
            startFloat: t.Number()
        }),
        detail: { summary: 'Start a cashier shift', tags: ['Finance'] }
    })
    .post('/end', async ({ body, user, request }) => {
        const currentShift = await db.query.shifts.findFirst({
            where: and(eq(shifts.userId, user!.id), eq(shifts.status, 'OPEN'))
        });

        if (!currentShift) {
            throw new Error('No open shift found.');
        }

        const result = await db.transaction(async (tx) => {
            const [cashResult] = await tx.select({ total: sum(payments.amount) })
                .from(payments)
                .where(and(
                    eq(payments.recordedById, user!.id),
                    eq(payments.paymentMethod, 'CASH'),
                    gte(payments.createdAt, currentShift.startTime!)
                ));

            const cashCollected = parseFloat(cashResult?.total || '0');
            const startFloat = parseFloat(currentShift.startFloat || '0');
            const systemTotal = startFloat + cashCollected;

            const actualCount = body.endCashCount;
            const variance = actualCount - systemTotal;

            const [closedShift] = await tx.update(shifts)
                .set({
                    endTime: new Date(),
                    endCashCount: actualCount.toString(),
                    systemCashTotal: systemTotal.toString(),
                    variance: variance.toString(),
                    status: 'CLOSED',
                    notes: body.notes
                })
                .where(eq(shifts.id, currentShift.id))
                .returning();

            return {
                shift: closedShift,
                summary: {
                    startedWith: startFloat,
                    collected: cashCollected,
                    shouldHave: systemTotal,
                    actuallyHas: actualCount,
                    variance: variance,
                    varianceStatus: variance === 0 ? 'BALANCED' : variance > 0 ? 'OVER' : 'SHORT'
                }
            };
        });

        await logAction(
            user!.hotelId!,
            user!.id,
            'END_SHIFT',
            'SHIFT',
            currentShift.id,
            {
                variance: result.summary.variance,
                varianceStatus: result.summary.varianceStatus,
                systemTotal: result.summary.shouldHave,
                actualCount: result.summary.actuallyHas
            },
            request.headers.get('x-forwarded-for') || undefined
        );

        return {
            status: 'success',
            data: result
        };
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SHIFTS.END,
        body: t.Object({
            endCashCount: t.Number(),
            notes: t.Optional(t.String())
        }),
        detail: { summary: 'Close shift & count cash', tags: ['Finance'] }
    });