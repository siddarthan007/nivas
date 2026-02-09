import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { OutletsService } from './outlets.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const outletsController = new Elysia({ prefix: '/settings/outlets' })
    .use(authMiddleware)
    .get('/', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const list = await OutletsService.getOutlets(user.hotelId);
        return createResponse(list, 'Outlets fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SETTINGS.MANAGE_OUTLETS,
        detail: { summary: 'List all outlets', tags: ['Settings'] }
    })
    .post('/', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const newOutlet = await OutletsService.createOutlet(user.hotelId, body);
        return createResponse(newOutlet, 'Outlet created successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SETTINGS.MANAGE_OUTLETS,
        body: t.Object({
            name: t.String(),
            type: t.Union([
                t.Literal('RESTAURANT'),
                t.Literal('BAR'),
                t.Literal('CAFE'),
                t.Literal('SPA'),
                t.Literal('LAUNDRY'),
                t.Literal('OTHER')
            ])
        }),
        detail: { summary: 'Create new outlet', tags: ['Settings'] }
    })
    .patch('/:id', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await OutletsService.updateOutlet(user.hotelId, parseInt(params.id), body);
        return createResponse(updated, 'Outlet updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SETTINGS.MANAGE_OUTLETS,
        body: t.Partial(t.Object({
            name: t.String(),
            type: t.Union([
                t.Literal('RESTAURANT'),
                t.Literal('BAR'),
                t.Literal('CAFE'),
                t.Literal('SPA'),
                t.Literal('LAUNDRY'),
                t.Literal('OTHER')
            ]),
            isActive: t.Boolean()
        })),
        detail: { summary: 'Update outlet', tags: ['Settings'] }
    })
    .delete('/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        await OutletsService.deleteOutlet(user.hotelId, parseInt(params.id));
        return createResponse(null, 'Outlet deleted successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SETTINGS.MANAGE_OUTLETS,
        detail: { summary: 'Delete outlet', tags: ['Settings'] }
    });