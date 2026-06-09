import { Elysia, t } from 'elysia';
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
        body: t.Object({ name: t.String({ minLength: 1 }), scopes: t.Optional(t.Array(t.String())) }),
        detail: { summary: 'Create API key', tags: ['Engine'] }
    })

    .delete('/:id', async ({ user, params }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        return createResponse(await ApiKeyService.revoke(user.hotelId, parseInt(params.id)), 'API key revoked');
    }, { isSignedIn: true, hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS, params: t.Object({ id: t.String() }), detail: { summary: 'Revoke API key', tags: ['Engine'] } });
