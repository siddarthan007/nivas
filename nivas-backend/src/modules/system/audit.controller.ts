import { Elysia, t } from 'elysia';
import { db } from '../../db';
import { auditLogs } from '../../db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { AuditService } from './audit.service';

export const auditController = new Elysia({ prefix: '/audit' })
    .use(authMiddleware)
    .get('/', async ({ user, query }) => {
        const limit = query.limit ? parseInt(query.limit) : 100;
        // Super Admins can view all logs, other users see only their hotel's logs
        const hotelId = user!.type === 'SUPER_ADMIN' ? undefined : (user!.hotelId ?? undefined);
        const logs = await AuditService.getLogs(hotelId, limit);

        return { status: 'success', data: logs };
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.VIEW_SAAS_ANALYTICS,
        query: t.Object({
            limit: t.Optional(t.String())
        }),
        detail: { summary: 'View audit logs', tags: ['Analytics'] }
    })
    .delete('/', async ({ body, user }) => {
        // Only Super Admins can permanently delete audit logs
        if (user!.type !== 'SUPER_ADMIN') {
            return { status: 'error', message: 'Only Super Admins can delete audit logs' };
        }

        const { ids } = body;
        if (!ids || ids.length === 0) {
            return { status: 'error', message: 'No log IDs provided' };
        }

        await db.delete(auditLogs).where(inArray(auditLogs.id, ids));

        return { status: 'success', message: `Deleted ${ids.length} audit log(s)` };
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.VIEW_SAAS_ANALYTICS,
        body: t.Object({
            ids: t.Array(t.String())
        }),
        detail: { summary: 'Delete audit logs permanently', tags: ['Analytics'] }
    });