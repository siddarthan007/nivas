import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';
import { db } from '../../db';
import { nightAudits, bookings, orders, rooms, folioCharges } from '../../db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { AuditService } from './audit.service';

export const nightAuditController = new Elysia({ prefix: '/night-audit' })
    .use(authMiddleware)
    .post('/trigger', async ({ user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');

        const ipAddress = request.headers.get('x-forwarded-for') || undefined;
        const today = new Date().toISOString().split('T')[0];

        const existing = await db.query.nightAudits.findFirst({
            where: and(
                eq(nightAudits.hotelId, user.hotelId),
                eq(nightAudits.auditDate, today!)
            )
        });

        if (existing) {
            return createResponse(existing, 'Night audit already completed for today');
        }

        const checkedInBookings = await db.query.bookings.findMany({
            where: and(
                eq(bookings.hotelId, user.hotelId),
                eq(bookings.status, 'CHECKED_IN')
            ),
            with: { room: true }
        });

        let totalRoomRevenue = 0;
        for (const booking of checkedInBookings) {
            const dailyRate = parseFloat(booking.totalAmount || '0');
            const nights = Math.max(1, Math.ceil(
                (new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24)
            ));
            const perNightRate = dailyRate / nights;
            totalRoomRevenue += perNightRate;

            await db.insert(folioCharges).values({
                hotelId: user.hotelId,
                bookingId: booking.id,
                date: today!,
                description: `Room charge - ${booking.room?.name || 'Room ' + booking.room?.number}`,
                amount: perNightRate.toFixed(2),
                type: 'ROOM_CHARGE'
            });
        }

        const totalRoomsResult = await db.select({ count: sql<number>`count(*)` })
            .from(rooms)
            .where(eq(rooms.hotelId, user.hotelId));
        const totalRooms = Number(totalRoomsResult[0]?.count || 1);
        const occupancyPct = (checkedInBookings.length / totalRooms) * 100;

        const [audit] = await db.insert(nightAudits).values({
            hotelId: user.hotelId,
            auditDate: today!,
            status: 'SUCCESS',
            totalRoomRevenue: totalRoomRevenue.toFixed(2),
            occupancyPercentage: occupancyPct.toFixed(2),
            notes: `Processed ${checkedInBookings.length} checked-in bookings`
        }).returning();

        await AuditService.log(user.hotelId, user.id, 'RUN_NIGHT_AUDIT', 'NIGHT_AUDIT', audit.id.toString(), {
            auditDate: today,
            totalRoomRevenue,
            occupancyPercentage: occupancyPct
        }, ipAddress);

        return createResponse(audit, 'Night audit completed successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.OPERATIONS.RUN_NIGHT_AUDIT,
        detail: { summary: 'Trigger manual night audit', tags: ['Finance'] }
    })
    .get('/history', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');

        const audits = await db.query.nightAudits.findMany({
            where: eq(nightAudits.hotelId, user.hotelId),
            orderBy: (na, { desc }) => [desc(na.auditDate)],
            limit: 30
        });

        return createResponse(audits, 'Night audit history fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.OPERATIONS.RUN_NIGHT_AUDIT,
        detail: { summary: 'Get night audit history', tags: ['Finance'] }
    })
    .get('/status', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');

        const today = new Date().toISOString().split('T')[0];
        const todayAudit = await db.query.nightAudits.findFirst({
            where: and(
                eq(nightAudits.hotelId, user.hotelId),
                eq(nightAudits.auditDate, today!)
            )
        });

        return createResponse({
            completedToday: !!todayAudit,
            lastAudit: todayAudit || null
        }, 'Night audit status fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.OPERATIONS.RUN_NIGHT_AUDIT,
        detail: { summary: 'Check night audit status', tags: ['Finance'] }
    });
