import { Elysia, t } from 'elysia';
import { SyncService } from './sync.service';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { ValidationError } from '../../utils/errors';

export const syncController = new Elysia({ prefix: '/sync' })
    .use(authMiddleware)
    .get('/pull', async ({ user, query }) => {
        if (!user || !user.hotelId) throw new ValidationError('User must be associated with a hotel');
        const { tables, since, device_id } = query;
        const tableList = tables ? tables.split(',') : [];
        return SyncService.pull(user.hotelId, device_id, tableList, since || new Date(0).toISOString());
    }, {
        isSignedIn: true,
        query: t.Object({
            tables: t.Optional(t.String()),
            since: t.Optional(t.String()),
            device_id: t.String()
        })
    })
    .post('/push', async ({ user, body }) => {
        if (!user || !user.hotelId) throw new ValidationError('User must be associated with a hotel');
        const { device_id, mutations } = body;
        return SyncService.push(user.hotelId, device_id, mutations);
    }, {
        isSignedIn: true,
        body: t.Object({
            device_id: t.String(),
            mutations: t.Array(t.Object({
                table: t.String(),
                action: t.Union([t.Literal('INSERT'), t.Literal('UPDATE'), t.Literal('DELETE')]),
                record: t.Any()
            }))
        })
    })
    .get('/status', async ({ user, query }) => {
        if (!user || !user.hotelId) throw new ValidationError('User must be associated with a hotel');
        return SyncService.getStatus(user.hotelId, query.device_id);
    }, {
        isSignedIn: true,
        query: t.Object({
            device_id: t.String()
        })
    });
