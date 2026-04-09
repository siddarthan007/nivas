import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';
import { db } from '../../db';
import { nightAudits } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { AuditService } from './audit.service';
import { NightAuditService } from '../scheduler/night-audit.service';

export const nightAuditController = new Elysia({ prefix: '/night-audit' })
    .use(authMiddleware)
    .post('/trigger', async ({ user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');

        const ipAddress = request.headers.get('x-forwarded-for') || undefined;

        const result = await NightAuditService.runAuditForHotel(user.hotelId);

        if (result.status === 'success' && result.data?.auditRecord) {
            await AuditService.log(user.hotelId, user.id, 'RUN_NIGHT_AUDIT', 'NIGHT_AUDIT', result.data.auditRecord.id.toString(), {
                roomRevenue: result.data.roomRevenue,
                occupancy: result.data.occupancy,
                bookingsProcessed: result.data.bookingsProcessed
            }, ipAddress);
        }

        return createResponse(result.data ?? result, result.status === 'skipped'
            ? 'Night audit already completed'
            : 'Night audit completed successfully');
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

