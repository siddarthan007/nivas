import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { RolesService } from './roles.service';
import { createResponse } from '../../utils/response.helper';
import { PERMISSIONS } from '../../config/permissions';
import { ValidationError } from '../../utils/errors';

export const rolesController = new Elysia({ prefix: '/roles' })
    .use(authMiddleware)
    .get('/', async ({ user }) => {
        try {
            if (!user || !user.hotelId) throw new ValidationError('Hotel ID required');
            console.log('[RolesController] Fetching roles for hotel:', user.hotelId);
            const rolesList = await RolesService.getRoles(user.hotelId);
            console.log('[RolesController] Found roles:', rolesList.length);
            return createResponse(rolesList, 'Roles fetched successfully');
        } catch (err) {
            console.error('[RolesController] Error fetching roles:', err);
            throw err;
        }
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROLES.READ,
        detail: {
            summary: 'Get all roles',
            tags: ['IAM']
        }
    })
    .post('/', async ({ body, user }) => {
        if (!user || !user.hotelId) throw new ValidationError('Hotel ID required');
        const newRole = await RolesService.createRole(user.hotelId, body);
        return createResponse(newRole, 'Role created successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROLES.CREATE,
        body: t.Object({
            name: t.String(),
            permissions: t.Array(t.String())
        }),
        detail: {
            summary: 'Create a new dynamic role',
            tags: ['IAM']
        }
    })
    .patch('/:id', async ({ params, body, user }) => {
        if (!user || !user.hotelId) throw new ValidationError('Hotel ID required');
        const updatedRole = await RolesService.updateRole(user.hotelId, parseInt(params.id), body);
        return createResponse(updatedRole, 'Role updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROLES.UPDATE,
        body: t.Partial(t.Object({
            name: t.String(),
            permissions: t.Array(t.String())
        })),
        detail: {
            summary: 'Update role permissions',
            tags: ['IAM']
        }
    })
    .delete('/:id', async ({ params, user }) => {
        if (!user || !user.hotelId) throw new ValidationError('Hotel ID required');
        await RolesService.deleteRole(user.hotelId, parseInt(params.id));
        return createResponse(null, 'Role deleted successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROLES.DELETE,
        detail: {
            summary: 'Delete a role',
            tags: ['IAM']
        }
    })
    .get('/permissions', () => {
        const permissions = RolesService.getPermissions();
        // Filter out SAAS and SYSTEM permissions
        const filteredPermissions = Object.fromEntries(
            Object.entries(permissions).filter(([key]) =>
                !key.startsWith('SAAS') &&
                !key.startsWith('SYSTEM') &&
                key !== 'TENANTS' &&
                key !== 'LICENSES'
            )
        );
        return createResponse(filteredPermissions, 'Permissions list fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROLES.READ,
        detail: {
            summary: 'Get list of all system permissions',
            tags: ['IAM']
        }
    });
