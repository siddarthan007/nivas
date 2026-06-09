import { Elysia, t } from 'elysia';
import { MaintenanceService } from './maintenance.service';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { ValidationError } from '../../utils/errors';

export const maintenanceController = new Elysia({ prefix: '/maintenance' })
    .use(authMiddleware)
    .get('/assets', async ({ user }) => {
        if (!user || !user.hotelId) throw new ValidationError('User must be associated with a hotel');
        return MaintenanceService.getAssets(user.hotelId);
    }, { isSignedIn: true, hasPermission: PERMISSIONS.HOUSEKEEPING.VIEW })
    .post('/assets', async ({ user, body }) => {
        if (!user || !user.hotelId) throw new ValidationError('User must be associated with a hotel');
        return MaintenanceService.createAsset(user.hotelId, body);
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.HOUSEKEEPING.UPDATE,
        body: t.Object({
            name: t.String(),
            category: t.String(),
            serialNumber: t.Optional(t.String()),
            location: t.Optional(t.String()),
            purchaseDate: t.Optional(t.String()),
            purchasePrice: t.Optional(t.String()),
            status: t.Optional(t.String())
        })
    })
    .get('/tickets', async ({ user }) => {
        if (!user || !user.hotelId) throw new ValidationError('User must be associated with a hotel');
        return MaintenanceService.getMaintenanceTickets(user.hotelId);
    }, { isSignedIn: true, hasPermission: PERMISSIONS.HOUSEKEEPING.VIEW })
    .post('/tickets', async ({ user, body }) => {
        if (!user || !user.hotelId) throw new ValidationError('User must be associated with a hotel');
        return MaintenanceService.createTicket(user.hotelId, user.id, body);
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.HOUSEKEEPING.UPDATE,
        body: t.Object({
            title: t.String(),
            description: t.String(),
            priority: t.Optional(t.String()),
            roomId: t.Optional(t.Number()),
            assetId: t.Optional(t.Number()),
            assignedTo: t.Optional(t.String()),
            blockRoom: t.Optional(t.Boolean())
        })
    })
    .patch('/tickets/:id/status', async ({ user, params: { id }, body }) => {
        if (!user || !user.hotelId) throw new ValidationError('User must be associated with a hotel');
        return MaintenanceService.updateTicketStatus(user.hotelId, parseInt(id, 10), body.status);
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.HOUSEKEEPING.UPDATE,
        body: t.Object({
            status: t.String()
        })
    });
