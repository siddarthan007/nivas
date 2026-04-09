import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { RoomTypesService } from './room-types.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';
import { PERMISSIONS } from '../../config/permissions';

export const roomTypesController = new Elysia({ prefix: '/room-types' })
    .use(authMiddleware)
    .get('/', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        let types = await RoomTypesService.getByHotel(user.hotelId);
        if (types.length === 0) {
            types = await RoomTypesService.seedDefaults(user.hotelId);
        }
        return createResponse(types, 'Room types fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.READ,
        detail: { summary: 'Get hotel room types', tags: ['Rooms'] }
    })
    .post('/', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const created = await RoomTypesService.create(user.hotelId, body);
        return createResponse(created, 'Room type created');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.UPDATE,
        body: t.Object({
            name: t.String(),
            code: t.String(),
            description: t.Optional(t.String()),
            baseRate: t.Optional(t.String()),
        }),
        detail: { summary: 'Create room type', tags: ['Rooms'] }
    })
    .patch('/:id', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await RoomTypesService.update(user.hotelId, parseInt(params.id), body);
        return createResponse(updated, 'Room type updated');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.UPDATE,
        body: t.Object({
            name: t.Optional(t.String()),
            code: t.Optional(t.String()),
            description: t.Optional(t.String()),
            baseRate: t.Optional(t.String()),
            isActive: t.Optional(t.Boolean()),
            sortOrder: t.Optional(t.Number()),
        }),
        detail: { summary: 'Update room type', tags: ['Rooms'] }
    })
    .delete('/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        await RoomTypesService.remove(user.hotelId, parseInt(params.id));
        return createResponse(null, 'Room type deleted');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.UPDATE,
        detail: { summary: 'Delete room type', tags: ['Rooms'] }
    });
