import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { TablesService } from './tables.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const tablesController = new Elysia({ prefix: '/operations/tables' })
    .use(authMiddleware)
    .get('/', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const list = await TablesService.getAllTables(user.hotelId);
        return createResponse(list, 'Tables fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.OPERATIONS.SETUP_FACILITIES, // Using facility permission for now
        detail: { summary: 'List all tables', tags: ['Operations'] }
    })
    .post('/', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const newTable = await TablesService.createTable(user.hotelId, {
            ...body,
            location: body.location || 'Main Hall',
            status: body.status || 'AVAILABLE'
        });
        return createResponse(newTable, 'Table created successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.OPERATIONS.SETUP_FACILITIES,
        body: t.Object({
            tableNumber: t.String(),
            capacity: t.Number({ minimum: 1 }),
            location: t.Optional(t.String()),
            status: t.Optional(t.String())
        }),
        detail: { summary: 'Create table', tags: ['Operations'] }
    })
    .patch('/:id', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await TablesService.updateTable(user.hotelId, parseInt(params.id), body);
        return createResponse(updated, 'Table updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.OPERATIONS.SETUP_FACILITIES,
        body: t.Partial(t.Object({
            tableNumber: t.String(),
            capacity: t.Number(),
            location: t.String(),
            status: t.String()
        })),
        detail: { summary: 'Update table', tags: ['Operations'] }
    })
    .delete('/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        await TablesService.deleteTable(user.hotelId, parseInt(params.id));
        return createResponse(null, 'Table deleted successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.OPERATIONS.SETUP_FACILITIES,
        detail: { summary: 'Delete table', tags: ['Operations'] }
    })
    .patch('/:id/attach', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await TablesService.attachGuest(user.hotelId, parseInt(params.id), body);
        return createResponse(updated, 'Guest attached to table successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.OPERATIONS.SETUP_FACILITIES,
        body: t.Object({
            guestName: t.String(),
            guestId: t.Optional(t.String()),
            phone: t.Optional(t.String())
        }),
        detail: { summary: 'Attach guest to table', tags: ['Operations'] }
    })
    .patch('/:id/detach', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await TablesService.detachGuest(user.hotelId, parseInt(params.id));
        return createResponse(updated, 'Guest detached from table successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.OPERATIONS.SETUP_FACILITIES,
        detail: { summary: 'Detach guest from table', tags: ['Operations'] }
    });
