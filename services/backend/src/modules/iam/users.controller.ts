import { Elysia, t } from 'elysia';
import { s } from '../../lib/schema';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { UsersService } from './users.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const usersController = new Elysia({ prefix: '/users' })
    .use(authMiddleware)
    .get('/', async ({ user }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }

        const staffList = await UsersService.getStaff(user.hotelId);
        return createResponse(staffList, 'Staff list fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.USERS.READ,
        detail: {
            summary: 'Get all hotel staff',
            tags: ['IAM']
        }
    })
    .patch('/:id/role', async ({ params, body, user }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }

        const safeUser = await UsersService.updateRole(user.hotelId, user.id, params.id, body.roleId);
        return createResponse(safeUser, 'Role assigned successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.USERS.MANAGE_ROLES,
        body: t.Object({
            roleId: t.Number()
        }),
        detail: {
            summary: 'Assign role to user',
            tags: ['IAM']
        }
    })
    .patch('/:id/status', async ({ params, body, user }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }

        await UsersService.updateStatus(user.hotelId, user.id, params.id, body.isActive);
        return createResponse(null, `User ${body.isActive ? 'activated' : 'deactivated'}`);
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.USERS.UPDATE,
        body: t.Object({
            isActive: t.Boolean()
        }),
        detail: {
            summary: 'Activate or deactivate user access',
            tags: ['IAM']
        }
    })
    .patch('/:id/password', async ({ params, body, user }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }

        await UsersService.resetPassword(user.hotelId, user.id, params.id, body.password);
        return createResponse(null, 'User password reset successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.USERS.UPDATE,
        body: t.Object({
            password: s.string({ minLength: 6 })
        }),
        detail: {
            summary: 'Reset user password (Admin)',
            tags: ['IAM']
        }
    })
    .put('/:id', async ({ params, body, user }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }

        const safeUser = await UsersService.updateDetails(user.hotelId, params.id, body);
        return createResponse(safeUser, 'User details updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.USERS.UPDATE,
        body: t.Object({
            fullName: t.String(),
            phone: t.String()
        }),
        detail: {
            summary: 'Update user details',
            tags: ['IAM']
        }
    })
    .delete('/:id', async ({ params, user }) => {
        if (!user?.hotelId) {
            throw new ValidationError('Hotel ID is required');
        }

        await UsersService.deleteUser(user.hotelId, user.id, params.id);
        return createResponse(null, 'User deleted successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.USERS.DELETE,
        detail: {
            summary: 'Delete a user (soft delete)',
            tags: ['IAM']
        }
    });