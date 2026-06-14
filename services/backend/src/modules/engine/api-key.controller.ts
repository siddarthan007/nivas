import { Elysia, t } from 'elysia';
import { s } from '../../lib/schema';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { ApiKeyService } from './api-key.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const apiKeyController = new Elysia({ prefix: '/api-keys' })
    .use(authMiddleware)
    .get('/', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        return createResponse(await ApiKeyService.list(user.hotelId), 'API keys');
    }, { isSignedIn: true, hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS, detail: { summary: 'List API keys', tags: ['Engine'] } })

    .post('/', async ({ user, body }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        // Returns the raw key ONCE.
        return createResponse(await ApiKeyService.create(user.hotelId, user.id, body.name, body.scopes), 'API key created — copy it now, it is shown only once');
    }, {
        isSignedIn: true, hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        body: t.Object({ name: s.string({ minLength: 1 }), scopes: t.Optional(t.Array(t.String())) }),
        detail: { summary: 'Create API key', tags: ['Engine'] }
    })

    .delete('/:id', async ({ user, params }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        return createResponse(await ApiKeyService.revoke(user.hotelId, parseInt(params.id)), 'API key revoked');
    }, { isSignedIn: true, hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS, params: t.Object({ id: t.String() }), detail: { summary: 'Revoke API key', tags: ['Engine'] } })

    .get('/availability-preview', async ({ user, query }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dayAfter = new Date(tomorrow);
        dayAfter.setDate(dayAfter.getDate() + 1);
        const checkIn = query.checkIn || tomorrow.toISOString().split('T')[0];
        const checkOut = query.checkOut || dayAfter.toISOString().split('T')[0];
        return createResponse(await ApiKeyService.previewAvailability(user.hotelId, checkIn!, checkOut!), 'Availability preview');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        query: t.Object({ checkIn: t.Optional(t.String()), checkOut: t.Optional(t.String()) }),
        detail: { summary: 'Preview booking engine availability', tags: ['Engine'] },
    });
