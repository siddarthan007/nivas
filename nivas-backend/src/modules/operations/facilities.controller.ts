import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { FacilitiesService } from './facilities.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';
import { db } from '../../db';
import { parkingSpaces } from '../../db/schema';
import { eq, and } from 'drizzle-orm';

export const facilitiesController = new Elysia({ prefix: '/operations/facilities' })
    .use(authMiddleware)
    .get('/', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const list = await FacilitiesService.getAllFacilities(user.hotelId);
        return createResponse(list, 'Facilities fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.OPERATIONS.SETUP_FACILITIES,
        detail: { summary: 'List all facilities', tags: ['Operations'] }
    })
    .post('/', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const newFacility = await FacilitiesService.createFacility(user.hotelId, body);
        return createResponse(newFacility, 'Facility created successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.OPERATIONS.SETUP_FACILITIES,
        body: t.Object({
            name: t.String(),
            type: t.String(),
            location: t.Nullable(t.String()),
            description: t.Nullable(t.String()),
            status: t.Union([t.Literal('OPEN'), t.Literal('CLOSED'), t.Literal('MAINTENANCE')]),
            openTime: t.String(),
            closeTime: t.String()
        }),
        detail: { summary: 'Create facility', tags: ['Operations'] }
    })
    .patch('/:id', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await FacilitiesService.updateFacility(user.hotelId, parseInt(params.id), body);
        return createResponse(updated, 'Facility updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.OPERATIONS.SETUP_FACILITIES,
        body: t.Partial(t.Object({
            name: t.String(),
            status: t.String(),
            openTime: t.String(),
            closeTime: t.String()
        })),
        detail: { summary: 'Update facility', tags: ['Operations'] }
    })
    .delete('/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        await FacilitiesService.deleteFacility(user.hotelId, parseInt(params.id));
        return createResponse(null, 'Facility deleted successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.OPERATIONS.SETUP_FACILITIES,
        detail: { summary: 'Delete facility', tags: ['Operations'] }
    })
    .get('/parking', async ({ user }) => {
        const spots = await db.query.parkingSpaces.findMany({
            where: eq(parkingSpaces.hotelId, user!.hotelId!),
            with: {
                assignedRoom: {
                    columns: { number: true, name: true }
                }
            }
        });

        return { status: 'success', data: spots };
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.PARKING.VIEW,
        detail: { summary: 'Get all parking spots', tags: ['Operations'] }
    })
    .post('/parking', async ({ body, user }) => {
        const [spot] = await db.insert(parkingSpaces).values({
            hotelId: user!.hotelId!,
            spaceNumber: body.spaceNumber,
            vehicleType: body.vehicleType
        }).returning();

        return { status: 'success', data: spot };
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.PARKING.MANAGE,
        body: t.Object({
            spaceNumber: t.String(),
            vehicleType: t.String()
        }),
        detail: { summary: 'Add parking spot', tags: ['Operations'] }
    })
    .delete('/parking/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const [deleted] = await db.delete(parkingSpaces)
            .where(and(eq(parkingSpaces.id, parseInt(params.id)), eq(parkingSpaces.hotelId, user.hotelId)))
            .returning();
        if (!deleted) return createResponse(null, 'Parking spot not found');
        return createResponse(deleted, 'Parking spot deleted successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.PARKING.MANAGE,
        detail: { summary: 'Delete parking spot', tags: ['Operations'] }
    })
    .patch('/parking/:id/assign', async ({ params, body, user }) => {
        const [updated] = await db.update(parkingSpaces)
            .set({
                status: body.roomId ? 'OCCUPIED' : 'AVAILABLE',
                assignedToRoomId: body.roomId || null,
                updatedAt: new Date()
            })
            .where(and(
                eq(parkingSpaces.id, parseInt(params.id)),
                eq(parkingSpaces.hotelId, user!.hotelId!)
            ))
            .returning();

        return { status: 'success', data: updated };
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.PARKING.MANAGE,
        body: t.Object({
            roomId: t.Optional(t.Number())
        }),
        detail: { summary: 'Assign parking to room', tags: ['Facilities'] }
    });