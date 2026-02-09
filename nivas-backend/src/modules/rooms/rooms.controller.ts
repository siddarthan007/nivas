import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { RoomsService } from './rooms.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const roomsController = new Elysia({ prefix: '/rooms' })
    .use(authMiddleware)
    .get('/', async ({ user }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }

        const hotelRooms = await RoomsService.getRooms(user.hotelId);

        return createResponse(hotelRooms, 'Rooms fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.READ,
        detail: { summary: 'List all rooms', tags: ['Operations'] }
    })
    .post('/', async ({ body, user }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }

        const newRoom = await RoomsService.createRoom(user.hotelId, body);

        return createResponse(newRoom, 'Room created successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.CREATE,
        body: t.Object({
            number: t.Number(),
            name: t.Optional(t.String()),
            type: t.String({ default: 'STANDARD' }),
            rate: t.Number({ default: 0 })
        }),
        detail: { summary: 'Create a room', tags: ['Operations'] }
    })
    .post('/bulk', async ({ body, user }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }

        // Ensure defaults for bulk items
        const safeBody = body.map(r => ({
            ...r,
            type: r.type ?? 'STANDARD',
            rate: r.rate ?? 0
        }));

        const result = await RoomsService.bulkCreateRooms(user.hotelId, safeBody);

        return createResponse(result, 'Rooms bulk created successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.CREATE,
        body: t.Array(t.Object({
            number: t.Number(),
            name: t.Optional(t.String()),
            type: t.Optional(t.String()),
            rate: t.Optional(t.Number())
        })),
        detail: { summary: 'Bulk create rooms', tags: ['Operations'] }
    })
    .patch('/:id', async ({ params, body, user }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }

        const updated = await RoomsService.updateRoom(
            user.hotelId,
            parseInt(params.id),
            body
        );

        return createResponse(updated, 'Room updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.UPDATE,
        body: t.Partial(t.Object({
            number: t.Number(),
            name: t.String(),
            type: t.String(),
            rate: t.Number(),
            status: t.String()
        })),
        detail: { summary: 'Update room details', tags: ['Operations'] }
    })
    .delete('/:id', async ({ params, user }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }

        await RoomsService.deleteRoom(user.hotelId, parseInt(params.id));

        return createResponse(null, 'Room deleted successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.DELETE,
        detail: { summary: 'Delete room', tags: ['Operations'] }
    });
