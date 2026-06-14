import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { RolesService } from './roles.service';
import { AccessControlService } from '../system/access-control.service';
import { createResponse } from '../../utils/response.helper';
import { PERMISSIONS } from '../../config/permissions';
import { ValidationError, ForbiddenError } from '../../utils/errors';
import { db } from '../../db';
import { users } from '../../db/schema';
import { eq, and } from 'drizzle-orm';

export const rolesController = new Elysia({ prefix: '/roles' })
    .use(authMiddleware)
    .get('/', async ({ user }) => {
        if (!user || !user.hotelId) throw new ValidationError('Hotel ID required');
        const rolesList = await RolesService.getRoles(user.hotelId);
        return createResponse(rolesList, 'Roles fetched successfully');
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
        const newRole = await RolesService.createRole(user.hotelId, user.id, body);
        return createResponse(newRole, 'Role created successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROLES.CREATE,
        body: t.Object({
            name: t.String(),
            level: t.Optional(t.Number()),
            permissions: t.Array(t.String())
        }),
        detail: {
            summary: 'Create a new dynamic role',
            tags: ['IAM']
        }
    })
    .patch('/:id', async ({ params, body, user }) => {
        if (!user || !user.hotelId) throw new ValidationError('Hotel ID required');
        const updatedRole = await RolesService.updateRole(user.hotelId, user.id, parseInt(params.id, 10), body);
        return createResponse(updatedRole, 'Role updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROLES.UPDATE,
        body: t.Partial(t.Object({
            name: t.String(),
            level: t.Number(),
            permissions: t.Array(t.String())
        })),
        detail: {
            summary: 'Update role permissions',
            tags: ['IAM']
        }
    })
    .delete('/:id', async ({ params, user }) => {
        if (!user || !user.hotelId) throw new ValidationError('Hotel ID required');
        await RolesService.deleteRole(user.hotelId, parseInt(params.id, 10));
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
    })
    .post('/fix-defaults', async ({ user }) => {
        if (!user || !user.hotelId) throw new ValidationError('Hotel ID required');
        // Re-seeding recreates the all-permissions Owner role → owner/super-admin only.
        const requester = await db.query.users.findFirst({ where: and(eq(users.id, user.id), eq(users.hotelId, user.hotelId)), with: { role: true } });
        const isOwner = (requester as any)?.userType === 'SUPER_ADMIN' || (requester as any)?.role?.level === 0;
        if (!isOwner) throw new ForbiddenError('Only an owner can re-seed default roles');
        await AccessControlService.seedDefaultRoles(user.hotelId);
        return createResponse(null, 'Default roles seeded and levels fixed successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROLES.UPDATE,
        detail: {
            summary: 'Re-seed default roles and fix level-99 values',
            tags: ['IAM']
        }
    });