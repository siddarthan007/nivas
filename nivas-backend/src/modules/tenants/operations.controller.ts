import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { OperationsService } from './operations.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const operationsController = new Elysia({ prefix: '/ops' })
    .use(authMiddleware)
    .post('/floors', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const newFloor = await OperationsService.createFloor(user.hotelId, body);
        return createResponse(newFloor, 'Floor created successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.CREATE,
        body: t.Object({
            name: t.String(),
            number: t.Number()
        }),
        detail: {
            summary: 'Create a new floor',
            tags: ['Operations']
        }
    })
    .get('/floors', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const floorsList = await OperationsService.getAllFloors(user.hotelId);
        return createResponse(floorsList, 'Floors fetched successfully');
    }, {
        isSignedIn: true,
        detail: {
            summary: 'Get all floors',
            tags: ['Operations']
        }
    })
    .post('/rooms', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const data = await OperationsService.createRoom(user.hotelId, body);
        return createResponse(data, 'Room created successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.CREATE,
        body: t.Object({
            floorId: t.Number(),
            number: t.Number(),
            name: t.String(),
            type: t.String(),
            rate: t.Number(),
            status: t.Optional(t.String()),
        }),
        detail: {
            summary: 'Create a new room',
            tags: ['Operations']
        }
    })
    .get('/rooms', async ({ user, query }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const roomsList = await OperationsService.getAllRooms(user.hotelId, query.includeBookings === 'true');
        return createResponse(roomsList, 'Rooms fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.VIEW_STATUS,
        query: t.Object({
            includeBookings: t.Optional(t.String())
        }),
        detail: {
            summary: 'Get all rooms',
            tags: ['Operations']
        }
    })
    .patch('/rooms/:id/status', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updatedRoom = await OperationsService.updateRoomStatus(user.hotelId, parseInt(params.id), body.status);
        return createResponse(updatedRoom, 'Room status updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.UPDATE,
        body: t.Object({
            status: t.String()
        }),
        detail: {
            summary: 'Update room status',
            tags: ['Operations']
        }
    })
    .patch('/floors/:id', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await OperationsService.updateFloor(user.hotelId, parseInt(params.id), body);
        return createResponse(updated, 'Floor updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.UPDATE,
        body: t.Object({
            name: t.Optional(t.String()),
            number: t.Optional(t.Number())
        }),
        detail: { summary: 'Update a floor', tags: ['Operations'] }
    })
    .delete('/floors/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        await OperationsService.deleteFloor(user.hotelId, parseInt(params.id));
        return createResponse(null, 'Floor deleted successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.DELETE,
        detail: { summary: 'Delete a floor', tags: ['Operations'] }
    })
    .patch('/rooms/:id/guest-pin', async ({ params, body }) => {
        const updatedRoom = await OperationsService.updateGuestPin(parseInt(params.id), body.pin);
        return createResponse(updatedRoom, 'Guest PIN updated');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.GUESTS.CHECK_IN,
        body: t.Object({
            pin: t.String()
        }),
        detail: {
            summary: 'Set guest PIN for room access',
            tags: ['Operations']
        }
    });