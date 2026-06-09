import { Elysia, t } from 'elysia';
import { db } from '../../db';
import { rooms, restaurantTables, floors } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { NotFoundError } from '../../utils/errors';
import { createResponse } from '../../utils/response.helper';

export const layoutController = new Elysia({ prefix: '/layout' })
    .use(authMiddleware)
    .get('/floor-plan', async ({ user, query }) => {
        const floorId = query.floorId ? parseInt(query.floorId) : undefined;

        const roomConditions = [eq(rooms.hotelId, user!.hotelId!)];
        if (floorId) roomConditions.push(eq(rooms.floorId, floorId));

        const roomNodes = await db.query.rooms.findMany({
            where: and(...roomConditions),
            columns: {
                id: true,
                name: true,
                number: true,
                status: true,
                type: true,
                layoutProps: true
            }
        });

        const tableNodes = await db.query.restaurantTables.findMany({
            where: eq(restaurantTables.hotelId, user!.hotelId!),
            columns: {
                id: true,
                tableNumber: true,
                capacity: true,
                status: true,
                location: true,
                layoutProps: true
            }
        });

        return createResponse({ rooms: roomNodes, tables: tableNodes }, 'Floor plan fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.VIEW_STATUS,
        query: t.Object({
            floorId: t.Optional(t.String())
        }),
        detail: { summary: 'Get visual editor data', tags: ['Operations'] }
    })
    .post('/save-positions', async ({ body, user }) => {
        await db.transaction(async (tx) => {
            if (body.rooms) {
                for (const r of body.rooms) {
                    const layout = {
                        x: r.layout.x ?? 0,
                        y: r.layout.y ?? 0,
                        w: r.layout.w ?? 100,
                        h: r.layout.h ?? 60,
                        rotation: r.layout.rotation ?? 0,
                        shape: r.layout.shape ?? 'RECTANGLE'
                    };
                    await tx.update(rooms)
                        .set({
                            layoutProps: layout,
                            updatedAt: new Date()
                        })
                        .where(and(eq(rooms.id, r.id), eq(rooms.hotelId, user!.hotelId!)));
                }
            }

            if (body.tables) {
                for (const tbl of body.tables) {
                    const layout = {
                        x: tbl.layout.x ?? 0,
                        y: tbl.layout.y ?? 0,
                        rotation: tbl.layout.rotation ?? 0
                    };
                    await tx.update(restaurantTables)
                        .set({
                            layoutProps: layout,
                            updatedAt: new Date()
                        })
                        .where(and(eq(restaurantTables.id, tbl.id), eq(restaurantTables.hotelId, user!.hotelId!)));
                }
            }
        });

        return createResponse(null, 'Layout saved successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.UPDATE,
        body: t.Object({
            rooms: t.Optional(t.Array(t.Object({
                id: t.Number(),
                layout: t.Object({
                    x: t.Number(),
                    y: t.Number(),
                    w: t.Optional(t.Number()),
                    h: t.Optional(t.Number()),
                    rotation: t.Optional(t.Number()),
                    shape: t.Optional(t.String())
                })
            }))),
            tables: t.Optional(t.Array(t.Object({
                id: t.Number(),
                layout: t.Object({
                    x: t.Number(),
                    y: t.Number(),
                    rotation: t.Optional(t.Number())
                })
            })))
        }),
        detail: { summary: 'Save drag-and-drop positions', tags: ['Operations'] }
    })
    /**
     * Update single room position (merged from floor-plan)
     */
    .patch('/room/:id/position', async ({ params, body, user }) => {
        const [updated] = await db.update(rooms)
            .set({
                layoutProps: body,
                updatedAt: new Date()
            })
            .where(and(
                eq(rooms.id, parseInt(params.id)),
                eq(rooms.hotelId, user!.hotelId!)
            ))
            .returning();

        if (!updated) throw new NotFoundError('Room');

        return createResponse(updated, 'Room position updated');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.UPDATE,
        body: t.Object({
            x: t.Number(),
            y: t.Number(),
            width: t.Optional(t.Number()),
            height: t.Optional(t.Number()),
            rotation: t.Optional(t.Number())
        }),
        detail: { summary: 'Update room position', tags: ['Layout'] }
    })
    /**
     * Get nested floor plan structure (merged from floor-plan)
     */
    .get('/structure', async ({ user }) => {
        const floorsList = await db.query.floors.findMany({
            where: eq(floors.hotelId, user!.hotelId!),
            with: {
                rooms: true
            }
        });

        return createResponse(floorsList.map(floor => ({
            id: floor.id,
            name: floor.name,
            number: floor.number,
            rooms: floor.rooms.map(room => ({
                id: room.id,
                number: room.number,
                name: room.name,
                type: room.type,
                status: room.status,
                layoutProps: room.layoutProps || { x: 0, y: 0, width: 80, height: 60 }
            }))
        })), 'Floor structure fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.VIEW_STATUS,
        detail: { summary: 'Get nested floor plan layout', tags: ['Layout'] }
    });