import { Elysia, t } from 'elysia';
import { db } from '../../db';
import { upsellRules, rooms, bookings } from '../../db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { NotFoundError } from '../../utils/errors';
import { createResponse } from '../../utils/response.helper';

export const upsellController = new Elysia({ prefix: '/upsells' })
    .use(authMiddleware)
    .post('/', async ({ body, user }) => {
        const [rule] = await db.insert(upsellRules).values({
            hotelId: user!.hotelId!,
            name: body.name,
            triggerType: body.triggerType,
            fromRoomType: body.fromRoomType,
            toRoomType: body.toRoomType,
            upgradePrice: body.upgradePrice?.toString(),
            upgradePercentage: body.upgradePercentage?.toString(),
            serviceType: body.serviceType,
            servicePrice: body.servicePrice?.toString(),
            displayMessage: body.displayMessage,
            priority: body.priority,
            isActive: true
        }).returning();

        return createResponse(rule, 'Upsell rule created');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.UPDATE,
        body: t.Object({
            name: t.String(),
            triggerType: t.Union([
                t.Literal('CHECK_IN'),
                t.Literal('BOOKING'),
                t.Literal('CHECKOUT')
            ]),
            fromRoomType: t.Optional(t.String()),
            toRoomType: t.Optional(t.String()),
            upgradePrice: t.Optional(t.Number()),
            upgradePercentage: t.Optional(t.Number()),
            serviceType: t.Optional(t.Union([
                t.Literal('BREAKFAST'),
                t.Literal('SPA'),
                t.Literal('AIRPORT_TRANSFER'),
                t.Literal('LATE_CHECKOUT'),
                t.Literal('EARLY_CHECKIN')
            ])),
            servicePrice: t.Optional(t.Number()),
            displayMessage: t.Optional(t.String()),
            priority: t.Optional(t.Number())
        }),
        detail: { summary: 'Create upsell rule', tags: ['Upsells'] }
    })
    .get('/', async ({ user }) => {
        const rules = await db.query.upsellRules.findMany({
            where: eq(upsellRules.hotelId, user!.hotelId!)
        });
        return createResponse(rules, 'Upsell rules fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.VIEW_STATUS,
        detail: { summary: 'Get all upsell rules', tags: ['Upsells'] }
    })
    .get('/check-in/:bookingId', async ({ params, user }) => {
        const booking = await db.query.bookings.findFirst({
            where: and(
                eq(bookings.id, params.bookingId),
                eq(bookings.hotelId, user!.hotelId!)
            ),
            with: { room: true }
        });

        if (!booking) throw new NotFoundError('Booking');

        const currentRoomType = (booking as any).room?.type;
        if (!currentRoomType) return createResponse([], 'No room assigned — no upgrades available');

        const upgradeRules = await db.query.upsellRules.findMany({
            where: and(
                eq(upsellRules.hotelId, user!.hotelId!),
                eq(upsellRules.isActive, true),
                eq(upsellRules.triggerType, 'CHECK_IN'),
                eq(upsellRules.fromRoomType, currentRoomType!)
            )
        });

        const serviceRules = await db.query.upsellRules.findMany({
            where: and(
                eq(upsellRules.hotelId, user!.hotelId!),
                eq(upsellRules.isActive, true),
                eq(upsellRules.triggerType, 'CHECK_IN')
            )
        });

        const serviceUpsells = serviceRules
            .filter(r => r.serviceType)
            .map(r => ({
                id: r.id,
                name: r.name,
                serviceType: r.serviceType,
                price: parseFloat(r.servicePrice ?? '0'),
                message: r.displayMessage
            }));

        const upgradeOptions = [];
        for (const rule of upgradeRules) {
            if (!rule.toRoomType) continue;

            const availableRoom = await db.query.rooms.findFirst({
                where: and(
                    eq(rooms.hotelId, user!.hotelId!),
                    eq(rooms.type, rule.toRoomType),
                    eq(rooms.status, 'AVAILABLE')
                )
            });

            if (availableRoom) {
                upgradeOptions.push({
                    id: rule.id,
                    name: rule.name,
                    fromRoomType: rule.fromRoomType,
                    toRoomType: rule.toRoomType,
                    availableRoom: {
                        id: availableRoom.id,
                        number: availableRoom.number,
                        rate: parseFloat(availableRoom.rate ?? '0')
                    },
                    upgradePrice: rule.upgradePrice ? parseFloat(rule.upgradePrice) : null,
                    upgradePercentage: rule.upgradePercentage ? parseFloat(rule.upgradePercentage) : null,
                    message: rule.displayMessage
                });
            }
        }

        return createResponse({
            bookingId: booking.id,
            guestName: booking.guestName,
            currentRoom: {
                id: booking.room.id,
                number: booking.room.number,
                type: booking.room.type
            },
            roomUpgrades: upgradeOptions,
            serviceUpsells
        }, 'Check-in upsell options fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.GUESTS.CHECK_IN,
        detail: { summary: 'Get check-in upsell options', tags: ['Upsells'] }
    })
    .patch('/:id', async ({ params, body, user }) => {
        const allowed = ['name', 'triggerType', 'fromRoomType', 'toRoomType', 'serviceType', 'displayMessage', 'priority', 'isActive'];
        const updateData: any = {};
        for (const key of allowed) {
            if ((body as any)[key] !== undefined) updateData[key] = (body as any)[key];
        }
        const [updated] = await db.update(upsellRules)
            .set({
                ...updateData,
                upgradePrice: body.upgradePrice?.toString(),
                upgradePercentage: body.upgradePercentage?.toString(),
                servicePrice: body.servicePrice?.toString()
            })
            .where(and(
                eq(upsellRules.id, parseInt(params.id)),
                eq(upsellRules.hotelId, user!.hotelId!)
            ))
            .returning();

        if (!updated) throw new NotFoundError('Upsell rule');
        return createResponse(updated, 'Upsell rule updated');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.UPDATE,
        body: t.Partial(t.Object({
            name: t.String(),
            triggerType: t.String(),
            fromRoomType: t.String(),
            toRoomType: t.String(),
            upgradePrice: t.Number(),
            upgradePercentage: t.Number(),
            serviceType: t.String(),
            servicePrice: t.Number(),
            displayMessage: t.String(),
            priority: t.Number(),
            isActive: t.Boolean()
        })),
        detail: { summary: 'Update upsell rule', tags: ['Upsells'] }
    })
    .delete('/:id', async ({ params, user }) => {
        await db.delete(upsellRules)
            .where(and(
                eq(upsellRules.id, parseInt(params.id)),
                eq(upsellRules.hotelId, user!.hotelId!)
            ));
        return createResponse(null, 'Upsell rule deleted');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.UPDATE,
        detail: { summary: 'Delete upsell rule', tags: ['Upsells'] }
    });
